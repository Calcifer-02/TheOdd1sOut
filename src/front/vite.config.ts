import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { SITE_ORIGIN, robotsTxt, sitemapXml } from './site';

/**
 * Адрес сервиса подставляется в разметку при сборке, а карта сайта и правила
 * обхода собираются из него же. Второй рукописный адрес разошёлся бы с первым
 * на первом переезде (см. «site.ts»).
 */
function siteAddress(): Plugin {
  return {
    name: 'imolt-site-address',
    transformIndexHtml: {
      order: 'pre',
      handler: html => html.replaceAll('%SITE_ORIGIN%', SITE_ORIGIN),
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt() });
    },
  };
}

// Мини-приложение MAX отдаётся статикой; обращения к расчётной части идут
// по относительному пути /api, который в контейнере проксирует nginx,
// а при локальной разработке — этот прокси.
export default defineConfig({
  plugins: [react(), siteAddress()],
  // Один алиас на корень исходников: слой видно прямо в пути подключения
  // («@/entities/landfill»), и счёт «../» при переносе слайса больше не
  // меняется. Проверка направления подключений опирается на тот же вид
  // пути (PRACT-012).
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') },
    },
  },
  // Две точки входа: экран сервиса и витрина компонентов. Витрина собирается
  // из тех же модулей и потому не может разойтись с экранами (R-084).
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        vitrina: fileURLToPath(new URL('./vitrina.html', import.meta.url)),
      },
    },
  },
  test: {
    // Проверки лежат внутри пакета: разрешение зависимостей идёт вверх от
    // файла проверки, а node_modules мини-приложения живёт здесь. Корень
    // проверок объявлен средству трассируемости отдельной записью, чтобы
    // проверка не была засчитана реализацией требования.
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
});
