import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { AltGrGuard } from "../src/desktop/altGrGuard.js";
import { getTaskbarHelperPath } from "./taskbarHost.js";

export class ModifierMonitor {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private readonly altGrGuard = new AltGrGuard();

  start(): void {
    if (process.platform !== "win32" || this.child) {
      return;
    }

    const child = spawn(getTaskbarHelperPath(), ["monitor-right-alt"], {
      windowsHide: true,
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.consume(chunk));
    child.on("error", (error) => {
      console.warn("Could not monitor right Alt state:", error);
    });
    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
      }
    });
  }

  allowsExplicitShortcut(): boolean {
    return this.altGrGuard.allowsShortcut();
  }

  stop(): void {
    const child = this.child;
    this.child = null;
    this.buffer = "";
    child?.kill();
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line === "down" || line === "up") {
        this.altGrGuard.update(line === "down");
      }
    }
  }
}
