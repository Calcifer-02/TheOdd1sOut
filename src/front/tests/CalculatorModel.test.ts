// Модель экрана расчёта: разбор введённого объёма, отбор заполненных строк
// формы, объяснение пустого результата и запись состояния выборки в адрес
// (R-013, R-014, R-024, R-025, R-061).
//
// Модель проверяется отдельно от разметки, потому что она у двух представлений
// одна: ошибка здесь ломает и карточки на телефоне, и таблицу на рабочем
// месте, а найти её через разметку — значит найти дважды.
//
// Проверки фальсифицируемы: примите строку без выбранной группы за позицию
// расчёта, прочитайте «12,5» как 12, назовите пустой результат отказом службы,
// оставьте сортировку вне адреса или заведите на неё новую запись истории —
// они упадут.
//
//   npx vitest run tests/CalculatorModel.test.ts
//
// @supports: R-013, R-024, R-025
// @ac: AC-024c, AC-025c
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyResultTitle } from '@/pages/calculator/model/emptyResult';
import { useCalculator } from '@/pages/calculator/model/useCalculator';
import { emptyLine, filledItems, parseAmount } from '@/pages/calculator/model/wasteLine';
import { DEFAULT_VIEW_STATE } from '@/shared/lib/viewState';
import type { WasteGroup } from '@/shared/api/contracts';
import type { ApiStub } from './apiStub';
import { CONCRETE_GROUP, installApiStub } from './apiStub';

const БЕТОН = CONCRETE_GROUP as unknown as WasteGroup;

describe('строка формы «тип отходов и объём»', () => {
  it('без выбранной из справочника группы в позиции расчёта не уходит', () => {
    // Набранная строка группой не является: расчёт опирается на запись
    // справочника, а не на текст (R-013).
    const строка = { ...emptyLine(), query: 'лом бетона', amount: '20' };

    expect(filledItems([строка])).toEqual([]);
  });

  it('с нулевым объёмом в позиции расчёта не уходит', () => {
    const строка = { ...emptyLine(), group: БЕТОН, query: БЕТОН.name, amount: '0' };

    expect(filledItems([строка])).toEqual([]);
  });

  it('с выбранной группой и объёмом уходит позицией с мерой', () => {
    const строка = { ...emptyLine(), group: БЕТОН, query: БЕТОН.name, amount: '20' };

    expect(filledItems([строка])).toEqual([
      { wasteGroupId: БЕТОН.id, quantity: { value: 20, unit: 't' } },
    ]);
  });

  it('с десятичной запятой разбирается как дробное число', () => {
    // Запятая — десятичный разделитель локали ru-RU (R-061); прочитанное как
    // «12» вместо «12,5» тихо уменьшило бы объём вывоза вдвое по копейкам.
    expect(parseAmount('12,5')).toBe(12.5);
  });

  it('с пустым объёмом числом не притворяется', () => {
    expect(Number.isNaN(parseAmount(''))).toBe(true);
  });
});

describe('объяснение пустого результата', () => {
  it('при отборе «до N км» называет предел числом', () => {
    const заголовок = emptyResultTitle('filteredOutByDistance', {
      ...DEFAULT_VIEW_STATE,
      distanceMode: 'atMost',
      distanceKm: 60,
    });

    expect(заголовок).toBe('Нет полигонов, принимающих этот тип отходов ближе 60 км');
  });

  it('при отборе «не менее N км» называет вторую сторону отбора', () => {
    const заголовок = emptyResultTitle('filteredOutByDistance', {
      ...DEFAULT_VIEW_STATE,
      distanceMode: 'atLeast',
      distanceKm: 60,
    });

    expect(заголовок).toBe('Нет полигонов, принимающих этот тип отходов дальше 60 км');
  });

  it('при отсутствии полигонов для группы о фильтре расстояния не говорит', () => {
    const заголовок = emptyResultTitle('noLandfillsForWasteGroup', DEFAULT_VIEW_STATE);

    expect(заголовок).toBe('Нет полигонов, принимающих этот тип отходов');
  });
});

describe('состояние выборки в адресе страницы', () => {
  let stub: ApiStub;

  beforeEach(() => {
    stub = installApiStub();
  });

  afterEach(() => {
    stub.restore();
  });

  it('при смене поля сортировки уходит в адрес', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.sortBy('distance');
    });

    expect(window.location.hash).toContain('sort=distance');
  });

  it('при повторном выборе того же поля меняет направление', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.sortBy('distance');
    });
    act(() => {
      result.current.sortBy('distance');
    });

    expect(result.current.view.order).toBe('desc');
    expect(window.location.hash).toContain('order=desc');
  });

  it('новой записи истории на смену сортировки не заводит', () => {
    // Иначе «назад» перестаёт быть возвратом на прошлый этап пути и
    // превращается в перебор фильтров (карточка практики PRACT-016).
    const длинаДо = window.history.length;
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.sortBy('transport');
    });

    expect(window.history.length).toBe(длинаДо);
  });

  it('при снятии предела расстояния возвращает режим по умолчанию', () => {
    const { result } = renderHook(() => useCalculator());

    act(() => {
      result.current.applyView({ distanceMode: 'atLeast', distanceKm: 60 });
    });
    act(() => {
      result.current.clearDistanceFilter();
    });

    expect(result.current.view.distanceMode).toBe(DEFAULT_VIEW_STATE.distanceMode);
    expect(result.current.view.distanceKm).toBeGreaterThan(DEFAULT_VIEW_STATE.distanceKm);
  });
});
