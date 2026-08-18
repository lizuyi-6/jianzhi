import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendOrigin = process.env.BACKEND_ORIGIN ?? 'http://localhost:3001';
const apiProxy = {
  '/api': { target: backendOrigin, changeOrigin: true },
  '/health': { target: backendOrigin, changeOrigin: true },
  '/ready': { target: backendOrigin, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: apiProxy },
  preview: { host: '0.0.0.0', port: 4173, proxy: apiProxy },
});
