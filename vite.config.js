import { defineConfig } from 'vite';

// Set VITE_BASE_PATH to "/REPOSITORY/" for a GitHub Pages project site.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  build: { outDir: 'dist' }
});
