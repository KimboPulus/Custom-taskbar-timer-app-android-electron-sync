import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { getTaskbarHelperPath } from "./taskbarHost.js";

const fallbackUnlockMs = 750;

type Lock = {
  child: ChildProcessWithoutNullStreams | null;
  timer: NodeJS.Timeout;
};

function lockKey(accelerator: string): string {
  return accelerator.trim().toLowerCase();
}

export class ShortcutRepeatGuard {
  private readonly locks = new Map<string, Lock>();

  isLocked(accelerator: string): boolean {
    return this.locks.has(lockKey(accelerator));
  }

  claimPress(accelerator: string): boolean {
    const key = lockKey(accelerator);
    const existing = this.locks.get(key);
    if (existing) {
      if (!existing.child) {
        clearTimeout(existing.timer);
        existing.timer = setTimeout(() => this.unlock(key), fallbackUnlockMs);
      }
      return false;
    }

    this.lockUntilReleased(accelerator);
    return true;
  }

  lockUntilReleased(accelerator: string): void {
    const key = lockKey(accelerator);
    if (this.locks.has(key)) {
      return;
    }

    if (process.platform !== "win32") {
      this.lockWithTimer(key, fallbackUnlockMs);
      return;
    }

    let child: ChildProcessWithoutNullStreams | null = null;
    const timer = setTimeout(() => this.unlock(key), 15_000);
    try {
      child = spawn(getTaskbarHelperPath(), ["wait-shortcut-release", accelerator], {
        windowsHide: true,
      });
    } catch {
      clearTimeout(timer);
      this.lockWithTimer(key, fallbackUnlockMs);
      return;
    }

    this.locks.set(key, { child, timer });
    child.on("exit", () => this.unlock(key));
    child.on("error", () => this.unlock(key));
  }

  clear(): void {
    for (const key of this.locks.keys()) {
      this.unlock(key);
    }
  }

  private lockWithTimer(key: string, delayMs: number): void {
    const timer = setTimeout(() => this.unlock(key), delayMs);
    this.locks.set(key, { child: null, timer });
  }

  private unlock(key: string): void {
    const lock = this.locks.get(key);
    if (!lock) {
      return;
    }

    this.locks.delete(key);
    clearTimeout(lock.timer);
    lock.child?.kill();
  }
}
