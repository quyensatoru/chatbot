import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatbot.app',
  appName: 'Chatbot',
  webDir: 'dist',
  server: {
    // Uncomment and set your backend IP when testing on a real device
    // androidScheme: 'https',
    url: 'http://10.0.2.2:5173',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
