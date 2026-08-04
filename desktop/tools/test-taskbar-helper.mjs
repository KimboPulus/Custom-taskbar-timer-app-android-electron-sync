import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildScript = path.join(root, "tools", "build-taskbar-helper.mjs");
const helper = path.join(root, "native", "bin", "FocusTimerTaskbarHost.exe");

if (process.platform !== "win32") {
  console.log("Skipping Windows taskbar helper tests on this platform.");
  process.exit(0);
}

const build = spawnSync(process.execPath, [buildScript], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});

if (build.status !== 0) {
  throw new Error(build.stderr || build.stdout || "Taskbar helper build failed.");
}

if (!existsSync(helper)) {
  throw new Error(`Taskbar helper was not built at ${helper}.`);
}

const cases = [
  {
    name: "rejects allow-shortcut arguments",
    args: ["allow-shortcut", "extra"],
    status: 1,
  },
  {
    name: "rejects wait-shortcut-release without accelerator",
    args: ["wait-shortcut-release"],
    status: 1,
  },
  {
    name: "accepts release wait for a supported shortcut key",
    args: ["wait-shortcut-release", "Control+Alt+F24"],
    status: 0,
  },
  {
    name: "rejects unsupported shortcut key",
    args: ["wait-shortcut-release", "Control+Alt+VolumeUp"],
    status: 1,
  },
  {
    name: "rejects unknown command",
    args: ["unknown", "1"],
    status: 1,
  },
];

for (const testCase of cases) {
  const result = spawnSync(helper, testCase.args, {
    cwd: root,
    encoding: "utf8",
    timeout: 2000,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== testCase.status) {
    throw new Error(
      `${testCase.name} exited with ${result.status}; expected ${testCase.status}.\n${result.stderr}${result.stdout}`,
    );
  }
}

console.log("C++ taskbar helper tests passed.");
