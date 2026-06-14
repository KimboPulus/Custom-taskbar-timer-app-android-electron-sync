import { existsSync, mkdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "native", "FocusTimerTaskbarHost.cs");
const outputDir = path.join(root, "native", "bin");
const output = path.join(outputDir, "FocusTimerTaskbarHost.exe");
const compilerCandidates = [
  "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe",
  "C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe",
];
const compiler = compilerCandidates.find(existsSync);

if (process.platform !== "win32") {
  console.log("Skipping Windows taskbar helper build on this platform.");
  process.exit(0);
}

if (!compiler) {
  throw new Error("The Windows C# compiler was not found.");
}

if (
  existsSync(output) &&
  statSync(output).mtimeMs >= statSync(source).mtimeMs
) {
  console.log("Windows taskbar helper is up to date.");
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
const result = spawnSync(
  compiler,
  [
    "/nologo",
    "/target:exe",
    "/platform:x64",
    "/optimize+",
    `/out:${output}`,
    source,
  ],
  {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  },
);

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Taskbar helper build failed.");
}

console.log(`Built ${output}`);
