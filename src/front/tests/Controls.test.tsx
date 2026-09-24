// Поведение и доступность общего набора управлений: кнопка, флажок, вкладки,
// чип, выбор из списка, всплывающее окно, показ следующей порции, полоса
// управлений и отметка актуальности.
//
// Проверяется поведение, а не разметка: нажатие с клавиатуры, доступное имя,
// перенос фокуса стрелкой, закрытие всплывающего окна и возврат фокуса.
// Совпадение имён классов ничего о работе компонента не доказывает.
//
// Проверки фальсифицируемы: уберите `aria-label` у кнопки-значка, снимите
// обработку стрелок у вкладок и полосы управлений, перестаньте закрывать
// всплывающее окно по Escape или возвращать из него фокус, разорвите связь
// отказа с полем выбора, оставьте кнопку «Показать ещё» при показанном
// целиком списке, уберите часовой пояс из отметки актуальности — они упадут.
//
//   npx vitest run tests/Controls.test.tsx
//
// Критерия приёмки на клавиатурную доступность общих управлений в реестре нет
// (разрыв назван в отчёте), поэтому якорь обслуживающий.
//
// @supports: R-058
// @supports: R-084
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  Checkbox,
  Chip,
  DateStamp,
  Pager,
  Popover,
  Select,
  Tabs,
  Toolbar,
} from '@/shared/ui';
import { SharedSection } from '@/pages/showcase/sections/shared';

/** Флажок с собственным состоянием: без него нажатие не меняет вид. */
function ЖивойФлажок({ onChange }: { onChange: (value: boolean) => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <Checkbox
      id="soglasie"
      label="Нужна утилизация на полигоне"
      checked={checked}
      onChange={(value) => {
        setChecked(value);
        onChange(value);
      }}
    />
  );
}

/** Вкладки с собственным состоянием: стрелка переносит и фокус, и выбор. */
function ЖивыеВкладки({ onPick }: { onPick: (value: string) => void }) {
  const [value, setValue] = useState<'concrete' | 'wood' | 'soil'>('concrete');

  return (
    <Tabs
      label="Типы отходов расчёта"
      value={value}
      options={[
        { value: 'concrete' as const, label: 'Лом бетона' },
        { value: 'wood' as const, label: 'Древесина' },
        { value: 'soil' as const, label: 'Грунт' },
      ]}
      onPick={(next) => {
        setValue(next);
        onPick(next);
      }}
    />
  );
}

/** Кнопка и привязанное к ней всплывающее окно. */
function ЖивоеОкно() {
  const [open, setOpen] = useState(false);

  return (
    <span className="imolt-anchor">
      <Button kind="secondary" onClick={() => setOpen(true)}>
        Показать детали маршрута
      </Button>
      <Popover title="Детали маршрута" open={open} onClose={() => setOpen(false)}>
        <p>45 км до площадки «Восток»</p>
      </Popover>
      <button type="button">Соседнее действие</button>
    </span>
  );
}

describe('кнопка', () => {
  it('кнопка без видимой подписи объявляет действие доступным именем', () => {
    render(
      <Button ariaLabel="Показать детали маршрута" onClick={() => undefined}>
        Детали
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Показать детали маршрута' })).toBeInTheDocument();
  });

  it('кнопка в состоянии загрузки не повторяет уже идущее действие', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button loading onClick={onClick}>
        Рассчитать
      </Button>,
    );

    const button = screen.getByRole('button', { name: /Рассчитать/u });
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('флажок', () => {
  it('флажок под подписью переключается пробелом с клавиатуры', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ЖивойФлажок onChange={onChange} />);

    const box = screen.getByRole('checkbox', { name: 'Нужна утилизация на полигоне' });
    expect(box).not.toBeChecked();

    await user.tab();
    expect(box).toHaveFocus();

    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledWith(true);
    expect(box).toBeChecked();
  });
});

describe('вкладки', () => {
  it('стрелка вправо переносит выбор и фокус на соседнюю вкладку', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();

    render(<ЖивыеВкладки onPick={onPick} />);

    const concrete = screen.getByRole('tab', { name: 'Лом бетона' });
    const wood = screen.getByRole('tab', { name: 'Древесина' });

    concrete.focus();
    await user.keyboard('{ArrowRight}');

    expect(onPick).toHaveBeenCalledWith('wood');
    expect(wood).toHaveFocus();
    expect(wood).toHaveAttribute('aria-selected', 'true');
    expect(concrete).toHaveAttribute('aria-selected', 'false');
  });

  it('стрелка влево с первой вкладки переходит на последнюю', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();

    render(<ЖивыеВкладки onPick={onPick} />);

    screen.getByRole('tab', { name: 'Лом бетона' }).focus();
    await user.keyboard('{ArrowLeft}');

    expect(onPick).toHaveBeenCalledWith('soil');
    expect(screen.getByRole('tab', { name: 'Грунт' })).toHaveFocus();
  });

  it('набор вкладок назван, а обход по Tab заходит в него один раз', async () => {
    const user = userEvent.setup();

    render(<ЖивыеВкладки onPick={() => undefined} />);

    expect(screen.getByRole('tablist', { name: 'Типы отходов расчёта' })).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Лом бетона' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('tab', { name: 'Древесина' })).not.toHaveFocus();
  });
});

