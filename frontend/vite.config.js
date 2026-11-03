import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo, /api se redirige al backend Express.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': process.env.VITE_API_URL || 'http://localhost:4000' } },
});
