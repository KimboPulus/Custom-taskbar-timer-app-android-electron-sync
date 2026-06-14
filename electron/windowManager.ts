import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CompactPosition,
  WindowMode,
} from "../src/desktop/desktopTypes.js";
import { getNextWindowMode } from "../src/desktop/windowMode.js";
import type { SettingsStore } from "./settingsStore.js";
import {
  detachFromWindowsTaskbar,
  embedInWindowsTaskbar,
} from "./taskbarHost.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FULL_SIZE = { width: 900, height: 620 };
const COMPACT_SIZE = { width: 240, height: 180 };

export class WindowManager {
  private window: BrowserWindow | null = null;
  private mode: WindowMode = "full";
  private fullBounds: Electron.Rectangle | null = null;
  private savePositionTimer: NodeJS.Timeout | null = null;
  private taskbarEmbedded = false;

  constructor(private readonly settingsStore: SettingsStore) {}

  createWindow(): BrowserWindow {
    const settings = this.settingsStore.get();
    this.mode = settings.windowMode;
    const initialBounds = this.getBoundsForMode(this.mode);
    const fixedSize = this.mode !== "full";

    this.window = new BrowserWindow({
      ...initialBounds,
      minWidth: fixedSize ? initialBounds.width : 700,
      minHeight: fixedSize ? initialBounds.height : 500,
      show: false,
      frame: false,
      transparent: false,
      backgroundColor: "#f5f7f7",
      alwaysOnTop: fixedSize,
      skipTaskbar: this.mode === "taskbar",
      resizable: !fixedSize,
      maximizable: !fixedSize,
      movable: this.mode !== "taskbar",
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    if (this.mode !== "taskbar") {
      this.ensureWindowIsVisible();
    }
    if (fixedSize) {
      this.window.setAlwaysOnTop(true, "screen-saver", 1);
    }
    if (this.mode === "taskbar") {
      this.window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: false,
      });
    }

    this.window.on("ready-to-show", () => void this.activateInitialMode());
    this.window.on("move", () => this.queueCompactPositionSave());
    this.window.on("closed", () => {
      screen.removeListener("display-metrics-changed", this.handleDisplayChange);
      this.window = null;
    });
    screen.on("display-metrics-changed", this.handleDisplayChange);

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      void this.window.loadURL(devServerUrl);
    } else {
      void this.window.loadFile(path.join(__dirname, "../../dist/index.html"));
    }

    return this.window;
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  getMode(): WindowMode {
    return this.mode;
  }

  async setMode(requestedMode: WindowMode): Promise<WindowMode> {
    if (!this.window) {
      return this.mode;
    }

    const validMode: WindowMode =
      requestedMode === "compact" || requestedMode === "taskbar"
        ? requestedMode
        : "full";
    const settings = this.settingsStore.get();
    const nextMode =
      validMode === "taskbar" && !settings.taskbarModeEnabled
        ? "full"
        : validMode;

    if (nextMode === this.mode) {
      return this.mode;
    }

    if (this.mode === "taskbar" && this.taskbarEmbedded) {
      await detachFromWindowsTaskbar(this.window);
      this.taskbarEmbedded = false;
    }

    if (this.mode === "full") {
      this.fullBounds = this.window.getBounds();
    } else if (this.mode === "compact") {
      await this.saveCompactPosition();
    }

    this.mode = nextMode;
    const applied = await this.applyMode();
    if (!applied && nextMode === "taskbar") {
      this.mode = "full";
      await this.applyMode();
    }
    await this.settingsStore.update({ windowMode: nextMode });
    if (this.mode !== nextMode) {
      await this.settingsStore.update({ windowMode: this.mode });
    }
    return this.mode;
  }

  async cycleMode(): Promise<WindowMode> {
    const settings = this.settingsStore.get();
    return this.setMode(
      getNextWindowMode(this.mode, settings.taskbarModeEnabled),
    );
  }

  minimize(): void {
    this.window?.minimize();
  }

  close(): void {
    this.window?.close();
  }

  private readonly handleDisplayChange = () => {
    if (this.mode === "taskbar" && this.window) {
      void this.repositionTaskbarWindow();
    } else if (this.mode === "compact") {
      this.ensureWindowIsVisible();
    }
  };

  private async activateInitialMode(): Promise<void> {
    const applied = await this.applyMode();
    if (!applied && this.mode === "taskbar") {
      this.mode = "full";
      await this.applyMode();
      await this.settingsStore.update({ windowMode: "full" });
    }
  }

