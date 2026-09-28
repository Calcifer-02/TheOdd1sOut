// Запись прохода по главному сценарию мини-приложения ИМОЛТ.
//
// Ведётся настоящими нажатиями в браузере, а не подстановкой значений: на
// видео должно быть видно то же, что увидит человек с телефоном. Паузы стоят
// там, где читателю нужно время прочитать экран, а не там, где удобно коду.
//
// Стенд должен быть поднят: запись идёт по http://localhost:15173, и выпуск
// предложения на нём настоящий — номер документа на видео живой.
//
// Браузер берётся из оснастки проекта (`.trip/tools`), как и остальные
// средства; каталог не версионируется, поэтому на свежей машине его ставит
// установка оснастки.
//
//   node devops/запись-главного-сценария.mjs <каталог-вывода>
//
// Видео пишется в webm; в mp4 для презентации оно переводится отдельно:
//   ffmpeg -i <файл>.webm -vf "scale=780:1688:flags=lanczos" //     -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart <файл>.mp4

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ОСНАСТКА = fileURLToPath(new URL('../.trip/tools/trip-frontend-inspector/.playwright/package/', import.meta.url));
const { chromium } = require(ОСНАСТКА);

const КАТАЛОГ = process.argv[2];
const АДРЕС = 'http://localhost:15173/#/';

/** Ширина телефона макета и удвоенная плотность точек. */
const ЭКРАН = { width: 390, height: 844 };

const пауза = мс => new Promise(r => setTimeout(r, мс));

/** Плавная прокрутка: рывок колеса читается на видео как сбой. */
async function прокрутить(page, точек, шагов = 14) {
  const шаг = Math.round(точек / шагов);
  for (let i = 0; i < шагов; i += 1) {
    await page.mouse.wheel(0, шаг);
    await пауза(55);
  }
}

const браузер = await chromium.launch({ headless: true });
const контекст = await браузер.newContext({
  viewport: ЭКРАН,
  deviceScaleFactor: 2,
  recordVideo: { dir: КАТАЛОГ, size: ЭКРАН },
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
});

const page = await контекст.newPage();

try {
  await page.goto(АДРЕС, { waitUntil: 'networkidle' });
  // Полоса прокрутки на телефоне накладная: без этого раскладка ужимается.
  await page.addStyleTag({ content: 'html{scrollbar-width:none}::-webkit-scrollbar{display:none}' });
  await пауза(1800);

  // 1. Адрес вывоза выбирается из подсказки: расчёт идёт по координатам.
  await page.click('#address');
  await page.type('#address', 'Годовиков', { delay: 110 });
  await page.waitForSelector('[role="option"]');
  await пауза(1400);
  await page.click('[role="option"]:has-text("д 9")');
  await пауза(1100);

  // 2. Тип отходов — только из справочника.
  await page.click('#waste-0');
  await page.type('#waste-0', 'Лом бетона', { delay: 110 });
  await page.waitForSelector('[role="option"]');
  await пауза(1200);
  await page.click('[role="option"] >> nth=0');
  await пауза(900);

  // 3. Объём: сперва кубометры, чтобы стал виден пересчёт в тонны.
  await page.click('#amount-0');
  await page.type('#amount-0', '12', { delay: 220 });
  await пауза(900);
  await page.click('.imolt-units .imolt-pill:has-text("м")');
  await пауза(1800);
  await page.click('.imolt-units .imolt-pill:has-text("т") >> nth=0');
  await пауза(1200);

  // 4. Расчёт.
  await page.click('button:has-text("Рассчитать")');
  await page.waitForSelector('.imolt-options li', { timeout: 30000 });
  await пауза(1600);
  await прокрутить(page, 700);
  await пауза(1800);

  // 5. Сравнение: порядок и предел расстояния.
  await прокрутить(page, -520);
  await пауза(700);
  const порядок = page.locator('.imolt-sorts .imolt-pill:has-text("Перевозка")');
  if (await порядок.count()) {
    await порядок.first().click();
    await пауза(1800);
  }
  await прокрутить(page, 420);
  await пауза(1400);

  // 6. Выбор двух полигонов: объём делится между ними.
  const отметки = page.locator('input[type="checkbox"][aria-label^="Выбрать полигон"]');
  await отметки.nth(0).click();
  await пауза(1300);
  await прокрутить(page, 320);
  await пауза(600);
  if ((await отметки.count()) > 1) {
    await отметки.nth(1).click();
    await пауза(2000);
  }
  await прокрутить(page, 700);
  await пауза(2000);

  // 7. Предложение.
  await page.click('button:has-text("Сформировать предложение")');
  await page.waitForTimeout(2500);
  await прокрутить(page, 600);
  await пауза(1600);
  const выпуск = page.locator('button:has-text("Выпустить")');
  if (await выпуск.count()) {
    await выпуск.first().click();
    await пауза(3000);
    await page.mouse.wheel(0, -1400);
    await пауза(2500);
  }

  console.log('проход завершён');
} catch (ошибка) {
  console.log('сбой прохода:', ошибка.message);
} finally {
  const видео = page.video();
  await контекст.close();
  await браузер.close();
  if (видео) {
    console.log('видео:', await видео.path());
  }
}
