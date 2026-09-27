import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' keeps the build working from any sub-path (GitHub Pages, Netlify, local file).
export default defineConfig({
  plugins: [react()],
  base: './',
});
