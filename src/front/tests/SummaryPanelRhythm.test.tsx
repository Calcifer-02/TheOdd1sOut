/**
 * Ритм сводки выбора в обоих состояниях: пусто и выбрано (R-027, R-032).
 *
 * Замечание заказчика было о пустом состоянии на экране расчёта: оно не
 * выровнено. Причина оказалась не в числах, а в том, что объявленные панелью
 * шаги до экрана не доходили: общее оформление подключается корнем
 * приложения и ложится в страницу последним, а при равном весе селекторов
 * побеждает лист, лежащий ниже. Панель объявляла свой зазор одиночным
 * классом и молча получала зазор общей карточки.
 *
 * Поэтому проверка не сверяет текст правил, а спрашивает у страницы
 * вычисленное значение — так же, как его берёт браузер. Порядок подключения
 * здесь тот же, что в приложении: общее оформление подключает внешний
 * компонент, правила панели — она сама.
 *
 * Проверки фальсифицируемы: верните правилу панели одиночный класс, снимите
 * пометку состояния с разметки, уберите рамку у одного из состояний, снимите
 * тень с липкой сводки, верните сумме строки размер итога, снимите роль с
 * нижней панели телефона — они упадут.
 *
 *   npx vitest run tests/SummaryPanelRhythm.test.tsx
 *
 * @supports: R-027, R-032, R-085
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryBar, SummaryPanel, type SummaryLine } from '@/widgets/selection-summary';
import { useThemeStyles } from '@/shared/ui';
import { layout, space, stroke } from '@/shared/ui/tokens';

const СТРОКИ: SummaryLine[] = [
  { landfillId: 'vostok', landfillName: 'Комплекс переработки «Восток»', sum: '19 800 ₽' },
  { landfillId: 'iksha', landfillName: 'Площадка «Икша»', sum: '20 080 ₽' },
];

/**
 * Порядок подключения оформления тот же, что в приложении: общее оформление
 * просит внешний компонент, а правила панели — сама панель. Без него проверка
 * мерила бы правила панели в пустоте и разошлась бы с экраном.
 */
function Экран({ выбрано }: { выбрано: number }) {
  useThemeStyles();

  return (
    <SummaryPanel
      selectedCount={выбрано}
      lines={выбрано > 0 ? СТРОКИ : []}
      total="39 880 ₽"
      totalLabel="Итого"
      onRoute={() => undefined}
      onOpenQuote={() => undefined}
      onPickup={() => undefined}
    />
  );
}

/** Панель и её вычисленное оформление: то, что увидит браузер. */
function панель(выбрано: number): { узел: HTMLElement; вид: CSSStyleDeclaration } {
  const { container } = render(<Экран выбрано={выбрано} />);
  const узел = container.querySelector('.imolt-summary-panel') as HTMLElement;

  return { узел, вид: window.getComputedStyle(узел) };
}

describe('пустое состояние сводки выбора', () => {
  it('помечено в разметке, а не отличается только содержимым', () => {
    const { узел } = панель(0);

    expect(узел.classList.contains('imolt-summary-panel--empty'), 'пустое состояние не помечено').toBe(true);
    expect(узел.classList.contains('imolt-summary-panel--filled')).toBe(false);
  });

  it('держит заголовок и пояснение одной парой, а не шагом заполненной панели', () => {
    const { вид } = панель(0);
    const панельВыбора = screen.getByRole('region', { name: 'Выберите полигоны' });

    expect(
      within(панельВыбора).getByText(
        'Отметьте один или несколько – здесь появится итог, маршрут и коммерческое предложение.',
      ),
    ).toBeInTheDocument();
    expect(вид.gap, 'объявленный зазор до экрана не дошёл').toBe(`${space.xs}px`);
  });

  it('показано местом будущей сводки: пунктир вместо тени', () => {
    const { вид } = панель(0);

    expect(вид.borderTopStyle).toBe('dashed');
    expect(вид.boxShadow, 'пустое место приподнято над страницей, как заполненная сводка').toBe('');
  });
});

describe('заполненная сводка выбора', () => {
  it('помечена в разметке и приподнята тенью липкой сводки', () => {
    const { узел, вид } = панель(2);

    expect(узел.classList.contains('imolt-summary-panel--filled')).toBe(true);
    expect(узел.classList.contains('imolt-summary-panel--empty')).toBe(false);

    // Тень по договору положена всплывающему окну и липкой сводке (разд. 4.3).
    expect(вид.boxShadow).toBe(layout.shadow);
    expect(вид.gap).toBe(`${space.m}px`);
  });

  it('набирает сумму строки ступенью ниже итога', () => {
    const { узел } = панель(2);
    const суммаСтроки = узел.querySelector('.imolt-summary-sum') as HTMLElement;
    const итог = узел.querySelector('.imolt-stat-value') as HTMLElement;

    const строка = Number.parseInt(window.getComputedStyle(суммаСтроки).fontSize, 10);
    const всего = Number.parseInt(window.getComputedStyle(итог).fontSize, 10);

    expect(узел.querySelectorAll('.imolt-summary-sum')).toHaveLength(СТРОКИ.length);
    expect(строка, 'сумма строки набрана размером итога, и ступени в сводке нет').toBeLessThan(всего);
  });
});

describe('переход между состояниями сводки', () => {
  it('не двигает содержимое: рамка объявлена обоим состояниям', () => {
    // Рамка только у одного состояния сдвинула бы его содержимое на толщину
    // линии, и снятие выбора дёргало бы текст в боковой колонке.
    expect(панель(0).вид.borderTopWidth).toBe(`${stroke.hairline}px`);
    expect(панель(2).вид.borderTopWidth).toBe(`${stroke.hairline}px`);
  });

  it('занимает боковую колонку целиком в обоих состояниях', () => {
    expect(панель(0).вид.width).toBe('100%');
    expect(панель(2).вид.width).toBe('100%');
  });
});

describe('нижняя панель сводки на телефоне', () => {
  it('названа группой, а не безымянным узлом с подписью', () => {
    render(
      <SummaryBar
        selectedCount={2}
        total="39 880 ₽"
        quoteLabel="Сформировать предложение"
        onOpenQuote={() => undefined}
        onPickup={() => undefined}
      />,
    );

    expect(screen.getByRole('group', { name: 'Выбрано полигонов: 2' })).toBeInTheDocument();
  });
});
