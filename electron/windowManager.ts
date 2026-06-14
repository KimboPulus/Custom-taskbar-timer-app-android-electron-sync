import { BrowserWindow, screen } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CompactPosition } from "../src/desktop/desktopTypes.js";
import type { SettingsStore } from "./settingsStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FULL_SIZE = { width: 900, height: 620 };
const COMPACT_SIZE = { width: 240, height: 180 };

export class WindowManager {
  private window: BrowserWindow | null = null;
  private compactMode = false;
  private fullBounds: Electron.Rectangle | null = null;
  private savePositionTimer: NodeJS.Timeout | null = null;

  constructor(private readonly settingsStore: SettingsStore) {}

  createWindow(): BrowserWindow {
    const settings = this.settingsStore.get();
    this.compactMode = settings.compactMode;

    this.window = new BrowserWindow({
      width: this.compactMode ? COMPACT_SIZE.width : FULL_SIZE.width,
      height: this.compactMode ? COMPACT_SIZE.height : FULL_SIZE.height,
      minWidth: this.compactMode ? COMPACT_SIZE.width : 700,
      minHeight: this.compactMode ? COMPACT_SIZE.height : 500,
      x: this.compactMode ? settings.compactPosition?.x : undefined,
      y: this.compactMode ? settings.compactPosition?.y : undefined,
      show: false,
      frame: false,
      transparent: false,
      backgroundColor: "#f5f7f7",
      alwaysOnTop: this.compactMode,
      skipTaskbar: false,
      resizable: !this.compactMode,
      maximizable: !this.compactMode,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.ensureWindowIsVisible();
    if (this.compactMode) {
      this.window.setAlwaysOnTop(true, "screen-saver", 1);
    }
    this.window.on("ready-to-show", () => this.window?.show());
    this.window.on("move", () => this.queueCompactPositionSave());
    this.window.on("closed", () => {
      this.window = null;
    });

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

  isCompact(): boolean {
    return this.compactMode;
  }

  async enterCompactMode(): Promise<void> {
    if (!this.window || this.compactMode) {
      return;
    }

    this.fullBounds = this.window.getBounds();
    this.compactMode = true;
    const position = this.settingsStore.get().compactPosition;

    this.window.unmaximize();
    this.window.setMinimumSize(COMPACT_SIZE.width, COMPACT_SIZE.height);
    this.window.setResizable(false);
    this.window.setMaximizable(false);
    this.window.setSkipTaskbar(false);
    this.window.setAlwaysOnTop(true, "screen-saver", 1);
    this.window.setBounds({
      width: COMPACT_SIZE.width,
      height: COMPACT_SIZE.height,
      ...(position ?? {}),
    });
    this.ensureWindowIsVisible();
    await this.settingsStore.update({ compactMode: true });
  }

  async exitCompactMode(): Promise<void> {
    if (!this.window || !this.compactMode) {
      return;
    }

    await this.saveCompactPosition();
    this.compactMode = false;
    this.window.setAlwaysOnTop(false);
    this.window.setSkipTaskbar(false);
    this.window.setResizable(true);
    this.window.setMaximizable(true);
    this.window.setMinimumSize(700, 500);
    this.window.setBounds(this.fullBounds ?? {
      ...FULL_SIZE,
      x: Math.round((screen.getPrimaryDisplay().workArea.width - FULL_SIZE.width) / 2),
      y: Math.round((screen.getPrimaryDisplay().workArea.height - FULL_SIZE.height) / 2),
    });
    this.ensureWindowIsVisible();
    await this.settingsStore.update({ compactMode: false });
  }

  async toggleCompactMode(): Promise<void> {
    if (this.compactMode) {
      await this.exitCompactMode();
    } else {
      await this.enterCompactMode();
    }
  }

  minimize(): void {
    this.window?.minimize();
  }

  close(): void {
    this.window?.close();
  }

  private queueCompactPositionSave(): void {
    if (!this.compactMode) {
      return;
    }

    if (this.savePositionTimer) {
      clearTimeout(this.savePositionTimer);
    }
    this.savePositionTimer = setTimeout(() => void this.saveCompactPosition(), 250);
  }

  private async saveCompactPosition(): Promise<void> {
    if (!this.window || !this.compactMode) {
      return;
    }

    const bounds = this.window.getBounds();
    const compactPosition: CompactPosition = { x: bounds.x, y: bounds.y };
    await this.settingsStore.update({ compactPosition });
  }

  private ensureWindowIsVisible(): void {
    if (!this.window) {
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
