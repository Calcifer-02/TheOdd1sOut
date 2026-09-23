import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Мини-приложение MAX отдаётся статикой; обращения к расчётной части идут
// по относительному пути /api, который в контейнере проксирует nginx,
// а при локальной разработке — этот прокси.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, '') },
    },
  },
  build: { outDir: 'dist' },
  test: {
    // Проверки лежат внутри пакета: разрешение зависимостей идёт вверх от
    // файла проверки, а node_modules мини-приложения живёт здесь. Корень
    // проверок объявлен средству трассируемости отдельной записью, чтобы
    // проверка не была засчитана реализацией требования.
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  }
});
