$ErrorActionPreference = "Stop"

$mobileRoot = Split-Path -Parent $PSScriptRoot
$apk = Join-Path $mobileRoot "artifacts\FocusTimer-RN-debug.apk"
if (-not (Test-Path $apk)) {
    & "$PSScriptRoot\build-android.ps1"
}

if (Test-Path "D:\Android\Sdk\platform-tools") {
    $env:PATH = "D:\Android\Sdk\platform-tools;$env:PATH"
}

& adb.exe install -r $apk
