// Представление экрана в адресе страницы: закрепление параметром `view` и
// подпись действующего представления при пересечении точки перелома
// (R-085, AC-085c; дизайн-договор, разд. 4.5).
//
// Проверяется наблюдаемое: какое дерево попадает в страницу при закреплённом
// представлении, что остаётся от незнакомого значения и какой ценой для
// истории переходов даётся подпись адреса. Ширина окна и адрес здесь
// противопоставлены намеренно — закрепление доказывается только там, где
// ширина выбрала бы другое.
//
// Проверки фальсифицируемы: верните выбор представления одной ширине окна,
// примите любое значение параметра, подпишите адрес новой записью истории
// (`navigate` вместо `replaceRoute`) — они упадут.
//
//   npx vitest run tests/ViewportRoute.test.tsx
//
// @ac: AC-085c
// @supports: R-085
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from './viewport';

/** Открывает адрес до отрисовки: представление читается из него, а не из памяти. */
function openAddress(hash: string): void {
  window.history.replaceState(null, '', hash);
}

/**
 * Зонд вместо готового экрана: выбор представления — дело `useViewport`, а
 * какое дерево строит на нём оболочка, уже проверено в AppShell.test.tsx
 * (AC-085a, AC-085b). Зонд показывает и само представление, и ветку разметки,
 * которую по нему выберет экран.
 */
function ViewportProbe() {
  const viewport = useViewport();

  return (
    <output>
      {viewport} · {isWide(viewport) ? 'рабочее место' : 'телефон'}
    </output>
  );
}

/** Представление, которое зонд показал в странице. */
function shownViewport(): string {
  return screen.getByRole('status').textContent ?? '';
}

beforeEach(() => {
  openAddress('#/');
});

describe('представление, закреплённое адресом страницы', () => {
  it('адрес с представлением телефона показывает телефонное представление на широком окне', () => {
    openAddress('#/?view=mobile');
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    expect(shownViewport()).toBe('mobile · телефон');
  });

  it('адрес с представлением рабочего места показывает его на узком окне', () => {
    openAddress('#/?view=desktop');
    setViewportWidth(MOBILE_WIDTH);
    render(<ViewportProbe />);

    expect(shownViewport()).toBe('desktop · рабочее место');
  });

  it('адрес без представления оставляет выбор ширине окна', () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    expect(shownViewport()).toBe('desktop · рабочее место');
  });

  it('незнакомое значение представления не роняет экран и не стирает соседних параметров', () => {
    openAddress('#/?calc=calc-1&view=phone');
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    // Экран остаётся рабочим и выбирается по ширине, а непонятое значение
    // лежит в адресе рядом с нетронутым соседом: разбор мягкий, как и у
    // остального состояния выборки.
    expect(shownViewport()).toBe('desktop · рабочее место');
    expect(window.location.hash).toBe('#/?calc=calc-1&view=phone');
  });
});

describe('подпись представления в адресе при смене ширины окна', () => {
  it('сужение окна через точку перелома дописывает представление к прежнему адресу', () => {
    openAddress('#/cabinet?sort=transport');
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    expect(shownViewport()).toBe('desktop · рабочее место');

    act(() => setViewportWidth(MOBILE_WIDTH));

    expect(shownViewport()).toBe('mobile · телефон');
    expect(window.location.hash).toBe('#/cabinet?sort=transport&view=mobile');
  });

  it('сужение окна через точку перелома не заводит новой записи истории', () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    const historyEntries = window.history.length;

    act(() => setViewportWidth(MOBILE_WIDTH));

    expect(window.location.hash).toBe('#?view=mobile');
    expect(window.history.length).toBe(historyEntries);
  });

  it('открытие экрана без смены ширины адрес не трогает', () => {
    openAddress('#/cabinet');
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    expect(window.location.hash).toBe('#/cabinet');
  });

  it('закреплённое сужением представление переживает повторное открытие адреса', () => {
    setViewportWidth(DESKTOP_WIDTH);
    const first = render(<ViewportProbe />);

    act(() => setViewportWidth(MOBILE_WIDTH));

    const closed = window.location.hash;
    first.unmount();

    // Повторное открытие того же адреса — то же, что перезагрузка страницы:
    // представление берётся из адреса, а не из памяти ушедшего дерева. Окно
    // здесь нарочно широкое: по ширине вышло бы рабочее место.
    openAddress(closed);
    setViewportWidth(DESKTOP_WIDTH);
    render(<ViewportProbe />);

    expect(shownViewport()).toBe('mobile · телефон');
  });
});
