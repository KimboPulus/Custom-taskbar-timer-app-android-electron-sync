import { existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = path.join(root, "native");
const outputDir = path.join(nativeRoot, "bin");
const output = path.join(outputDir, "FocusTimerTaskbarHost.exe");
const objectOutput = path.join(outputDir, "FocusTimerTaskbarHost.obj");
const source = path.join(nativeRoot, "taskbar_host.cpp");

if (process.platform !== "win32") {
  console.log("Skipping Windows taskbar helper build on this platform.");
  process.exit(0);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
}

function findVsWhere() {
  return [
    path.join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft Visual Studio", "Installer", "vswhere.exe"),
    path.join(process.env.ProgramFiles ?? "", "Microsoft Visual Studio", "Installer", "vswhere.exe"),
  ].find((candidate) => candidate && existsSync(candidate));
}

function findVsDevCmd() {
  if (process.env.VSDEVCMD && existsSync(process.env.VSDEVCMD)) {
    return process.env.VSDEVCMD;
  }

  const vsWhere = findVsWhere();
  if (vsWhere) {
    const result = run(vsWhere, [
      "-latest",
      "-products",
      "*",
      "-requires",
      "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
      "-property",
      "installationPath",
    ]);
    const installPath = result.stdout.trim();
    if (result.status === 0 && installPath) {
      const candidate = path.join(installPath, "Common7", "Tools", "VsDevCmd.bat");
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return [
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\Tools\\VsDevCmd.bat",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\18\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat",
  ].find((candidate) => existsSync(candidate));
}

function buildWithCurrentEnvironment() {
  const canRunCl = run("cl.exe", ["/?"], { stdio: "ignore" }).status === 0;
  if (!canRunCl) {
    return false;
  }

  const result = run("cl.exe", [
    "/nologo",
    "/std:c++20",
    "/EHsc",
    "/O2",
    "/MT",
    "/W4",
    "/DUNICODE",
    "/D_UNICODE",
    `/Fe:${output}`,
    `/Fo:${objectOutput}`,
    source,
    "user32.lib",
    "kernel32.lib",
  ]);

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Taskbar helper build failed.");
  }

  return true;
}

function buildWithVsDevCmd(vsDevCmd) {
  const command = [
    "/d",
    "/c",
    "call",
    vsDevCmd,
    "-arch=amd64",
    "-host_arch=amd64",
    ">nul",
    "&&",
    "cl.exe",
    "/nologo",
    "/std:c++20",
    "/EHsc",
    "/O2",
    "/MT",
    "/W4",
    "/DUNICODE",
    "/D_UNICODE",
    `/Fe:${output}`,
    `/Fo:${objectOutput}`,
    source,
    "user32.lib",
    "kernel32.lib",
  ];

  const result = run("cmd.exe", command);
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Taskbar helper build failed.");
  }
}

mkdirSync(outputDir, { recursive: true });

if (!buildWithCurrentEnvironment()) {
  const vsDevCmd = findVsDevCmd();
  if (!vsDevCmd) {
    throw new Error("MSVC C++ build tools were not found. Install Visual Studio Build Tools with the C++ workload.");
  }
  buildWithVsDevCmd(vsDevCmd);
}

const selfTest = run(output, ["--self-test"]);
if (selfTest.status !== 0) {
  throw new Error(selfTest.stderr || selfTest.stdout || "Taskbar helper self-test failed.");
}

console.log(`Built ${output}`);
