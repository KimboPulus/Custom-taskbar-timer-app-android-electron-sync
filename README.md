# Focus Timer

A small, local Windows timer built with TypeScript, Electron, React, and Vite.
It has a full timer workspace and a compact always-on-top mode for keeping the
remaining time visible while working.

## Features

- Drift-resistant timestamp-based timer with idle, running, paused, and
  finished states
- Full and compact floating window modes
- Removable focus blocks with exact `HH:MM:SS` durations
- Direct timer editing by clicking the displayed time
- Global Windows shortcuts
- Built-in, Windows, or custom MP4/audio finish alarms
- Adjustable alarm volume with a 30-second custom-media limit
- Desktop finish notification
- Light, dark, and system themes
- Local JSON settings with remembered compact window position
- Live timer state restored after completely quitting the app
- Secure preload bridge with context isolation and no renderer Node access

## Keyboard shortcuts

| Action | Default shortcut |
| --- | --- |
| Play or pause | `Ctrl + Alt + Space` |
| Toggle compact mode | `Ctrl + Alt + T` |
| Reset | `Ctrl + Alt + R` |
| Add one minute | `Ctrl + Alt + Up` |
| Subtract one minute | `Ctrl + Alt + Down` |

Shortcuts can be changed in Settings. A warning appears there when Windows or
another app has already reserved a shortcut.

## Development

Requirements: Node.js 22.12 or newer and npm.

```powershell
npm install
npm run dev
```

Build and test:

```powershell
npm run build
```

Create a Windows installer:

```powershell
npm run package
```

The packaged executable is written to `release/`.

## Architecture

- `electron/` owns app lifecycle, BrowserWindow behavior, global shortcuts,
  notifications, and settings file access.
- `src/timer/` contains pure timer transitions and the React timer store.
- `src/components/` contains the full, compact, and settings interfaces.
- `src/desktop/` defines the narrow API exposed by `preload.ts`.

The renderer never receives the Electron module or Node.js APIs.

## Full and compact modes

Full mode is a resizable 900 by 620 workspace with duration controls and
settings. Compact mode resizes the same renderer to a 240 by 180 always-on-top
window, preserving the active timer without synchronization between windows.
The last compact position is saved automatically.

## Known limitations

- The installer build is Windows x64 only.
- A global shortcut cannot be used when another application has already
  registered the same key combination.
