import { execSync } from 'child_process';
import path from 'path';

const javaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const sdkRoot = 'C:\\Users\\PC\\AppData\\Local\\Android\\Sdk';
const sdkManager = path.join(sdkRoot, 'cmdline-tools', 'latest', 'bin', 'sdkmanager.bat');

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')};${process.env.PATH}`,
};

console.log('Installing Google USB Driver...');
try {
  execSync(`echo y | "${sdkManager}" --sdk_root="${sdkRoot}" "extras;google;usb_driver"`, {
    env,
    stdio: 'inherit',
  });
  console.log('✅ Google USB Driver installed successfully!');
} catch (err) {
  console.error('Failed to run sdkmanager:', err.message);
}
