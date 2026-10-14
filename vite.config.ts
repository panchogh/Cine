import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Cine/',
  server: { host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
});
