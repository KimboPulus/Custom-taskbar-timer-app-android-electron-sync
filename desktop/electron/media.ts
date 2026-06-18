import { dialog, type BrowserWindow } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AlarmSound,
  SystemSoundOption,
} from "../src/desktop/desktopTypes.js";

const supportedExtensions = new Set([
  ".wav",
  ".mp3",
  ".m4a",
  ".mp4",
  ".ogg",
  ".webm",
]);

function windowsMediaDirectory(): string {
  return path.join(process.env.WINDIR ?? "C:\\Windows", "Media");
}

function displayName(fileName: string): string {
  return path.basename(fileName, path.extname(fileName));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function listSystemSounds(): Promise<SystemSoundOption[]> {
  try {
    const entries = await fs.readdir(windowsMediaDirectory(), {
      withFileTypes: true,
    });
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          supportedExtensions.has(path.extname(entry.name).toLowerCase()),
      )
      .map((entry) => ({
        id: entry.name,
        label: displayName(entry.name),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  } catch (error) {
    console.warn("Could not enumerate Windows sounds:", error);
    return [];
  }
}

export async function chooseCustomMedia(
  window: BrowserWindow | null,
): Promise<AlarmSound | null> {
  const options: Electron.OpenDialogOptions = {
    title: "Choose timer alarm media",
    properties: ["openFile"],
    filters: [
      {
        name: "Audio or video",
        extensions: ["wav", "mp3", "m4a", "mp4", "ogg", "webm"],
      },
      { name: "All files", extensions: ["*"] },
    ],
  };
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const source = result.filePaths[0];
  return {
    kind: "custom",
    source,
    label: path.basename(source),
  };
}

export async function resolveAlarmUrl(
  sound: AlarmSound,
): Promise<string | null> {
  if (sound.kind === "built-in") {
    return null;
  }

  const filePath =
    sound.kind === "system"
      ? path.join(windowsMediaDirectory(), path.basename(sound.id))
      : sound.source;

  if (!(await fileExists(filePath))) {
    return null;
  }

  return pathToFileURL(filePath).href;
}
