
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: This ensures relative paths for assets (fixes white screen on Apache)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        // If your backend switches to HTTPS on port 3000, update this to https://...
        target: 'http://localhost:3000', 
        changeOrigin: true,
        secure: false, // Allow self-signed certs if needed
      }
    }
  }
});
