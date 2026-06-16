$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$env:PATH = "D:\Tools\Node\node-22;$env:PATH"
$env:npm_config_cache = "D:\npm-cache"
$env:JAVA_HOME = "D:\Tools\Java\jdk-17"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "D:\Android\Sdk"
$env:GRADLE_USER_HOME = "D:\GradleHome"

Push-Location $repoRoot
try {
    & "D:\Tools\Node\node-22\npx.cmd" tsc --noEmit
    & "D:\Tools\Node\node-22\npm.cmd" test -- --runInBand
    & ".\android\gradlew.bat" -p android :app:assembleDebug

    $artifactDir = "D:\FocusTimerReactNative\artifacts"
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

    $apk = "$repoRoot\android\app\build\outputs\apk\debug\app-debug.apk"
    $target = Join-Path $artifactDir "FocusTimer-RN-debug.apk"
    Copy-Item -LiteralPath $apk -Destination $target -Force

    Write-Host "APK copied to $target"
}
finally {
    Pop-Location
}

