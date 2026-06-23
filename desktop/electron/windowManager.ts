import { app, BrowserWindow, screen } from "electron";
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
const COMPACT_SIZE = { width: 172, height: 54 };

export class WindowManager {
  private window: BrowserWindow | null = null;
  private mode: WindowMode = "full";
  private fullBounds: Electron.Rectangle | null = null;
  private savePositionTimer: NodeJS.Timeout | null = null;
  private taskbarEmbedded = false;
  private quitting = false;
  private nativeWindowReady = false;
  private initialModeActivated = false;
  private lastRenderedMode: WindowMode | null = null;
  private nextTransitionId = 0;
  private renderedModeWaiter:
    | {
        mode: WindowMode;
        transitionId?: number;
        resolve: () => void;
        timeout: NodeJS.Timeout;
      }
    | null = null;

  constructor(private readonly settingsStore: SettingsStore) {}

  createWindow(): BrowserWindow {
    const settings = this.settingsStore.get();
    this.mode = settings.windowMode;
    this.nativeWindowReady = false;
    this.initialModeActivated = false;
    this.lastRenderedMode = null;
    const initialBounds = this.getBoundsForMode(this.mode);
    const fixedSize = this.mode !== "full";

    const createdWindow = new BrowserWindow({
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
        backgroundThrottling: false,
      },
    });
    this.window = createdWindow;

