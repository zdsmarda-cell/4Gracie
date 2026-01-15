
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generate a version for development mode (production uses update-build.js)
const devVersion = `DEV-${new Date().getTime()}`;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', 
  define: {
    '__APP_VERSION__': JSON.stringify(process.env.npm_lifecycle_event === 'build' ? 'BUILD_PENDING' : devVersion)
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', 
        changeOrigin: true,
        secure: false, 
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  // @ts-ignore - Vitest types might conflict slightly with standard Vite config types in strict mode
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    exclude: ['node_modules', 'tests/e2e/**'], // Exclude Playwright tests
  },
  build: {
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('pdfmake')) {
              return 'pdf-libs';
            }
            if (id.includes('lucide-react')) {
              return 'ui-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