  private async applyMode(): Promise<boolean> {
    if (!this.window) {
      return false;
    }

    this.window.unmaximize();
    this.window.setMinimumSize(1, 1);

    if (this.mode === "full") {
      this.window.setAlwaysOnTop(false);
      this.window.setVisibleOnAllWorkspaces(false);
      this.window.setSkipTaskbar(false);
      this.window.setResizable(true);
      this.window.setMaximizable(true);
      this.window.setMovable(true);
      this.window.setMinimumSize(700, 500);
      this.window.setBounds(
        this.fullBounds ?? this.getCenteredFullBounds(),
      );
      this.ensureWindowIsVisible();
      this.window.show();
      this.window.focus();
      return true;
    }

    this.window.setResizable(false);
    this.window.setMaximizable(false);
    this.window.setAlwaysOnTop(true, "screen-saver", 1);

    if (this.mode === "compact") {
      this.window.setVisibleOnAllWorkspaces(false);
      this.window.setSkipTaskbar(false);
      this.window.setMovable(true);
      this.window.setMinimumSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
      this.window.setBounds(this.getBoundsForMode("compact"));
      this.ensureWindowIsVisible();
      this.window.show();
      this.window.focus();
      return true;
    }

    const taskbarBounds = this.getTaskbarOverlayBounds();
    this.window.setSkipTaskbar(true);
    this.window.setMovable(false);
    this.window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: false,
    });
    this.window.setMinimumSize(taskbarBounds.width, taskbarBounds.height);
    this.window.setBounds(taskbarBounds);
    this.window.showInactive();
    this.taskbarEmbedded = await this.embedTaskbarWindow(taskbarBounds);
    return this.taskbarEmbedded;
  }

  private getBoundsForMode(mode: WindowMode): Electron.Rectangle {
    if (mode === "compact") {
      const position = this.settingsStore.get().compactPosition;
      const area = screen.getPrimaryDisplay().workArea;
      return {
        width: COMPACT_SIZE.width,
        height: COMPACT_SIZE.height,
        x:
          position?.x ??
          area.x + Math.round((area.width - COMPACT_SIZE.width) / 2),
        y:
          position?.y ??
          area.y + Math.round((area.height - COMPACT_SIZE.height) / 2),
      };
    }
    if (mode === "taskbar") {
      return this.getTaskbarOverlayBounds();
    }
    return this.getCenteredFullBounds();
  }

  private getCenteredFullBounds(): Electron.Rectangle {
    const area = screen.getPrimaryDisplay().workArea;
    return {
      ...FULL_SIZE,
      x: area.x + Math.round((area.width - FULL_SIZE.width) / 2),
      y: area.y + Math.round((area.height - FULL_SIZE.height) / 2),
    };
  }

  private getTaskbarOverlayBounds(): Electron.Rectangle {
    const display = screen.getPrimaryDisplay();
    const { bounds, workArea } = display;
    const boundsBottom = bounds.y + bounds.height;
    const workAreaBottom = workArea.y + workArea.height;
    const bottomGap = Math.max(0, boundsBottom - workAreaBottom);
    const topGap = Math.max(0, workArea.y - bounds.y);
    const taskbarOnTop = topGap >= 24 && topGap > bottomGap;
    const taskbarHeight = Math.max(
      36,
      taskbarOnTop ? topGap : bottomGap || 44,
    );
    const width = Math.min(
      204,
      Math.max(168, Math.round(bounds.width * 0.105)),
    );
    const rightReserve = Math.min(
      360,
      Math.max(250, Math.round(bounds.width * 0.16)),
    );

    return {
      width,
      height: taskbarHeight,
      x: Math.max(
        bounds.x + 8,
        bounds.x + bounds.width - rightReserve - width,
      ),
      y: taskbarOnTop ? bounds.y : boundsBottom - taskbarHeight,
    };
  }

  private async repositionTaskbarWindow(): Promise<void> {
    if (!this.window || this.mode !== "taskbar") {
      return;
    }

    if (this.taskbarEmbedded) {
      await detachFromWindowsTaskbar(this.window);
      this.taskbarEmbedded = false;
    }

    const taskbarBounds = this.getTaskbarOverlayBounds();
    this.window.setBounds(taskbarBounds);
    this.taskbarEmbedded = await this.embedTaskbarWindow(taskbarBounds);
  }

  private embedTaskbarWindow(
    taskbarBounds: Electron.Rectangle,
  ): Promise<boolean> {
    if (!this.window) {
      return Promise.resolve(false);
    }

    const display = screen.getPrimaryDisplay();
    const scaleFactor = display.scaleFactor;
    return embedInWindowsTaskbar(
      this.window,
      Math.round((taskbarBounds.x - display.bounds.x) * scaleFactor),
      Math.round(taskbarBounds.width * scaleFactor),
      Math.round(taskbarBounds.height * scaleFactor),
    );
  }

  private queueCompactPositionSave(): void {
    if (this.mode !== "compact") {
      return;
    }

    if (this.savePositionTimer) {
      clearTimeout(this.savePositionTimer);
    }

    this.savePositionTimer = setTimeout(
      () => void this.saveCompactPosition(),
      250,
    );
  }

  private async saveCompactPosition(): Promise<void> {
    if (!this.window || this.mode !== "compact") {
      return;
    }

    const bounds = this.window.getBounds();
    const compactPosition: CompactPosition = { x: bounds.x, y: bounds.y };
    await this.settingsStore.update({ compactPosition });
  }

  private ensureWindowIsVisible(): void {
    if (!this.window || this.mode === "taskbar") {
      return;
    }

    const bounds = this.window.getBounds();
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      return (
        bounds.x < area.x + area.width &&
        bounds.x + bounds.width > area.x &&
        bounds.y < area.y + area.height &&
        bounds.y + bounds.height > area.y
      );
    });

    if (!visible) {
      this.window.center();
    }
  }
}
