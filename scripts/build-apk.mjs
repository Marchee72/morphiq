import { execSync } from 'child_process';
import path from 'path';

const javaHome = 'C:\\Program Files\\Android\\Android Studio1\\jbr';
const androidDir = path.resolve(process.cwd(), 'android');

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')};${process.env.PATH}`,
};

console.log('Building Release APK with Android Studio JDK...');
execSync('.\\gradlew.bat assembleRelease', {
  cwd: androidDir,
  env,
  stdio: 'inherit',
});
console.log('✅ Release APK built successfully!');
