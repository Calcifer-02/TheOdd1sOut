/**
 * Общая поверхность блока результатов на широком экране (R-058, R-085).
 *
 * Замечание заказчика по живому стенду 24.09.2026: таблица сравнения и сводка
 * выбора стояли двумя белыми карточками рядом, и при коротком списке правая
 * кончалась заметно ниже левой — при одном полигоне область прокрутки таблицы
 * 254 точки высоты против примерно 400 у карточки сводки. Низ блока читался
 * рваным, а рядом с таблицей оставалось пустое место.
 *
 * Про раскладку нельзя спросить роль или доступное имя: её несёт оформление.
 * Поэтому проверка спрашивает у страницы вычисленное значение, а оформление
 * подключается в том же порядке, что в приложении, — экран рисуется целиком
 * через `App`, который подключает общий слой, а правила экрана подключает сам
 * экран. Сверка текста правил прошла бы и на сломанном каскаде (образец —
 * tests/SummaryPanelRhythm.test.tsx).
 *
 * Проверки фальсифицируемы: верните таблице или сводке собственную плашку,
 * разведите их по разным контейнерам, снимите растяжение колонки сводки,
 * уберите разделитель между сторонами, снимите липкость сводки, покажите
 * боковую колонку до выбора — они упадут.
 *
 *   npx vitest run tests/CalculatorResultsSurface.test.tsx
 *
 * @supports: R-058, R-085
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { radius, stroke } from '@/shared/ui/tokens';
import type { ApiStub } from './apiStub';
import { VOSTOK, installApiStub } from './apiStub';
import { calculateConcrete, landfillCheckbox } from './flows';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

let stub: ApiStub;

beforeEach(() => {
  stub = installApiStub();
  // Замечание заказчика воспроизводится именно на коротком списке: один
  // полигон даёт таблицу заметно ниже сводки.
  stub.setOptions([VOSTOK]);
  // Ширина ставится до отрисовки: после неё представление уже выбрано.
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  stub.restore();
});

/** Таблица сравнения полигонов по её подписи. */
function comparisonTable(): HTMLElement {
  return screen.getByRole('table', { name: 'Сравнение полигонов' });
}

/**
 * Общая поверхность блока результатов. Найти её можно только по классу
 * раскладки: у неё нет ни роли, ни доступного имени, а проверяется здесь
 * именно она.
 */
function resultsSurface(): HTMLElement {
  const surface = comparisonTable().closest('.imolt-desk-surface');

  if (surface === null) {
    throw new Error('Таблица сравнения стоит вне общей поверхности результатов');
  }

  return surface as HTMLElement;
}

/** Оправа таблицы внутри поверхности. */
function tableBlock(): HTMLElement {
  return resultsSurface().querySelector('.imolt-desk-table') as HTMLElement;
}

/** Колонка сводки выбора внутри поверхности. */
function summaryColumn(): HTMLElement {
  return resultsSurface().querySelector('.imolt-desk-side') as HTMLElement;
}

/** Панель сводки выбора. */
function summaryPanel(): HTMLElement {
  return resultsSurface().querySelector('.imolt-summary-panel') as HTMLElement;
}

/** Доводит экран до результата и отмечает единственный полигон. */
async function selectLandfill(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await calculateConcrete(user);
  await user.click(landfillCheckbox(VOSTOK.landfillName));
  await screen.findByRole('heading', { name: /Выбрано/u });
}

/** @supports: R-058 */
describe('блок результатов на широком экране', () => {
  it('ставит таблицу сравнения и сводку выбора на одну поверхность', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectLandfill(user);

    const surface = resultsSurface();

    expect(surface.contains(comparisonTable()), 'таблица стоит вне общей поверхности').toBe(true);
    expect(surface.contains(summaryPanel()), 'сводка выбора стоит отдельной карточкой рядом').toBe(true);
  });

  it('рисует плашку один раз — поверхностью, а не таблицей и сводкой', async () => {
    // Собственная плашка у каждой из сторон даёт карточку в карточке: у
    // блока появляется два фона, две тени и два скругления.
    const user = userEvent.setup();
    render(<App />);

    await selectLandfill(user);

    const surfaceStyle = window.getComputedStyle(resultsSurface());

    expect(surfaceStyle.borderRadius, 'плашка блока результатов не скруглена по договору').toBe(`${radius.card}px`);
    expect(window.getComputedStyle(tableBlock()).backgroundColor, 'таблица рисует свою плашку поверх общей').not.toBe(
      surfaceStyle.backgroundColor,
    );
    expect(window.getComputedStyle(summaryPanel()).backgroundColor, 'сводка рисует свою плашку поверх общей').not.toBe(
      surfaceStyle.backgroundColor,
    );
  });

  it('снимает со сводки тень и скругление отдельной карточки', async () => {
    // Тень положена липкой сводке, пока она едет над таблицей отдельной
    // карточкой; внутри общей плашки она превращается в шов посреди
    // поверхности (дизайн-договор, разд. 4.3).
    const user = userEvent.setup();
    render(<App />);

    await selectLandfill(user);

    const panelStyle = window.getComputedStyle(summaryPanel());

    expect(panelStyle.boxShadow, 'сводка приподнята над общей поверхностью').toBe('none');
    expect(panelStyle.borderRadius).toBe('0px');
  });

  it('кончает обе стороны на одной линии', async () => {
    // Растяжение — единственное, чем держится общий низ: без него каждая
    // сторона кончается по своему содержимому, и низ блока рваный.
    const user = userEvent.setup();
    render(<App />);

    await selectLandfill(user);

    expect(window.getComputedStyle(resultsSurface()).alignItems).toBe('stretch');
    expect(window.getComputedStyle(summaryColumn()).alignSelf, 'колонка сводки не тянется до низа').toBe('stretch');
  });

  it('разводит стороны разделителем, а не зазором между карточками', async () => {
    const user = userEvent.setup();
    render(<App />);

    await selectLandfill(user);

    const sideStyle = window.getComputedStyle(summaryColumn());

    expect(sideStyle.borderLeftStyle).toBe('solid');
    expect(sideStyle.borderLeftWidth).toBe(`${stroke.hairline}px`);
  });

  it('оставляет сводку липкой при прокрутке', async () => {
    // Итог обязан быть виден в тот момент, когда отмечается очередная строка
    // таблицы, а не после возврата к началу списка (разд. 4.4).
    const user = userEvent.setup();
    render(<App />);

    await selectLandfill(user);

    expect(window.getComputedStyle(summaryPanel()).position).toBe('sticky');
  });

  it('до выбора полигона равен таблице: боковой колонки нет', async () => {
    const user = userEvent.setup();
    render(<App />);
    await calculateConcrete(user);

    expect(resultsSurface().contains(comparisonTable())).toBe(true);
    expect(resultsSurface().querySelector('.imolt-desk-side'), 'пустая колонка отнимает у таблицы ширину').toBeNull();
  });
});
