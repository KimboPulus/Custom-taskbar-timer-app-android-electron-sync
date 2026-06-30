import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = path.join(root, "native");
const outputDir = path.join(root, "native", "bin");
const output = path.join(outputDir, "FocusTimerTaskbarHost.exe");
const builtOutput = path.join(
  nativeRoot,
  "target",
  "release",
  "FocusTimerTaskbarHost.exe",
);
if (process.platform !== "win32") {
  console.log("Skipping Windows taskbar helper build on this platform.");
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });

const result = spawnSync("cargo", ["build", "--release"], {
  cwd: nativeRoot,
  encoding: "utf8",
  windowsHide: true,
});

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Taskbar helper build failed.");
}

if (!existsSync(builtOutput)) {
  throw new Error(`Taskbar helper build did not produce ${builtOutput}.`);
}

copyFileSync(builtOutput, output);
console.log(`Built ${output}`);
