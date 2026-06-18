$ErrorActionPreference = "Stop"

$apk = "D:\FocusTimerReactNative\artifacts\FocusTimer-RN-debug.apk"
if (-not (Test-Path $apk)) {
    & "$PSScriptRoot\build-android.ps1"
}

& "D:\Android\Sdk\platform-tools\adb.exe" install -r $apk

