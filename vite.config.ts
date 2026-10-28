/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      // e2e 模式改用測試專用資料，正式建置不會打包測試資料
      '@content-data':
        mode === 'e2e'
          ? resolvePath('./tests/fixtures/content-data.ts')
          : resolvePath('./src/content/data/index.ts'),
    },
  },
  build: {
    outDir: mode === 'e2e' ? 'dist-e2e' : 'dist',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));