describe('чип фильтра', () => {
  it('включённое условие объявлено нажатым состоянием чипа', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(<Chip label="до 50 км" pressed={false} onToggle={onToggle} />);

    const chip = screen.getByRole('button', { name: 'до 50 км', pressed: false });
    await user.click(chip);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('недоступный чип не переключает условие', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(<Chip label="только активные" pressed onToggle={onToggle} disabled />);

    await user.click(screen.getByRole('button', { name: 'только активные', pressed: true }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('выбор из списка', () => {
  it('отказ поля выбора прочитан вместе с самим полем', () => {
    render(
      <Select
        id="gruppa"
        label="Группа отходов"
        value="concrete"
        options={[{ value: 'concrete' as const, label: 'Лом бетона и железобетона' }]}
        onPick={() => undefined}
        error="Группа отходов не выбрана"
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Группа отходов' });

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Группа отходов не выбрана');
  });

  it('выбор значения списком отдаёт экрану выбранное значение', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();

    render(
      <Select
        id="gruppa-vybor"
        label="Группа отходов"
        value="concrete"
        options={[
          { value: 'concrete' as const, label: 'Лом бетона и железобетона' },
          { value: 'wood' as const, label: 'Древесина от разборки' },
        ]}
        onPick={onPick}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Группа отходов' }),
      'Древесина от разборки',
    );

    expect(onPick).toHaveBeenCalledWith('wood');
  });
});

describe('всплывающее окно', () => {
  it('открытое окно объявлено диалогом с именем и получает фокус', async () => {
    const user = userEvent.setup();

    render(<ЖивоеОкно />);

    await user.click(screen.getByRole('button', { name: 'Показать детали маршрута' }));

    const dialog = screen.getByRole('dialog', { name: 'Детали маршрута' });
    expect(dialog).toHaveFocus();

    // Не модальное: страница за окном остаётся доступной (разд. 4.6).
    expect(dialog).not.toHaveAttribute('aria-modal');
    expect(screen.getByRole('button', { name: 'Соседнее действие' })).toBeInTheDocument();
  });

  it('клавиша Escape закрывает окно и возвращает фокус на вызвавшую кнопку', async () => {
    const user = userEvent.setup();

    render(<ЖивоеОкно />);

    const opener = screen.getByRole('button', { name: 'Показать детали маршрута' });
    await user.click(opener);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Детали маршрута' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('щелчок вне окна закрывает его', async () => {
    const user = userEvent.setup();

    render(<ЖивоеОкно />);

    await user.click(screen.getByRole('button', { name: 'Показать детали маршрута' }));
    expect(screen.getByRole('dialog', { name: 'Детали маршрута' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Соседнее действие' }));

    expect(screen.queryByRole('dialog', { name: 'Детали маршрута' })).not.toBeInTheDocument();
  });
});

describe('показ следующей порции', () => {
  it('показанная часть названа числом против общего количества', () => {
    render(<Pager total={10} shown={3} onMore={() => undefined} />);

    expect(screen.getByRole('status')).toHaveTextContent('Показано 3 из 10');
    expect(screen.getByRole('button', { name: 'Показать ещё' })).toBeInTheDocument();
  });

  it('показанный целиком список не предлагает показать ещё', () => {
    render(<Pager total={3} shown={3} onMore={() => undefined} />);

    expect(screen.getByRole('status')).toHaveTextContent('Показано 3 из 3');
    expect(screen.queryByRole('button', { name: 'Показать ещё' })).not.toBeInTheDocument();
  });
});

describe('полоса управлений', () => {
  it('стрелка вправо переводит фокус на соседнее действие полосы', async () => {
    const user = userEvent.setup();

    render(
      <Toolbar ariaLabel="Действия над выбором">
        <Button size="s" kind="secondary" onClick={() => undefined}>
          Скачать предложение
        </Button>
        <Button size="s" kind="tertiary" onClick={() => undefined}>
          Снять выбор
        </Button>
      </Toolbar>,
    );

    expect(screen.getByRole('toolbar', { name: 'Действия над выбором' })).toBeInTheDocument();

    screen.getByRole('button', { name: 'Скачать предложение' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('button', { name: 'Снять выбор' })).toHaveFocus();
  });
});

describe('отметка актуальности', () => {
  it('точный момент виден без наведения и сохраняет часовой пояс источника', () => {
    const { container } = render(
      <DateStamp iso="2026-09-17T12:04:00+03:00" kind="issued" now="2026-09-18" />,
    );

    expect(container.textContent).toContain('Выпущено 17.09.2026, 12:04 (UTC+03:00)');

    const moment = container.querySelector('time');
    expect(moment).toHaveAttribute('datetime', '2026-09-17T12:04:00+03:00');
  });

  it('относительный возраст стоит рядом с точным моментом, а не вместо него', () => {
    const { container } = render(<DateStamp iso="2026-09-17" kind="prices" now="2026-09-18" />);

    expect(container.textContent).toContain('Цены на 17.09.2026');
    expect(container.textContent).toContain('вчера');
  });

  it('без названной точки отсчёта относительного возраста нет', () => {
    const { container } = render(<DateStamp iso="2026-09-17" kind="statuses" />);

    expect(container.textContent).toBe('Статусы на 17.09.2026');
  });

  it('отсутствие даты названо словом, а не пустым местом', () => {
    const { container } = render(<DateStamp iso={null} kind="updated" />);

    expect(container.textContent).toBe('Обновление: дата неизвестна');
    expect(container.querySelector('time')).toBeNull();
  });
});

describe('раздел витрины общего слоя', () => {
  // Проверка полноты витрины (`tests/Showcase.test.ts`) читает текст файлов и
  // отказ при отрисовке заметить не может: образец, падающий на странице,
  // прошёл бы её молча (R-084).
  it('отрисовывается целиком и показывает каждый вид управления', () => {
    render(<SharedSection />);

    expect(screen.getByRole('table', { name: /Полигоны для лома бетона/u })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Типы отходов расчёта' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Действия над выбором' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Группа отходов' })).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Нужна утилизация на полигоне' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
  });
});
