import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morphiq.app',
  appName: 'MorphIQ',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
