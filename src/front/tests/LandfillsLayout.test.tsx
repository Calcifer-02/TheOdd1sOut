/**
 * Раскладка экрана справочника полигонов: одна левая вертикаль и одна полоса
 * отбора в обоих представлениях (BUG-003, BUG-011).
 *
 * Заказчик прочитал экран так: заголовок таблицы отбит внутрь белой плашки, а
 * заголовок страницы, пояснение, полоса актуальности и отбор начинаются от
 * края — вертикали не совпадают, а поиск, группы отходов и сброс читаются как
 * три отдельных решения. Проверка измеряет ровно это: отступ содержимого от
 * края экрана и принадлежность управлений одной полосе.
 *
 * Проверки фальсифицируемы: снимите поле у заголовочного блока, верните
 * обёртку вокруг кнопки сброса или отбейте плашку на другое расстояние —
 * падает именно та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/LandfillsLayout.test.tsx
 *
 * Критерия приёмки на раскладку справочника в реестре нет: AC-085a требует
 * двух деревьев разметки, а не одной вертикали. Поэтому ссылка на требования.
 *
 * @supports: R-039, R-040, R-085
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandfillsPage } from '@/pages/landfills';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import { installThemeStyles, leftInset } from './layout';
import { installReferencesStub, type ReferencesStub } from './stubs/references';

const ВСЕ_ГРУППЫ = 'Полигоны справочника: все группы отходов';

let служба: ReferencesStub;
let снятьОформление: () => void;

beforeAll(() => {
  снятьОформление = installThemeStyles();
});

afterAll(() => {
  снятьОформление();
});

beforeEach(() => {
  служба = installReferencesStub();
  window.history.replaceState(null, '', '#/landfills');
});

afterEach(() => {
  служба.restore();
});

/** Корень экрана: вертикали считаются от его края, а не от края окна. */
function экран(): Element {
  const узел = document.querySelector('.imolt-landfills');
  if (узел === null) {
    throw new Error('Экран справочника не отрисован');
  }
  return узел;
}

describe('левая вертикаль справочника полигонов', () => {
  it('на рабочем месте держит заголовок, полосы и подпись таблицы на одной вертикали', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    const корень = экран();
    const подпись = document.querySelector('caption');
    expect(подпись).not.toBeNull();

    const вертикаль = leftInset(подпись as Element, корень);

    // Плашка таблицы отбивает подпись внутрь общим правилом: если бы экран
    // не встал по ней, эта вертикаль была бы нулевой и сравнение ничего не
    // значило бы.
    expect(вертикаль).toBeGreaterThan(0);

    expect({
      заголовок: leftInset(screen.getByRole('heading', { level: 1 }), корень),
      пояснение: leftInset(screen.getByText(/без ввода адреса вывоза/), корень),
      актуальность: leftInset(
        screen.getByRole('status', { name: 'Актуальность данных' }),
        корень,
      ),
      отбор: leftInset(screen.getByRole('search', { name: 'Поиск полигона' }), корень),
    }).toEqual({
      заголовок: вертикаль,
      пояснение: вертикаль,
      актуальность: вертикаль,
      отбор: вертикаль,
    });
  });

  it('на телефоне держит заголовок, полосы и карточку полигона на одной вертикали', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    const корень = экран();
    const карточка = document.querySelector('.imolt-landfill-card .imolt-button-label');
    expect(карточка).not.toBeNull();

    const вертикаль = leftInset(карточка as Element, корень);

    expect(вертикаль).toBeGreaterThan(0);

    expect({
      заголовок: leftInset(screen.getByRole('heading', { level: 1 }), корень),
      актуальность: leftInset(
        screen.getByRole('status', { name: 'Актуальность данных' }),
        корень,
      ),
      отбор: leftInset(screen.getByRole('search', { name: 'Поиск полигона' }), корень),
    }).toEqual({
      заголовок: вертикаль,
      актуальность: вертикаль,
      отбор: вертикаль,
    });
  });
});

describe('длинные значения справочника', () => {
  it('переносит название полигона по словам в обоих представлениях, а не держит в строку', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    // Общий слой держит подпись кнопки в одну строку: название полигона —
    // предметный текст, и в карточке телефона оно обязано переноситься.
    const вКарточке = document.querySelector('.imolt-landfill-card .imolt-button-label');
    expect(вКарточке).not.toBeNull();
    expect(getComputedStyle(вКарточке as Element).whiteSpace).not.toBe('nowrap');

    setViewportWidth(DESKTOP_WIDTH);
    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    const вТаблице = document.querySelector('.imolt-landfill-name .imolt-button-label');
    expect(вТаблице).not.toBeNull();
    expect(getComputedStyle(вТаблице as Element).whiteSpace).not.toBe('nowrap');
  });
});

describe('полоса отбора справочника', () => {
  it('держит поиск, группы отходов и сброс отбора одной полосой управления', async () => {
    window.history.replaceState(null, '', `#/landfills?q=${encodeURIComponent('Восток')}`);
    render(<LandfillsPage />);

    const поиск = await screen.findByRole('search', { name: 'Поиск полигона' });
    const группы = screen.getByRole('group', { name: 'Группа отходов' });
    const сброс = screen.getByRole('button', { name: 'Сбросить отбор' });

    // Полоса одна: три управления — соседи в общей строке, а не три блока,
    // каждый со своим отступом.
    expect(группы.parentElement).toBe(поиск.parentElement);
    expect(сброс.parentElement).toBe(поиск.parentElement);
    expect(getComputedStyle(поиск.parentElement as Element).display).toBe('flex');
  });
});
