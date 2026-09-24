/**
 * Кабинет на рабочем месте: таблица расчётов и боковое меню (экран Э-10).
 *
 * Требование заказчика — у экрана есть и мобильное, и десктопное
 * представление, и различаются они деревом разметки, а не шириной колонок.
 * Проверка фальсифицируема: она падает, если на широком экране расчёты
 * останутся карточками, если боковое меню перестанет отмечать открытый
 * раздел и если «показать ещё» перестанет догружать следующую страницу.
 *
 *   npx vitest run tests/CabinetDesktop.test.tsx
 *
 * @supports: R-008, R-049
 */
import { configure, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CabinetPage } from '@/pages/cabinet';
import { forget, signIn } from '@/entities/participant';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import {
  installCabinetStub,
  АДРЕС_ВЫВОЗА,
  СТАРТОВЫЕ_ПАРАМЕТРЫ,
  type CabinetStub,
  type CalculationSummary,
} from './stubs/cabinet';

// Прогон идёт в несколько потоков на одной машине, и ожидание по
// умолчанию в одну секунду под нагрузкой истекает раньше, чем ответ
// заглушки доходит до разметки. Запас ожидания утверждения не меняет.
configure({ asyncUtilTimeout: 2000 });

let служба: CabinetStub;

async function опознать(): Promise<void> {
  window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
  await signIn(true);
}

/** Расчёты числом больше страницы: иначе «показать ещё» проверять нечем. */
function расчёты(количество: number): CalculationSummary[] {
  return Array.from({ length: количество }, (_, index) => ({
    id: `calc-${index}`,
    createdAt: '2026-09-18T09:12:00+03:00',
    pickupAddress: `${АДРЕС_ВЫВОЗА} стр ${index + 1}`,
    total: { amount: '39880.00', currency: 'RUB' as const },
    quoteNumber: null,
  }));
}

beforeEach(() => {
  служба = installCabinetStub();
  setViewportWidth(DESKTOP_WIDTH);
});

afterEach(() => {
  forget();
  delete window.WebApp;
  служба.restore();
});

describe('кабинет на рабочем месте', () => {
  it('показывает сохранённые расчёты таблицей со столбцами, а не карточками', async () => {
    await опознать();
    render(<CabinetPage />);

    const таблица = await screen.findByRole('table', { name: 'Сохранённые расчёты' });
    expect(таблица).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: 'Итого' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Адрес вывоза' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: `Открыть расчёт: ${АДРЕС_ВЫВОЗА}` })).toBeInTheDocument();
  });

  it('боковое меню отмечает открытый раздел и переводит в него', async () => {
    const пользователь = userEvent.setup();
    await опознать();
    render(<CabinetPage />);

    const переход = await screen.findByRole('button', { name: 'Услуги' });
    expect(переход, 'закрытый раздел отмечен открытым').not.toHaveAttribute('aria-current', 'page');

    await пользователь.click(переход);

    expect(await screen.findByRole('heading', { name: 'Услуги по документации' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Услуги' })).toHaveAttribute('aria-current', 'page');
    expect(window.location.hash).toContain('tab=services');
  });

  it('показывает первую страницу расчётов, а остальные — по действию участника', async () => {
    const пользователь = userEvent.setup();
    служба.setCalculations(расчёты(12));
    await опознать();
    render(<CabinetPage />);

    // Счётчик показанного против общего меняет решение участника, поэтому
    // утверждение идёт по нему, а не по числу строк в разметке (PRACT-024).
    expect(await screen.findByText('Показано 10 из 12'), 'первая страница договора — десять строк').toBeInTheDocument();

    await пользователь.click(screen.getByRole('button', { name: /Показать ещё/ }));

    expect(await screen.findByText('Показано 12 из 12')).toBeInTheDocument();
    expect(await screen.findAllByRole('link', { name: /Открыть расчёт/ })).toHaveLength(12);
    expect(служба.lastTo('GET /v1/calculations').query.get('offset')).toBe('10');
  });
});
