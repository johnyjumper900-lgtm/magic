import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.setenza.magic',
  appName: 'magic',
  webDir: 'dist/client' // <--- Changement ici pour correspondre à la sortie de Vite
};

export default config;