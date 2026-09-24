/**
 * Поведение и доступность общего набора управлений: кнопка, флажок, вкладки,
 * чип, выбор из списка, всплывающее окно, показ следующей порции, полоса
 * управлений и отметка актуальности.
 *
 * Проверяется поведение, а не разметка: нажатие с клавиатуры, доступное имя,
 * перенос фокуса стрелкой, закрытие всплывающего окна и возврат фокуса.
 * Совпадение имён классов ничего о работе компонента не доказывает.
 *
 * Проверки фальсифицируемы: уберите `aria-label` у кнопки-значка, снимите
 * обработку стрелок у вкладок и полосы управлений, перестаньте закрывать
 * всплывающее окно по Escape или возвращать из него фокус, разорвите связь
 * отказа с полем выбора, оставьте кнопку «Показать ещё» при показанном
 * целиком списке, уберите часовой пояс из отметки актуальности, снимите
 * `aria-hidden` с резервной подписи кнопки, оставьте вынесенное окно в
 * разметке обрезающего предка, выпустите фокус из модального окна, снимите
 * блокировку прокрутки под ним или возмещение ширины полосы прокрутки — они
 * упадут.
 *
 *   npx vitest run tests/Controls.test.tsx
 *
 * Критерия приёмки на клавиатурную доступность общих управлений в реестре нет
 * (разрыв назван в отчёте), поэтому якорь обслуживающий.
 *
 * @supports: R-033
 * @supports: R-058
 * @supports: R-084
 */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Checkbox, Chip, DateStamp, Field, Modal, Pager, Popover, Select, Tabs, Toolbar } from '@/shared/ui';
import { SharedSection } from '@/pages/showcase/sections/shared';

