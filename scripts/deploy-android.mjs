import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

console.log('🚀 Building web app...');
execSync('npm run build', { stdio: 'inherit' });

console.log('📱 Syncing Capacitor web assets to Android...');
execSync('npx cap sync android', { stdio: 'inherit' });

// Ensure JAVA_HOME is set (fallback to valid Android Studio JBR if available)
if (!process.env.JAVA_HOME) {
  const candidatePaths = [
    'C:\\Program Files\\Android\\Android Studio1\\jbr',
    'C:\\Program Files\\Android\\Android Studio\\jbr',
  ];
  for (const candidate of candidatePaths) {
    if (fs.existsSync(path.join(candidate, 'lib', 'jvm.cfg')) || fs.existsSync(path.join(candidate, 'bin', 'java.exe'))) {
      // Check if this java executable actually works
      try {
        execSync(`"${path.join(candidate, 'bin', 'java.exe')}" -version`, { stdio: 'ignore' });
        process.env.JAVA_HOME = candidate;
        break;
      } catch {
        // Skip invalid JDK
      }
    }
  }
}

console.log('⚙️ Building Android APK via Gradle...');
const androidDir = path.resolve(process.cwd(), 'android');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug';
execSync(gradlewCmd, { cwd: androidDir, stdio: 'inherit', env: { ...process.env, JAVA_HOME: process.env.JAVA_HOME } });

console.log('📲 Checking connected Android phone via ADB...');
const adbPath = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';

const devicesOutput = execSync(`"${adbPath}" devices`, { encoding: 'utf-8' });
const connectedDevices = devicesOutput
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('List of devices') && !line.startsWith('*'));

if (connectedDevices.length === 0) {
  console.log('\n⚠️ No active ADB device connection detected.');
  console.log('📲 Attempting direct file copy to phone via MTP (Windows File Transfer)...');
  
  const apkPath = path.resolve(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  
  try {
    const psCommand = `
      $shell = New-Object -ComObject Shell.Application;
      $phone = $shell.Namespace(17).Items() | Where-Object { $_.Name -match "S24" -or $_.Name -match "Lautaro" -or $_.Name -match "Galaxy" -or $_.Name -match "Phone" -or $_.Name -match "Android" };
      if ($phone) {
        $storage = ($phone.GetFolder.Items() | Where-Object { $_.Name -match "Internal" -or $_.Name -match "Almacenamiento" }).GetFolder;
        $downloadFolder = $storage.Items() | Where-Object { $_.Name -eq "Download" -or $_.Name -eq "Descargas" };
        if ($downloadFolder) {
          $downloadFolder.GetFolder.CopyHere("${apkPath.replace(/\\/g, '\\\\')}", 16);
          Write-Output "COPIED_SUCCESS";
        }
      }
    `;
    const result = execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`, { encoding: 'utf-8' });
    if (result.includes('COPIED_SUCCESS')) {
      console.log('\n🎉 ¡APK copiada directamente a la carpeta Downloads de tu celular!');
      console.log('👉 Abrí "Mis Archivos" ➔ "Descargas" en tu S24 Ultra y tocá "app-debug.apk" para instalarla.');
      process.exit(0);
    }
  } catch (err) {
    // MTP copy failed, show instructions
  }

  console.error('\n❌ No Android device found via ADB!');
  console.error('👉 Connect your phone via USB with USB Debugging enabled, or set up Wireless ADB.');
  console.log(`\n📦 APK successfully built at: ${apkPath}`);
  process.exit(1);
}

const apkPath = path.resolve(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
console.log(`📲 Installing ${apkPath} to connected device...`);
execSync(`"${adbPath}" install -r "${apkPath}"`, { stdio: 'inherit' });

console.log('✅ MorphIQ successfully updated on your Android phone!');
