import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.morphiq.app2',
  appName: 'MorphIQ',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  }
};

export default config;
