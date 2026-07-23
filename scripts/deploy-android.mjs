import { execSync } from 'child_process';
import path from 'path';

console.log('🚀 Building web app...');
execSync('npm run build', { stdio: 'inherit' });

console.log('📱 Syncing Capacitor web assets to Android...');
execSync('npx cap sync android', { stdio: 'inherit' });

console.log('⚙️ Building Android APK via Gradle...');
const androidDir = path.resolve(process.cwd(), 'android');
const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat assembleDebug' : './gradlew assembleDebug';
execSync(gradlewCmd, { cwd: androidDir, stdio: 'inherit' });

console.log('📲 Installing update to connected Android phone via ADB...');
const adbPath = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe')
  : 'adb';

const apkPath = path.resolve(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
execSync(`"${adbPath}" install -r "${apkPath}"`, { stdio: 'inherit' });

console.log('✅ MorphIQ successfully updated on your Android phone!');