/** Флажок с собственным состоянием: без него нажатие не меняет вид. */
function ЖивойФлажок({ onChange }: { onChange: (value: boolean) => void }) {
  const [checked, setChecked] = useState(false);

  return (
    <Checkbox
      id="soglasie"
      label="Нужна утилизация на полигоне"
      checked={checked}
      onChange={value => {
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
      onPick={next => {
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

/**
 * Кнопка и окно внутри области, которая режет содержимое: так стоит ячейка
 * «Маршрут» в области прокрутки таблицы сравнения (R-033).
 */
function ЖивоеОкноВОбрезке() {
  const [open, setOpen] = useState(false);

  return (
    <div className="imolt-table-scroll">
      <span className="imolt-cell-route">
        <Button kind="secondary" onClick={() => setOpen(true)}>
          Показать детали маршрута
        </Button>
        <Popover detached title="Детали маршрута" open={open} onClose={() => setOpen(false)}>
          <p>45 км до площадки «Восток»</p>
        </Popover>
      </span>
    </div>
  );
}

/**
 * Кнопка и модальное окно поверх страницы. Признака «открыто» у окна нет:
 * пока оно в разметке — оно открыто, и состояние держит экран.
 */
function ЖивоеМодальноеОкно() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Показать маршрут
      </button>
      <button type="button">Соседнее действие</button>
      {open && (
        <Modal title="Маршрут до полигона" onClose={() => setOpen(false)}>
          <button type="button">Первое действие окна</button>
          <a href="https://example.test/route">Открыть во внешних картах</a>
        </Modal>
      )}
    </div>
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

  /**
   * Переключатель порядка сортировки меняет подпись вместе с состоянием, и
   * вместе с подписью менялась бы ширина кнопки: соседи по полосе управления
   * сдвигались бы на каждое нажатие (второй пакет замечаний заказчика по
   * живому стенду, R-024).
   */
  it('кнопка с резервом держит место под вторую подпись, но названа текущей', () => {
    render(
      <Button kind="tertiary" reserve="По возрастанию" onClick={() => undefined}>
        По убыванию
      </Button>,
    );

    const кнопка = screen.getByRole('button', { name: 'По убыванию' });
    const резерв = кнопка.querySelector('.imolt-button-reserve');

    expect(резерв?.textContent, 'резерв держит самую длинную подпись переключателя').toBe('По возрастанию');
    expect(резерв, 'резерв не читается вспомогательной технологией').toHaveAttribute('aria-hidden', 'true');
    // Резервная подпись в доступном имени превратила бы его в «По убыванию
    // По возрастанию» — имя кнопки перестало бы называть текущее состояние.
    expect(screen.queryByRole('button', { name: /По возрастанию/u })).toBeNull();
  });

  it('кнопка без резерва не заводит скрытой подписи', () => {
    render(<Button onClick={() => undefined}>Рассчитать</Button>);

    expect(screen.getByRole('button', { name: 'Рассчитать' }).querySelector('.imolt-button-reserve')).toBeNull();
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

    await user.selectOptions(screen.getByRole('combobox', { name: 'Группа отходов' }), 'Древесина от разборки');

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

/**
 * Замер живого стенда 24.09.2026 при ширине окна 1496: окно маршрута 360 × 400
 * стояло внутри ячейки 78 × 48 и области прокрутки 776 × 254 с «overflow:
 * auto», которая резала его справа и снизу. Раскладки в jsdom нет, поэтому
 * проверяется устройство, из которого дефект следует: где узел окна лежит в
 * дереве и чем он позиционируется (R-033).
 */
describe('всплывающее окно внутри обрезающей области', () => {
  it('вынесенное окно лежит в корне страницы, а не в разметке обрезающего предка', async () => {
    const user = userEvent.setup();

    render(<ЖивоеОкноВОбрезке />);

    await user.click(screen.getByRole('button', { name: 'Показать детали маршрута' }));

    const dialog = screen.getByRole('dialog', { name: 'Детали маршрута' });

    expect(dialog.closest('.imolt-table-scroll'), 'предок с «overflow: auto» режет окно по своим краям').toBeNull();
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog, 'вынесенное окно ставится по координатам окна браузера').toHaveAttribute('data-detached', 'true');
  });

  it('вынесенное окно закрывается по Escape и возвращает фокус на вызвавшую кнопку', async () => {
    const user = userEvent.setup();

    render(<ЖивоеОкноВОбрезке />);

    const opener = screen.getByRole('button', { name: 'Показать детали маршрута' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Детали маршрута' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Детали маршрута' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

/**
 * Модальное окно: разговор поверх страницы. Решением заказчика от 24.09.2026
 * маршрут до полигона показывается именно им, и прежний запрет дизайн-договора
 * на модальное окно для маршрута снят (R-033).
 *
 * Раскладки в jsdom нет, поэтому проверяется устройство: признаки роли, место
 * узла в дереве, ловушка фокуса и правка стилей корня страницы.
 */
describe('модальное окно', () => {
  /** Возврат подменённого окружения: ширина корня и прокрутка общие на файл. */
  const вернуть: (() => void)[] = [];

  afterEach(() => {
    while (вернуть.length > 0) {
      вернуть.pop()?.();
    }
  });

  /** Ширина полосы прокрутки: разница окна браузера и корня страницы. */
  function поставитьПолосуПрокрутки(ширина: number): void {
    const было = Object.getOwnPropertyDescriptor(document.documentElement, 'clientWidth');

    Object.defineProperty(document.documentElement, 'clientWidth', {
      value: window.innerWidth - ширина,
      configurable: true,
    });

    вернуть.push(() => {
      if (было === undefined) {
        Reflect.deleteProperty(document.documentElement, 'clientWidth');
      } else {
        Object.defineProperty(document.documentElement, 'clientWidth', было);
      }
    });
  }

  /** Страница, прокрученная до названного места, и запись возвратов к нему. */
  function поставитьПрокрутку(место: number): ReturnType<typeof vi.fn> {
    const былоМесто = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const былВозврат = window.scrollTo;
    const возврат = vi.fn();

    Object.defineProperty(window, 'scrollY', { value: место, configurable: true });
    window.scrollTo = возврат as unknown as typeof window.scrollTo;

    вернуть.push(() => {
      window.scrollTo = былВозврат;

      if (былоМесто === undefined) {
        Reflect.deleteProperty(window, 'scrollY');
      } else {
        Object.defineProperty(window, 'scrollY', былоМесто);
      }
    });

    return возврат;
  }

  it('объявлено модальным диалогом с именем из заголовка и получает фокус', async () => {
    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));

    const dialog = screen.getByRole('dialog', { name: 'Маршрут до полигона' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    // Окно уходит порталом в корень страницы: внутри обрезающей области оно
    // режется по её краям (R-033).
    expect(dialog.parentElement?.parentElement).toBe(document.body);
  });

  it('называет крестик закрытия словами, а не одним значком', async () => {
    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));

    const крестик = screen.getByRole('button', { name: 'Закрыть «Маршрут до полигона»' });

    expect(крестик.textContent, 'подпись крестика — значок, и доступное имя даёт его кнопка').toBe('');
  });

  it('держит фокус внутри себя: с последнего управления Tab уходит на первое', async () => {
    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));

    const крестик = screen.getByRole('button', { name: 'Закрыть «Маршрут до полигона»' });
    const ссылка = screen.getByRole('link', { name: 'Открыть во внешних картах' });

    ссылка.focus();
    await user.tab();

    expect(крестик, 'фокус ушёл бы на страницу, перехваченную подложкой').toHaveFocus();

    await user.tab({ shift: true });

    expect(ссылка, 'обход назад с первого управления возвращается на последнее').toHaveFocus();
  });

  it('блокирует прокрутку страницы, пока открыто, и снимает блокировку при закрытии', async () => {
    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));

    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(document.body.style.overflow, 'страница осталась бы заблокированной после закрытия').toBe('');
  });

  it('не двигает страницу на ширину полосы прокрутки, пока она скрыта', async () => {
    поставитьПолосуПрокрутки(15);

    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));

    expect(document.body.style.paddingRight, 'без возмещения содержимое прыгает вправо').toBe('15px');

    await user.keyboard('{Escape}');

    expect(document.body.style.paddingRight, 'возмещение пережило бы само окно').toBe('');
  });

  it('возвращает страницу на прежнее место после закрытия', async () => {
    const возврат = поставитьПрокрутку(240);

    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));
    await user.keyboard('{Escape}');

    expect(возврат, 'часть браузеров уводит страницу к началу при снятии блокировки').toHaveBeenCalledWith(0, 240);
  });

  it('закрывается нажатием по подложке и возвращает фокус на вызвавшую кнопку', async () => {
    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);

    const opener = screen.getByRole('button', { name: 'Показать маршрут' });
    await user.click(opener);

    const подложка = screen.getByRole('dialog', { name: 'Маршрут до полигона' }).parentElement as HTMLElement;
    await user.click(подложка);

    expect(screen.queryByRole('dialog', { name: 'Маршрут до полигона' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('нажатие внутри окна его не закрывает', async () => {
    const user = userEvent.setup();

    render(<ЖивоеМодальноеОкно />);
    await user.click(screen.getByRole('button', { name: 'Показать маршрут' }));

    await user.click(screen.getByRole('button', { name: 'Первое действие окна' }));

    expect(screen.getByRole('dialog', { name: 'Маршрут до полигона' })).toBeInTheDocument();
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

  // Полоса перехватывала стрелки у всего, что внутри неё, и текст в поле
  // поиска редактора цен нельзя было править кареткой: стрелка уводила фокус
  // на соседнюю вкладку. Стрелки принадлежат полю ввода, а не полосе.
  it('стрелка внутри поля ввода двигает каретку, а не фокус полосы', async () => {
    const user = userEvent.setup();

    render(
      <Toolbar ariaLabel="Отбор записей справочника">
        <Field id="toolbar-query" label="Поиск по полигону" value="бетон" onChange={() => undefined} />
        <Button size="s" kind="tertiary" onClick={() => undefined}>
          Сбросить отбор
        </Button>
      </Toolbar>,
    );

    const поле = screen.getByRole('textbox', { name: 'Поиск по полигону' });
    поле.focus();
    await user.keyboard('{ArrowLeft}');

    expect(поле, 'полоса увела фокус из поля ввода').toHaveFocus();
  });
});

describe('отметка актуальности', () => {
  it('точный момент виден без наведения и сохраняет часовой пояс источника', () => {
    const { container } = render(<DateStamp iso="2026-09-17T12:04:00+03:00" kind="issued" now="2026-09-18" />);

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
    expect(screen.getByRole('checkbox', { name: 'Нужна утилизация на полигоне' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Рассчитать' })).toBeInTheDocument();
  });
});
