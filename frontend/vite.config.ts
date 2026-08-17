import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/api': { target: 'http://localhost:3001', changeOrigin: true },
  '/health': { target: 'http://localhost:3001', changeOrigin: true },
  '/ready': { target: 'http://localhost:3001', changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: apiProxy },
  preview: { host: '0.0.0.0', port: 4173, proxy: apiProxy },
});
