# Desktop release process

Desktop releases use tags named `desktop-v<package-version>`. Workflow
`.github/workflows/desktop-release.yml` builds Windows and Linux packages in a
matrix, uploads intermediate artifacts, then creates one GitHub Release.

## Before tagging

From `desktop/`:

```powershell
npm ci
npm run verify
npm run package:win
npm run smoke:release
```

Windows packaging exercises TypeScript, Vitest, native taskbar-helper tests,
renderer and Electron builds, NSIS packaging, and the packaged-app smoke probe.
Linux packages are built on the Linux CI runner.

## Tag invariant

`desktop/package.json` version must match the tag:

```powershell
$version = (Get-Content desktop/package.json | ConvertFrom-Json).version
git tag "desktop-v$version"
git push origin "desktop-v$version"
```

The workflow refuses to publish until verification and artifact smoke tests pass.
Release assets are the installable `.exe`, `.AppImage`, `.deb`, and `.rpm` files,
not source archives alone.
