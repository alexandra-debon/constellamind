import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whisperandmap.constellamind',
  appName: 'ConstellaMind',
  webDir: 'dist',
  backgroundColor: '#fffdf7',
  ios: {
    contentInset: 'never',
  },
  android: {
    backgroundColor: '#fffdf7',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#fffdf7',
      showSpinner: false,
    },
  },
};

export default config;
