import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agendei.facil',
  appName: 'Agendei Fácil',
  webDir: 'dist',
  server: {
    initialNavigation: 'enabledBlocking',
  },
  android: {
    initialFocus: true,
  },
};

export default config;
