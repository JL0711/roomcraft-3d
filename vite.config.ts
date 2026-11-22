import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // one copy of three.js for the app, drei and postprocessing
  resolve: { dedupe: ['three'] },
  optimizeDeps: { include: ['three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/exporters/GLTFExporter.js', 'three/examples/jsm/environments/RoomEnvironment.js'] },
  build: { chunkSizeWarningLimit: 2500 },
});
