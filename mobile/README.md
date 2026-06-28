# Focus Timer Mobile React Native

React Native + TypeScript Android companion for the existing Electron Focus Timer app.
Timer, plan, streak, validation, and sync-client logic run in TypeScript. The
Android directory only contains the native React Native bootstrap and build files.

The Electron desktop app is the sync host. When it launches, it exposes:

```text
http://<your-pc-ip>:5278
```

The mobile app stores timer/plan state locally, auto-syncs when opened/resumed, and can manually sync with `Sync now`.

No Firebase, no cloud sync, no third-party service.

## Paths

```text
D:\Visual Studio projects\Custom-taskbar-timer-app-android-electron-sync\mobile
D:\ftrepo
D:\Visual Studio projects\Custom-taskbar-timer-app-android-electron-sync\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Tooling used:

```text
D:\Tools\Node\node-22
D:\Tools\Java\jdk-17
D:\Android\Sdk
D:\GradleHome
D:\npm-cache
```

## Build APK

```powershell
.\scripts\build-android.ps1
```

The script creates `D:\ftrepo` as a junction to this repo and builds through that
short path. React Native 0.86 uses native codegen/CMake on Android, and building
from the long `D:\Visual Studio projects\...` path can hit Windows/Ninja path
limits.

## Install On Connected Phone

```powershell
.\scripts\install-android.ps1
```

Or manually:

```powershell
adb install -r "D:\Visual Studio projects\Custom-taskbar-timer-app-android-electron-sync\mobile\artifacts\FocusTimer-RN-debug.apk"
```

## Use

1. Launch Electron Focus Timer on Windows.
2. Make sure phone and PC are on the same Wi-Fi.
3. In the phone app, set server URL to your PC IP:

```text
http://192.168.1.50:5278
```

4. The app auto-syncs on launch/resume. `Sync now` forces it.

For Android emulator, use:

```text
http://10.0.2.2:5278
```
