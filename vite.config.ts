
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
  },
  build: {
    // Increase the warning limit slightly (default is 500)
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separate heavy libraries into their own chunks
            if (id.includes('jspdf') || id.includes('pdfmake')) {
              return 'pdf-libs';
            }
            if (id.includes('lucide-react')) {
              return 'ui-icons';
            }
            // Group React dependencies
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            // All other dependencies go to a general vendor file
            return 'vendor';
          }
        }
      }
    }
  }
});
