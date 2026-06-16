# Focus Timer Mobile React Native

React Native + TypeScript Android companion for the existing Electron Focus Timer app.
The app code is TypeScript/React Native, and the small Android host shell is Java.

The Electron desktop app is the sync host. When it launches, it exposes:

```text
http://<your-pc-ip>:5278
```

The mobile app stores timer/plan state locally, auto-syncs when opened/resumed, and can manually sync with `Sync now`.

No Firebase, no cloud sync, no third-party service.

## Paths

```text
D:\Visual Studio projects\focus-timer-mobile-rn
D:\FocusTimerReactNative\artifacts\FocusTimer-RN-debug.apk
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

## Install On Connected Phone

```powershell
.\scripts\install-android.ps1
```

Or manually:

```powershell
D:\Android\Sdk\platform-tools\adb.exe install -r "D:\FocusTimerReactNative\artifacts\FocusTimer-RN-debug.apk"
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
