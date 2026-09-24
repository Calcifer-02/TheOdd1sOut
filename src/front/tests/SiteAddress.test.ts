/**
 * Адрес сервиса и поисковая разметка страницы (R-058).
 *
 * Адрес сервиса нужен в четырёх местах: канонический адрес страницы, адрес в
 * предпросмотре ссылки, адрес картинки предпросмотра и карта сайта. Написанный
 * в каждом месте своей рукой, он расходится на первом переезде, и поисковая
 * система выбирает канонический адрес сама. Проверка держит одно место:
 * в разметке стоит подстановка, а не домен.
 *
 * Проверки фальсифицируемы: впишите домен прямо в разметку, уберите карту
 * сайта из правил обхода, разведите домен карты сайта и домен разметки, снимите
 * содержимое для читателя без сценариев или запрет обхода витрины — они упадут.
 *
 *   npx vitest run tests/SiteAddress.test.ts
 *
 * @supports: R-058
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_ORIGIN, SITE_UPDATED, robotsTxt, sitemapXml } from '../site';
import { repositoryRoot } from './repository';

/** Разметка страницы до сборки: подстановки в ней ещё не раскрыты. */
function page(name: string): string {
  return readFileSync(join(repositoryRoot(), 'src', 'front', name), 'utf8');
}

/** Домен сервиса без указания способа обращения: «triadmind.ru». */
const HOST = SITE_ORIGIN.replace(/^https?:\/\//u, '');

describe('адрес сервиса объявлен одним местом', () => {
  it.each(['index.html', 'vitrina.html'])('разметка «%s» домена не содержит', name => {
    expect(page(name), 'домен в разметке расходится с картой сайта на первом переезде').not.toContain(HOST);
  });

  it('канонический адрес, адрес предпросмотра и картинка берут подстановку', () => {
    const html = page('index.html');

    expect(html).toContain('<link rel="canonical" href="%SITE_ORIGIN%/" />');
    expect(html).toContain('<meta property="og:url" content="%SITE_ORIGIN%/" />');
    expect(html).toContain('<meta property="og:image" content="%SITE_ORIGIN%/preview.svg" />');
  });

  it('карта сайта и правила обхода называют тот же адрес', () => {
    expect(sitemapXml()).toContain(`<loc>${SITE_ORIGIN}/</loc>`);
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
  });

  it('дата карты сайта объявлена, а не взята у часов машины', () => {
    // Дата «сегодня» в сборке делает каждый образ отличным от предыдущего и
    // заявляет обновление там, где ничего не менялось.
    expect(SITE_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    expect(sitemapXml()).toContain(`<lastmod>${SITE_UPDATED}</lastmod>`);
  });

  it('витрина компонентов из обхода исключена', () => {
    expect(robotsTxt()).toContain('Disallow: /vitrina.html');
    expect(page('vitrina.html')).toContain('name="robots" content="noindex, nofollow"');
  });
});

describe('страница читается без выполнения сценариев', () => {
  it('называет предмет, состав работы и читателя', () => {
    const html = page('index.html');
    const [, noscript = ''] = /<noscript>([\s\S]*?)<\/noscript>/u.exec(html) ?? [];

    expect(noscript, 'без сценариев обходчик видит пустой лист').toContain('<h1>');
    expect(noscript).toContain('Что делает сервис');
    expect(noscript).toContain('Кому он нужен');
    expect(noscript.match(/<li>/gu) ?? [], 'состав работы назван перечнем').toHaveLength(5);
  });

  it('объявляет себя машинным словарём', () => {
    const html = page('index.html');
    const [, ld = ''] = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/u.exec(html) ?? [];
    const разметка = JSON.parse(ld.replaceAll('%SITE_ORIGIN%', SITE_ORIGIN)) as {
      '@graph': { '@type': string }[];
    };

    expect(разметка['@graph'].map(узел => узел['@type'])).toEqual(['WebSite', 'Service']);
  });

  it('цен, оценок и реквизитов в разметке не объявляет', () => {
    // Цена зависит от расчёта, юридическое лицо сервиса заказчиком не названо
    // (Q-012). Выдуманная цена или оценка в разметке — ложь поисковой системе.
    const html = page('index.html');
    const [, ld = ''] = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/u.exec(html) ?? [];

    expect(ld).not.toContain('"offers"');
    expect(ld).not.toContain('"price"');
    expect(ld).not.toContain('"aggregateRating"');
  });
});
