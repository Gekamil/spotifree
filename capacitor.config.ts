import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.spotifree.music',
  appName: 'Spotifree',
  webDir: 'dist',
  bundledWebRuntime: false,
  // The APK runs the deployed web app (same origin as the website): the /api functions, the
  // YouTube player and the cloud account (Firebase keys live in the Vercel build) work exactly
  // as on the web, and every web update reaches the app without reinstalling it. Native
  // plugins (login, Android Auto, audio effects) are injected into that page by Capacitor.
  // Without connection, the bundled offline.html is shown instead.
  server: {
    url: 'https://spotifreeweb.vercel.app',
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#121212',
      overlaysWebView: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#121212',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
  },
};

export default config;
