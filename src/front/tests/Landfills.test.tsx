/**
 * Справочник полигонов: список в двух представлениях, отбор в адресе и
 * состояния экрана.
 *
 * Экран закрывает путь UC-009: демонтажная компания смотрит тарифы утилизации
 * до того, как появился адрес вывоза. Проверки написаны от исхода для этого
 * пользователя — что он видит и что уходит в службу, — а не от устройства
 * компонентов.
 *
 * Проверки фальсифицируемы: уберите слово из значка статуса, перестаньте
 * класть группу отходов в адрес, поднимите порог устаревания или покажите код
 * ответа вместо заголовка отказа — падает именно та проверка, которая об этом
 * говорит.
 *
 *   npx vitest run tests/Landfills.test.tsx
 *
 * Критерия приёмки на экран справочника в реестре нет: AC-040b и AC-048b
 * сформулированы как обращения к службе, AC-048d — про полосу актуальности
 * над результатом расчёта. Поэтому здесь ссылка на требования.
 *
 * @supports: R-039, R-040, R-048
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandfillsPage } from '@/pages/landfills';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import {
  FRESHNESS_DATE,
  IKSHA,
  REGISTRY_UNAVAILABLE,
  STALE_DATE,
  VOSTOK,
  installReferencesStub,
  type ReferencesStub,
} from './stubs/references';

const ВСЕ_ГРУППЫ = 'Полигоны справочника: все группы отходов';

const PROBLEM_HEADERS = { 'content-type': 'application/problem+json' };

let служба: ReferencesStub;

function открыть(адрес: string): void {
  window.history.replaceState(null, '', адрес);
}

beforeEach(() => {
  служба = installReferencesStub();
  открыть('#/landfills');
});

afterEach(() => {
  служба.restore();
});

describe('справочник полигонов, узкий экран', () => {
  it('на телефоне показывает полигоны карточками, а не таблицей', async () => {
    render(<LandfillsPage />);

    const список = await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    expect(список).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: VOSTOK.name })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: IKSHA.name })).toBeInTheDocument();
  });

  it('называет тариф утилизации полигона ценой за тонну', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    // 450 ₽/т — тариф «Востока» по лому бетона из ответа службы.
    expect(screen.getByText('450 ₽/т')).toBeInTheDocument();
    expect(screen.getByText('380 ₽/т')).toBeInTheDocument();
  });
});

describe('справочник полигонов, широкий экран', () => {
  it('на рабочем месте показывает полигоны таблицей с подписью и заголовками столбцов', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    const таблица = await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    expect(таблица).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Полигон' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Тариф утилизации, ₽/т' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Статус' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: ВСЕ_ГРУППЫ })).toBeNull();
  });

  it('на рабочем месте показывает юридическое лицо полигона отдельным столбцом', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    expect(screen.getByRole('cell', { name: VOSTOK.legalEntity! })).toBeInTheDocument();
    // У «Икши» юридического лица договор не обещает: ячейка называет это, а не
    // подставляет вымышленное название.
    expect(screen.getByRole('cell', { name: 'не указано' })).toBeInTheDocument();
  });
});

describe('отбор справочника по группе отходов', () => {
  // На широком экране группа выбирается чипом, на телефоне — закрытым
  // списком (R-085). Предметное поведение одно, и проверяется оно для обоих.
  it('выбор группы попадает в адрес и оставляет только принимающие её полигоны', async () => {
    const пользователь = userEvent.setup();
    render(<LandfillsPage />);

    // На телефоне группа выбирается закрытым списком: длинные названия
    // чипами вставали столбиком разной длины (R-085).
    const список = await screen.findByLabelText('Группа отходов');
    await пользователь.selectOptions(список, 'drevesina');

    expect(window.location.hash).toContain('group=drevesina');
    expect(служба.lastTo('GET /v1/landfills').query.get('wasteGroupId')).toBe('drevesina');

    await screen.findByRole('list', { name: 'Полигоны справочника: группа «Древесина от разборки»' });
    expect(screen.getByRole('button', { name: VOSTOK.name })).toBeInTheDocument();
    // «Икша» древесину не принимает: тарифа по этой группе у неё нет.
    expect(screen.queryByRole('button', { name: IKSHA.name })).toBeNull();
  });

  it('адрес с выбранной группой восстанавливает ту же выборку при открытии экрана', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    открыть('#/landfills?group=drevesina');

    render(<LandfillsPage />);

    await screen.findByRole('button', { name: 'Древесина от разборки', pressed: true });

    expect(служба.lastTo('GET /v1/landfills').query.get('wasteGroupId')).toBe('drevesina');
    expect(screen.queryByRole('button', { name: IKSHA.name })).toBeNull();
  });

  it('испорченный параметр группы отбрасывается и не уносит с собой поиск из адреса', async () => {
    открыть(`#/landfills?group=${encodeURIComponent('НЕ ГРУППА!')}&q=${encodeURIComponent('Восток')}`);
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    const запрос = служба.lastTo('GET /v1/landfills');
    expect(запрос.query.get('wasteGroupId')).toBeNull();
    expect(запрос.query.get('query')).toBe('Восток');

    expect(screen.getByRole('textbox', { name: 'Поиск по названию полигона' })).toHaveValue('Восток');
    expect(screen.getByRole('button', { name: VOSTOK.name })).toBeInTheDocument();
  });

  it('группа из адреса, которой нет в справочнике, названа вслух, а не молча пропущена', async () => {
    открыть('#/landfills?group=neizvestnaya-gruppa');
    render(<LandfillsPage />);

    const предупреждение = await screen.findByText(/Группы отходов «neizvestnaya-gruppa» нет/);

    expect(предупреждение).toBeInTheDocument();
  });
});

describe('статус полигона и свежесть данных', () => {
  it('заблокированный полигон назван словом и датой, а не только цветом', async () => {
    служба.setLandfills([{ ...IKSHA, status: 'blocked' }]);
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    expect(screen.getByText('Заблокирован')).toBeInTheDocument();
    expect(screen.getByText(`данные от 17.09`)).toBeInTheDocument();
  });

  it('полигон со статусом старше порога назван устаревшим, хотя служба зовёт его активным', async () => {
    // Статус подтверждён 03.09, актуальность справочника — 17.09: отставание
    // 14 суток против порога в 7.
    служба.setLandfills([{ ...IKSHA, statusUpdatedAt: STALE_DATE }]);
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    expect(screen.getByText('Данные устарели')).toBeInTheDocument();
    expect(screen.queryByText('Активен')).toBeNull();
  });

  it('полигон, подтверждённый в день актуальности, остаётся активным', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    expect(screen.getAllByText('Активен')).toHaveLength(2);
    expect(screen.queryByText('Данные устарели')).toBeNull();
  });

  it('полоса актуальности называет день, на который показаны цены и статусы', async () => {
    render(<LandfillsPage />);

    const полоса = await screen.findByRole('status', { name: 'Актуальность данных' });

    expect(полоса).toHaveTextContent('Цены на 17.09.2026');
    expect(полоса).toHaveTextContent('Статусы на 17.09.2026');
  });

  it('полоса актуальности называет число полигонов с устаревшими данными и сам порог', async () => {
    служба.answerWith('GET /v1/data-freshness', {
      status: 200,
      body: {
        pricesUpdatedAt: FRESHNESS_DATE,
        statusesUpdatedAt: FRESHNESS_DATE,
        landfillsWithStaleData: 1,
      },
    });
    render(<LandfillsPage />);

    const полоса = await screen.findByRole('status', { name: 'Актуальность данных' });

    expect(полоса).toHaveTextContent('Данные устарели у полигонов: 1');
    expect(полоса).toHaveTextContent('Порог – 7 суток');
  });
});

describe('состояния справочника', () => {
  it('отказ реестра показан заголовком службы, а не кодом ответа', async () => {
    служба.answerWith('GET /v1/landfills', {
      status: 503,
      headers: PROBLEM_HEADERS,
      body: REGISTRY_UNAVAILABLE,
    });
    render(<LandfillsPage />);

    const отказ = await screen.findByRole('alert');

    expect(отказ).toHaveTextContent('Справочник полигонов временно недоступен');
    expect(отказ.textContent).not.toContain('503');
    expect(отказ.textContent).not.toContain('urn:imolt');
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('повтор после отказа снова обращается к службе, а не показывает прежний ответ', async () => {
    const пользователь = userEvent.setup();
    служба.answerWith('GET /v1/landfills', {
      status: 503,
      headers: PROBLEM_HEADERS,
      body: REGISTRY_UNAVAILABLE,
    });
    render(<LandfillsPage />);

    await screen.findByRole('alert');
    const до = служба.sentTo('GET /v1/landfills').length;

    await пользователь.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(служба.sentTo('GET /v1/landfills').length).toBeGreaterThan(до);
  });

  it('пустая выборка предлагает снять отбор, а не оставляет пустое место', async () => {
    открыть(`#/landfills?q=${encodeURIComponent('Такого полигона нет')}`);
    render(<LandfillsPage />);

    expect(await screen.findByText('Полигоны не найдены')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Показать все полигоны' })).toBeInTheDocument();
  });

  it('счётчик показанного называет и показанное, и найденное', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    // Формулировку счётчика ведёт общий слой; экран отвечает за числа в нём.
    const сообщения = screen.getAllByRole('status').map(узел => узел.textContent ?? '');
    expect(сообщения.join(' ')).toMatch(/2 из 2/);
  });

  it('экран не обращается к точкам договора, которых справочнику не обещали', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('list', { name: ВСЕ_ГРУППЫ });

    expect(служба.unexpected()).toEqual([]);
  });
});
