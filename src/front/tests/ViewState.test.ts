// Передаваемое состояние выборки: расчёт, вкладка группы отходов, сортировка
// и предел расстояния живут в адресе, поэтому обновление страницы не теряет
// результат, а ссылка воспроизводит ту же выборку (ADR-0008, инвариант 5;
// карточка практики PRACT-016).
//
// Якоря `@ac` в этом файле нет намеренно: приёмочного критерия на
// восстановление выборки по ссылке в ПРИЁМОЧНЫХ_ТЕСТАХ не заведено. Разрыв
// назван, а не замаскирован выдуманным идентификатором.
//
// Проверки фальсифицируемы: уроните весь разбор на первом непонятном
// параметре, потеряйте поле при круговом прогоне или замените значение по
// умолчанию — они упадут.
import { describe, expect, it } from 'vitest';
import type { ViewState } from '@/shared/lib/viewState';
import { DEFAULT_VIEW_STATE, parseViewState, viewStateToHash } from '@/shared/lib/viewState';
import { CALCULATION_ID, CONCRETE_GROUP } from './apiStub';

/** Выборка со всеми полями, отличными от значений по умолчанию. */
const FULL_STATE: ViewState = {
  calculationId: CALCULATION_ID,
  wasteGroupId: CONCRETE_GROUP.id,
  sort: 'transport',
  order: 'desc',
  distanceMode: 'atLeast',
  distanceKm: 60,
};

/** Портит одно значение в адресе, не трогая соседние. */
function damage(state: ViewState, value: string): string {
  const hash = viewStateToHash(state);

  if (!hash.includes(value)) {
    throw new Error(`Адрес «${hash}» не несёт значения «${value}»: портить нечего`);
  }

  return hash.replace(value, 'поломанное-значение');
}

describe('значения выборки по умолчанию', () => {
  it('ранжирует по совокупной цене по возрастанию', () => {
    expect(DEFAULT_VIEW_STATE.sort).toBe('total');
    expect(DEFAULT_VIEW_STATE.order).toBe('asc');
  });

  it('ограничивает список плечом до пятидесяти километров', () => {
    // Предел по умолчанию задан требованием R-026 и схемой `DistanceFilter`
    // договора, а не выбран интерфейсом.
    expect(DEFAULT_VIEW_STATE.distanceMode).toBe('atMost');
    expect(DEFAULT_VIEW_STATE.distanceKm).toBe(50);
  });

  it('не называет ни расчёта, ни вкладки группы отходов', () => {
    expect(DEFAULT_VIEW_STATE.calculationId).toBeUndefined();
    expect(DEFAULT_VIEW_STATE.wasteGroupId).toBeUndefined();
  });

  it('остаётся простыми данными и переживает сериализацию', () => {
    // Состояние попадает в адрес и в сохранения: никаких Map, Set и классов
    // внутри (правила проекта, «JSON-сериализуемость состояния»).
    expect(JSON.parse(JSON.stringify(DEFAULT_VIEW_STATE)) as ViewState).toEqual(DEFAULT_VIEW_STATE);
  });
});

describe('круговой прогон выборки через адрес', () => {
  it('возвращает заполненную выборку без потерь', () => {
    expect(parseViewState(viewStateToHash(FULL_STATE))).toEqual(FULL_STATE);
  });

  it('возвращает выборку со значениями по умолчанию без потерь', () => {
    expect(parseViewState(viewStateToHash(DEFAULT_VIEW_STATE))).toEqual(DEFAULT_VIEW_STATE);
  });

  it('читает пустой адрес как выборку по умолчанию', () => {
    expect(parseViewState('')).toEqual(DEFAULT_VIEW_STATE);
  });
});

describe('испорченный параметр адреса', () => {
  it('не роняет разбор целиком', () => {
    expect(() => parseViewState(damage(FULL_STATE, 'transport'))).not.toThrow();
  });

  it('возвращает сортировку к значению по умолчанию, сохраняя соседние поля', () => {
    const state = parseViewState(damage(FULL_STATE, 'transport'));

    expect(state.sort).toBe(DEFAULT_VIEW_STATE.sort);
    expect(state.order).toBe('desc');
    expect(state.distanceKm).toBe(60);
    expect(state.calculationId).toBe(CALCULATION_ID);
  });

  it('возвращает направление сортировки к значению по умолчанию, сохраняя соседние поля', () => {
    const state = parseViewState(damage(FULL_STATE, 'desc'));

    expect(state.order).toBe(DEFAULT_VIEW_STATE.order);
    expect(state.sort).toBe('transport');
    expect(state.distanceMode).toBe('atLeast');
  });

  it('возвращает режим предела расстояния к значению по умолчанию, сохраняя соседние поля', () => {
    const state = parseViewState(damage(FULL_STATE, 'atLeast'));

    expect(state.distanceMode).toBe(DEFAULT_VIEW_STATE.distanceMode);
    expect(state.distanceKm).toBe(60);
    expect(state.sort).toBe('transport');
  });

  it('возвращает предел расстояния к значению по умолчанию, сохраняя соседние поля', () => {
    const state = parseViewState(damage(FULL_STATE, '60'));

    expect(state.distanceKm).toBe(DEFAULT_VIEW_STATE.distanceKm);
    expect(state.distanceMode).toBe('atLeast');
    expect(state.wasteGroupId).toBe(CONCRETE_GROUP.id);
  });
});

describe('незнакомый параметр адреса', () => {
  it('не отменяет известные поля выборки', () => {
    const hash = `${viewStateToHash(FULL_STATE)}&неизвестный-параметр=значение`;

    expect(parseViewState(hash)).toEqual(FULL_STATE);
  });
});
