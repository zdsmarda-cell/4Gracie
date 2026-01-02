
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: This ensures relative paths for assets (fixes white screen on Apache)
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
