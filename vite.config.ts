import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' 로 빌드하면 dist 폴더를 어떤 위치에 두어도 정적 서버로 바로 열 수 있다.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
