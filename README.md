# Focus Timer - Electron + Android Sync

A local-first focus timer for Windows and Android.

The desktop app is built with **Electron, React, TypeScript, and Vite**. It includes a full timer window, compact mode, taskbar timer mode, custom focus blocks, custom alarm audio/video, global shortcuts, and a daily plan calendar.

The Android app is built with **React Native and TypeScript**. It can sync with the desktop app over the local network when the Windows app is running.

No cloud service is required.

## Screenshots

### Android App

![Android app](docs/screenshots/01-android-app.png)

### Desktop Overview

![Desktop app overview](docs/screenshots/02-desktop-overview.png)

### Settings: Custom Audio And Shortcuts

![Settings with custom audio and shortcuts](docs/screenshots/03-settings-audio-shortcuts.png)

### Daily Plan And Calendar

![Daily plan and calendar](docs/screenshots/04-daily-plan-calendar.png)

## Features

- Windows desktop timer with full, compact, and taskbar modes.
- Exact `HH:MM:SS` timer input.
- Custom focus block presets.
- Global keyboard shortcuts.
- Built-in, Windows system, or custom MP4/audio finish alarm.
- Daily plan tracking with calendar history and streak.
- Android companion app.
- Local Wi-Fi sync between Android and Windows.
- Local Git-tracked codebase.

## Project Structure

```text
desktop/   Electron + React + TypeScript desktop app
mobile/    React Native + TypeScript Android companion app
docs/      README screenshots
```

## Desktop Development

```powershell
cd desktop
npm install
npm run dev
```

Build and package the Windows installer:

```powershell
cd desktop
npm run package
```

## Android Development

```powershell
cd mobile
npm install
.\scripts\build-android.ps1
```

Install the APK on a connected Android phone:

```powershell
cd mobile
.\scripts\install-android.ps1
```

## Local Sync

1. Launch the Windows desktop app.
2. Make sure the phone and PC are on the same Wi-Fi network.
3. Find the PC IPv4 address with:

```powershell
ipconfig
```

4. In the Android app, enter:

```text
http://YOUR_PC_IP:5278
```

Example:

```text
http://192.168.0.55:5278
```

The desktop app hosts the local sync API. The Android app pushes its current state and receives the merged desktop snapshot back.

## Notes

This is a solo-dev local productivity project. It is designed for personal use on a trusted local network.

For stronger security, the next step would be adding a pairing token so only approved phones can sync with the desktop app.
