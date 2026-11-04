import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { healthifySw } from './vite/swPlugin';

const buildId = new Date().toISOString();

export default defineConfig({
  base: './',
  plugins: [react(), healthifySw(buildId)],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
