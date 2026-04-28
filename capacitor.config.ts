import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.setenza.magic',
  appName: 'magic',
  webDir: 'dist', // On revient à dist pour plus de flexibilité
  bundledWebRuntime: false
};

export default config;