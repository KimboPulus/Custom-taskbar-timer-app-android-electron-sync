$ErrorActionPreference = "Stop"

function Assert-LastCommandSucceeded {
    param([string]$Step)
    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE."
    }
}

$mobileRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $mobileRoot
$shortRepoRoot = "D:\ftrepo"
$shortMobileRoot = Join-Path $shortRepoRoot "mobile"

if (Test-Path "D:\Tools\Node\node-22") {
    $env:PATH = "D:\Tools\Node\node-22;$env:PATH"
}
if (Test-Path "D:\Tools\Java\jdk-17") {
    $env:JAVA_HOME = "D:\Tools\Java\jdk-17"
}
if (Test-Path "D:\Android\Sdk") {
    $env:ANDROID_HOME = "D:\Android\Sdk"
    $env:ANDROID_SDK_ROOT = "D:\Android\Sdk"
    $env:PATH = "D:\Android\Sdk\platform-tools;$env:PATH"
}
if (Test-Path "D:\GradleHome") {
    $env:GRADLE_USER_HOME = "D:\GradleHome"
}
if (Test-Path "D:\npm-cache") {
    $env:npm_config_cache = "D:\npm-cache"
}

if (-not (Test-Path -LiteralPath $shortRepoRoot)) {
    New-Item -ItemType Junction -Path $shortRepoRoot -Target $repoRoot | Out-Null
}

Push-Location $shortMobileRoot
try {
    & npx.cmd tsc --noEmit
    Assert-LastCommandSucceeded "TypeScript validation"
    & npm.cmd test -- --runInBand
    Assert-LastCommandSucceeded "React Native tests"

    New-Item -ItemType Directory -Force -Path ".\android\app\src\main\assets" | Out-Null
    & npx.cmd react-native bundle `
        --platform android `
        --dev false `
        --entry-file index.js `
        --bundle-output android/app/src/main/assets/index.android.bundle `
        --assets-dest android/app/src/main/res
    Assert-LastCommandSucceeded "React Native bundle"

    & ".\android\gradlew.bat" -p android :app:assembleDebug
    Assert-LastCommandSucceeded "Android Gradle build"

    $artifactDir = Join-Path $mobileRoot "artifacts"
    New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null

    $apk = "$shortMobileRoot\android\app\build\outputs\apk\debug\app-debug.apk"
    $target = Join-Path $artifactDir "FocusTimer-RN-debug.apk"
    Copy-Item -LiteralPath $apk -Destination $target -Force

    Write-Host "APK copied to $target"
}
finally {
    Pop-Location
}
