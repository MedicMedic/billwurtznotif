# Builds the upload-key-signed release APK and updates the app on the connected phone in place.
# Keeps app data (no uninstall) as long as the same upload key signs every build.
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'C:\Users\maria\AppData\Local\Android\Sdk'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

Push-Location "$PSScriptRoot\android"
try {
  .\gradlew.bat assembleRelease
  if ($LASTEXITCODE -ne 0) { throw 'build failed' }
} finally { Pop-Location }

adb install -r "$PSScriptRoot\android\app\build\outputs\apk\release\app-release.apk"
adb shell monkey -p com.billwurtznotif -c android.intent.category.LAUNCHER 1 | Out-Null
