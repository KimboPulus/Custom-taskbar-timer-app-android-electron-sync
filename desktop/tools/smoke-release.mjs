import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = path.join(root, "release");
const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const version = packageJson.version;

function assertFile(relativePath, minimumBytes) {
  const filePath = path.join(releaseDir, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`Release smoke failed: missing ${filePath}`);
  }

  const size = statSync(filePath).size;
  if (size < minimumBytes) {
    throw new Error(
      `Release smoke failed: ${filePath} is ${size} bytes, expected at least ${minimumBytes}`,
    );
  }

  console.log(`Verified ${relativePath} (${size} bytes)`);
}

if (process.platform === "win32") {
  assertFile(`Focus-Timer-Setup-${version}.exe`, 50_000_000);
  assertFile(`Focus-Timer-Setup-${version}.exe.blockmap`, 1_000);
} else if (process.platform === "linux") {
  assertFile(`Focus-Timer-${version}-linux-x86_64.AppImage`, 50_000_000);
  assertFile(`Focus-Timer-${version}-linux-amd64.deb`, 10_000_000);
  assertFile(`Focus-Timer-${version}-linux-x86_64.rpm`, 10_000_000);
} else {
  console.log(`No release smoke assertions for ${process.platform}.`);
}
