import { existsSync, mkdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "native", "FocusTimerTaskbarHost.cpp");
const outputDir = path.join(root, "native", "bin");
const output = path.join(outputDir, "FocusTimerTaskbarHost.exe");
const objectFile = path.join(outputDir, "FocusTimerTaskbarHost.obj");
if (process.platform !== "win32") {
  console.log("Skipping Windows taskbar helper build on this platform.");
  process.exit(0);
}

if (
  existsSync(output) &&
  statSync(output).mtimeMs >= statSync(source).mtimeMs
) {
  console.log("Windows taskbar helper is up to date.");
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
const vswhere = path.join(
  process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
  "Microsoft Visual Studio",
  "Installer",
  "vswhere.exe",
);
let command = `cl /nologo /std:c++17 /EHsc /O2 /DUNICODE /D_UNICODE /Fo:"${objectFile}" /Fe:"${output}" "${source}" user32.lib`;

if (spawnSync("where", ["cl"], { windowsHide: true }).status !== 0) {
  if (!existsSync(vswhere)) {
    throw new Error("MSVC Build Tools were not found.");
  }

  const located = spawnSync(
    vswhere,
    ["-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"],
    { encoding: "utf8", windowsHide: true },
  );
  const installationPath = located.stdout.trim();
  if (located.status !== 0 || !installationPath) {
    throw new Error("Visual Studio C++ Build Tools were not found.");
  }
  const developerShell = path.join(installationPath, "Common7", "Tools", "VsDevCmd.bat");
  command = `call "${developerShell}" -arch=x64 -host_arch=x64 && ${command}`;
}

const result = spawnSync(command, [], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
  shell: true,
});

if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || "Taskbar helper build failed.");
}

console.log(`Built ${output}`);
