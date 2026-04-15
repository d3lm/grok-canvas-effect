import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/grok-canvas-effect/' : '/',
  plugins: [react(), tailwindcss()],
}));