    if (this.mode !== "taskbar") {
      this.ensureWindowIsVisible();
    }
    if (fixedSize) {
      createdWindow.setAlwaysOnTop(true, "screen-saver", 1);
    }
    if (this.mode === "taskbar") {
      createdWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: false,
      });
    }

    createdWindow.on("ready-to-show", () => {
      if (this.window !== createdWindow) {
        return;
      }
      this.nativeWindowReady = true;
      void this.maybeActivateInitialMode();
    });
    createdWindow.on("move", () => {
      if (this.window === createdWindow) {
        this.queueCompactPositionSave();
      }
    });
    createdWindow.on("close", () => {
      if (this.window !== createdWindow) {
        return;
      }
      this.quitting = true;
    });
    createdWindow.on("closed", () => {
      if (this.window === createdWindow) {
        if (this.renderedModeWaiter) {
          clearTimeout(this.renderedModeWaiter.timeout);
          this.renderedModeWaiter.resolve();
          this.renderedModeWaiter = null;
        }
        screen.removeListener(
          "display-metrics-changed",
          this.handleDisplayChange,
        );
        this.window = null;
      }
    });
    screen.on("display-metrics-changed", this.handleDisplayChange);

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      void createdWindow.loadURL(devServerUrl);
    } else {
      void createdWindow.loadFile(
        path.join(__dirname, "../../dist/index.html"),
      );
    }

    return createdWindow;
  }

  getWindow(): BrowserWindow | null {
    return this.window;
  }

  getMode(): WindowMode {
    return this.mode;
  }

  rendererModeRendered(mode: WindowMode, transitionId?: number): void {
    if (transitionId === undefined) {
      this.lastRenderedMode = mode;
      void this.maybeActivateInitialMode();
    }
    if (
      this.renderedModeWaiter?.mode === mode &&
      this.renderedModeWaiter.transitionId === transitionId
    ) {
      clearTimeout(this.renderedModeWaiter.timeout);
      this.renderedModeWaiter.resolve();
      this.renderedModeWaiter = null;
    }
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

    const leavingTaskbar =
      this.mode === "taskbar" && this.taskbarEmbedded;

    if (leavingTaskbar) {
      this.window.setOpacity(0);
      this.window.hide();
      await detachFromWindowsTaskbar(this.window);
      this.taskbarEmbedded = false;
      this.mode = nextMode;
      await this.settingsStore.update({ windowMode: nextMode });
      this.replaceWindow();
      return this.mode;
    }

    this.window.setOpacity(0);

    if (this.mode === "full") {
      this.fullBounds = this.window.getBounds();
    } else if (this.mode === "compact") {
      await this.saveCompactPosition();
    }

    this.mode = nextMode;
    this.prepareMode();
    this.window.showInactive();

    await this.renderMode(nextMode);

    const applied = await this.revealMode();
    if (!applied && nextMode === "taskbar") {
      this.mode = "full";
      this.prepareMode();
      this.window.showInactive();
      await this.renderMode("full");
      await this.revealMode();
    }
    await this.settingsStore.update({ windowMode: this.mode });
    return this.mode;
  }

  async cycleMode(): Promise<WindowMode> {
    const settings = this.settingsStore.get();
    return this.setMode(
      getNextWindowMode(this.mode, settings.taskbarModeEnabled),
    );
  }

  moveCompactBy(deltaX: number, deltaY: number): void {
    if (!this.window || this.mode !== "compact") {
      return;
    }

    const [x, y] = this.window.getPosition();
    this.window.setPosition(x + deltaX, y + deltaY, false);
  }

  minimize(): void {
    this.window?.minimize();
  }

  showExistingWindow(): void {
    if (!this.window) {
      return;
    }

    if (this.window.isMinimized()) {
      this.window.restore();
    }
    this.window.show();
    this.window.focus();
  }

  toggleMaximize(): boolean {
    if (!this.window || this.mode !== "full") {
      return false;
    }

    if (this.window.isMaximized()) {
      this.window.unmaximize();
      return false;
    }

    this.window.maximize();
    return true;
  }

  close(): void {
    this.quitting = true;
    app.quit();
  }

  prepareToQuit(): void {
    this.quitting = true;
  }

  private readonly handleDisplayChange = () => {
    if (this.mode === "taskbar" && this.window) {
      void this.repositionTaskbarWindow();
    } else if (this.mode === "compact") {
      this.ensureWindowIsVisible();
    }
  };

  private async activateInitialMode(): Promise<void> {
    if (!this.window) {
      return;
    }

    this.window.setOpacity(0);
    this.prepareMode();
    this.window.showInactive();
    await this.renderMode(this.mode);

    const applied = await this.revealMode();
    if (!applied && this.mode === "taskbar") {
      this.mode = "full";
      this.prepareMode();
      this.window.showInactive();
      await this.renderMode("full");
      await this.revealMode();
      await this.settingsStore.update({ windowMode: "full" });
    }
  }

  private prepareMode(): void {
    if (!this.window) {
      return;
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
      return;
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
      return;
    }

    const taskbarBounds = this.getTaskbarOverlayBounds();
    this.window.setSkipTaskbar(true);
    this.window.setMovable(false);
    this.window.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: false,
    });
    this.window.setMinimumSize(taskbarBounds.width, taskbarBounds.height);
    this.window.setBounds(taskbarBounds);
  }

  private async revealMode(): Promise<boolean> {
    if (!this.window) {
      return false;
    }

    if (this.mode !== "taskbar") {
      this.window.webContents.invalidate();
      this.window.setOpacity(1);
      this.window.show();
      this.window.focus();
      return true;
    }

    const taskbarBounds = this.getTaskbarOverlayBounds();
    this.window.webContents.invalidate();
    this.taskbarEmbedded = await this.embedTaskbarWindow(taskbarBounds);
    if (this.taskbarEmbedded) {
      this.window.setOpacity(1);
    }
    return this.taskbarEmbedded;
  }

  private async maybeActivateInitialMode(): Promise<void> {
    if (
      this.initialModeActivated ||
      !this.nativeWindowReady ||
      this.lastRenderedMode === null
    ) {
      return;
    }

    this.initialModeActivated = true;
    await this.activateInitialMode();
  }

  private async renderMode(mode: WindowMode): Promise<void> {
    if (!this.window) {
      return;
    }

    const transitionId = ++this.nextTransitionId;
    const rendererReady = this.waitForRenderedMode(mode, transitionId);
    this.window.webContents.send(
      "window:mode-changed",
      mode,
      transitionId,
    );
    await rendererReady;
  }

  private replaceWindow(): void {
    const previousWindow = this.window;
    if (!previousWindow) {
      return;
    }

    if (this.renderedModeWaiter) {
      clearTimeout(this.renderedModeWaiter.timeout);
      this.renderedModeWaiter.resolve();
      this.renderedModeWaiter = null;
    }

    screen.removeListener(
      "display-metrics-changed",
      this.handleDisplayChange,
    );
    this.createWindow();

    previousWindow.removeAllListeners("close");
    previousWindow.destroy();
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
    const width = 96;
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

    this.window.setOpacity(0);
    if (this.taskbarEmbedded) {
      await detachFromWindowsTaskbar(this.window);
      this.taskbarEmbedded = false;
    }

    const taskbarBounds = this.getTaskbarOverlayBounds();
    this.window.setBounds(taskbarBounds);
    this.taskbarEmbedded = await this.embedTaskbarWindow(taskbarBounds);
    if (this.taskbarEmbedded) {
      this.window.setOpacity(1);
    } else {
      await this.setMode("full");
    }
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

  private waitForRenderedMode(
    mode: WindowMode,
    transitionId?: number,
  ): Promise<void> {
    if (
      transitionId === undefined &&
      this.lastRenderedMode === mode
    ) {
      return Promise.resolve();
    }

    if (this.renderedModeWaiter) {
      clearTimeout(this.renderedModeWaiter.timeout);
      this.renderedModeWaiter.resolve();
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (
          this.renderedModeWaiter?.mode === mode &&
          this.renderedModeWaiter.transitionId === transitionId
        ) {
          this.renderedModeWaiter = null;
        }
        resolve();
      }, 1_000);
      timeout.unref();
      this.renderedModeWaiter = {
        mode,
        transitionId,
        resolve,
        timeout,
      };
    });
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
