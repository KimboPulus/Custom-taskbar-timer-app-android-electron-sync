import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = path.join(root, "native");
const outputDir = path.join(nativeRoot, "bin");
const output = path.join(outputDir, "FocusTimerTaskbarHost.exe");

if (process.platform !== "win32") {
  console.log("Skipping Windows taskbar helper build on this platform.");
  process.exit(0);
}

const goCandidates = [
  process.env.GOROOT && path.join(process.env.GOROOT, "bin", "go.exe"),
  "D:\\tools\\go\\bin\\go.exe",
  "go",
].filter(Boolean);
const go = goCandidates.find((candidate) => {
  if (path.isAbsolute(candidate) && !existsSync(candidate)) {
    return false;
  }
  return spawnSync(candidate, ["version"], { windowsHide: true }).status === 0;
});

if (!go) {
  throw new Error("Go was not found. Install Go or set GOROOT before building.");
}

mkdirSync(outputDir, { recursive: true });
const result = spawnSync(
  go,
  ["build", "-trimpath", "-ldflags=-s -w", "-o", output, "."],
  {
    cwd: nativeRoot,
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      CGO_ENABLED: "0",
      GOOS: "windows",
      GOARCH: "amd64",
    },
  },
);

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Taskbar helper build failed.");
}

console.log(`Built ${output}`);
