/**
 * Раскладка экрана справочника полигонов: одна левая вертикаль, полоса отбора
 * и шапка таблицы (BUG-003, BUG-011).
 *
 * Заказчик прочитал экран так: вертикали блоков не совпадают, поиск, группы
 * отходов и сброс читаются тремя решениями, управления полосы отбора разной
 * высоты стоят в одной строке, а шапка таблицы «крива по вёрстке и
 * отступам». Проверки измеряют ровно это: отступ содержимого от края экрана,
 * состав строк полосы отбора, общую высоту её управлений, видимую подпись
 * отбора, выравнивание заголовка тарифа, доли ширины столбцов, границы
 * таблицы и разделители перечня тарифов внутри ячейки.
 *
 * Проверки фальсифицируемы: снимите поле у заголовочного блока, поставьте
 * поиск и отбор одной строкой, задайте чипу собственную высоту, подмените
 * видимую подпись отбора на `aria-label`, прижмите заголовок тарифа вправо,
 * отдайте ширину столбцов содержимому, схлопните границы таблицы или снимите
 * линию между парами перечня — падает именно та проверка, которая об этом
 * говорит.
 *
 *   npx vitest run tests/LandfillsLayout.test.tsx
 *
 * Критерия приёмки на раскладку справочника в реестре нет: AC-085a требует
 * двух деревьев разметки, а не одной вертикали. Поэтому ссылка на требования.
 *
 * @supports: R-039, R-040, R-058, R-085
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LandfillsPage } from '@/pages/landfills';
import { LANDFILLS_CSS } from '@/pages/landfills/ui/styles';
import { layout, radius, stroke } from '@/shared/ui/tokens';
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

/**
 * Высота управления по действующим правилам: заданная, а если её нет — та,
 * ниже которой управление не опускается. Настоящей раскладки в jsdom нет, но
 * объявленную меру он считает, и разнобой высот в строке виден именно так.
 */
function высотаУправления(узел: Element): number {
  const стиль = getComputedStyle(узел);
  const заданная = Number.parseFloat(стиль.height);

  return Number.isNaN(заданная) ? Number.parseFloat(стиль.minHeight) : заданная;
}

function узлы(селектор: string): Element[] {
  return [...document.querySelectorAll(селектор)];
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
      актуальность: leftInset(screen.getByRole('status', { name: 'Актуальность данных' }), корень),
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
      актуальность: leftInset(screen.getByRole('status', { name: 'Актуальность данных' }), корень),
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
  it('разводит поиск и отбор по группе на две строки одной плашки', async () => {
    window.history.replaceState(null, '', `#/landfills?q=${encodeURIComponent('Восток')}`);
    // Чипы групп — вид рабочего места: на телефоне группа выбирается
    // закрытым списком (R-085).
    setViewportWidth(DESKTOP_WIDTH);
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    const поиск = await screen.findByRole('search', { name: 'Поиск полигона' });
    const группы = screen.getByRole('group', { name: 'Группа отходов' });
    const сброс = screen.getByRole('button', { name: 'Сбросить отбор' });

    const плашка = поиск.parentElement as Element;
    expect(плашка.classList.contains('imolt-landfills-filters')).toBe(true);

    // Плашка осталась одна, но строк в ней две: поиск и отбор по группе —
    // два названных блока, и в одной строке их подписи встают на разных
    // уровнях (второй пакет замечаний заказчика).
    expect(getComputedStyle(плашка).display).toBe('grid');
    expect(плашка.contains(группы)).toBe(true);
    expect(поиск.contains(группы)).toBe(false);

    // Сброс снимает и поиск, и группу, и стоит в строке отбора — не третьим
    // блоком со своим отступом (BUG-003).
    const строкаОтбора = сброс.parentElement as Element;
    expect(строкаОтбора.contains(группы)).toBe(true);
    expect(строкаОтбора.parentElement).toBe(плашка);
  });

  it('держит управления полосы отбора одной высоты', async () => {
    window.history.replaceState(null, '', `#/landfills?q=${encodeURIComponent('Восток')}`);
    // Чипы групп — вид рабочего места: на телефоне группа выбирается
    // закрытым списком (R-085).
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    const поиск = await screen.findByRole('search', { name: 'Поиск полигона' });
    const плашка = поиск.parentElement as Element;

    // Общую высоту управлений задаёт общий слой; экран обязан её не
    // перебивать. В плашке стоят поле, «Найти», чипы групп и сброс — мера у
    // них одна, иначе полоса снова читается набором разнородных управлений.
    // Скрытый переключатель внутри «таблетки» — механизм доступности, а не
    // видимое управление: его меру никто не видит, и в полосу она не считается.
    const меры = [...плашка.querySelectorAll('input:not([type="radio"]), button')].map(высотаУправления);
    expect(меры.length).toBeGreaterThan(4);
    expect([...new Set(меры)]).toEqual([layout.controlHeight]);

    expect(getComputedStyle(поиск).alignItems).toBe('flex-end');
  });

  it('называет отбор по группе видимой подписью, а не одним доступным именем', async () => {
    setViewportWidth(DESKTOP_WIDTH);
    render(<LandfillsPage />);

    await screen.findByRole('search', { name: 'Поиск полигона' });

    const группы = screen.getByRole('group', { name: 'Группа отходов' });
    const подпись = document.getElementById(группы.getAttribute('aria-labelledby') ?? '');

    // Доступное имя и видимая подпись — один текст: `aria-label` называл
    // отбор только вспомогательной технологии, и зрячий пользователь не
    // знал, по чему идёт отбор.
    expect(подпись).not.toBeNull();
    expect(подпись?.textContent).toBe('Группа отходов');
    expect(подпись?.className).toContain('imolt-label');
  });
});

describe('таблица справочника полигонов', () => {
  beforeEach(() => {
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('ставит заголовок тарифа над началом ячейки, а не над её правым краем', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    const тариф = screen.getByRole('columnheader', { name: 'Тариф утилизации, ₽/т' });
    const полигон = screen.getByRole('columnheader', { name: 'Полигон' });

    // В ячейке — перечень «группа отходов — цена», и он начинается слева.
    // Прижатый вправо заголовок стоял над ценами соседнего столбца.
    expect(тариф.getAttribute('data-align')).toBe('start');
    // Вертикаль заголовка сравнивается с соседним столбцом, а не с числом:
    // выравнивание шапки задаёт общий слой, и его мера — не дело экрана.
    expect(getComputedStyle(тариф).textAlign).toBe(getComputedStyle(полигон).textAlign);
  });

  it('задаёт ширины столбцов долями, а не длиной названия юридического лица', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    const доли = screen.getAllByRole('columnheader').map(столбец => (столбец as HTMLElement).style.width);

    expect(доли).toEqual(['30%', '22%', '32%', '16%']);
    // Доли считаются от ширины таблицы только при заданной раскладке: без неё
    // ширину столбца снова назначает самая длинная строка в нём.
    expect(getComputedStyle(узлы('.imolt-landfills-table table')[0]).tableLayout).toBe('fixed');
  });

  it('не схлопывает границы таблицы поверх правила общего слоя', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    // Схлопнутые границы отдают линию под липкой шапкой самой таблице, и при
    // прокрутке первая строка уезжает под шапку без разделителя (BUG-001).
    // Общий слой держит раздельные границы, экран их не перебивает.
    expect(getComputedStyle(узлы('.imolt-landfills-table table')[0]).borderCollapse).toBe('separate');
  });

  it('отделяет пары «группа отходов — цена» линией, а не сливает их в текст', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('table', { name: ВСЕ_ГРУППЫ });

    const строки = узлы('.imolt-landfills-table .imolt-tariffs-row');
    expect(строки.length).toBeGreaterThan(1);

    const последняя = строки[строки.length - 1];

    expect(Number.parseFloat(getComputedStyle(строки[0]).borderBottomWidth)).toBe(stroke.hairline);
    // Линия под последней парой читалась бы разделителем строки таблицы.
    expect(Number.parseFloat(getComputedStyle(последняя).borderBottomWidth)).toBe(0);
  });
});

describe('название полигона в таблице', () => {
  // Общий слой рисует третьестепенную кнопку таблеткой в 999 точек. У названия
  // в две строки и без бокового поля буквы упирались в закруглённые торцы, а
  // заливка наведения обрезала первую и последнюю.
  it('не рисует название таблеткой общего слоя', () => {
    render(<LandfillsPage />);

    const правило = LANDFILLS_CSS.slice(LANDFILLS_CSS.indexOf('.imolt-landfill-name > .imolt-button,')).slice(0, 400);

    expect(правило, 'скругление названия не переобъявлено').toContain('border-radius:');
    expect(правило, 'скругление объявлено таблеткой').not.toContain(`${radius.pill}px`);
  });

  it('отвечает на наведение подчёркиванием, а не заливкой', () => {
    render(<LandfillsPage />);

    const at = LANDFILLS_CSS.indexOf('.imolt-landfill-name > .imolt-button:hover');

    expect(at, 'отклик названия на наведение не объявлен').toBeGreaterThan(-1);

    const правило = LANDFILLS_CSS.slice(at, at + 300);

    expect(правило).toContain('background: none;');
    expect(правило).toContain('text-decoration-thickness:');
  });
});

describe('отбор по группе на телефоне', () => {
  // Названия групп длинные, и в узкой колонке каждый чип вставал своей
  // строкой — столбик разной длины вместо полосы отбора (замечание
  // заказчика от 24.09.2026).
  it('выбирается закрытым списком, а не столбиком чипов', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('search', { name: 'Поиск полигона' });

    expect(screen.getByLabelText('Группа отходов').tagName).toBe('SELECT');
    expect(screen.queryByRole('group', { name: 'Группа отходов' }), 'чипы остались в дереве страницы').toBeNull();
  });

  it('список несёт все группы и снятие отбора', async () => {
    render(<LandfillsPage />);

    await screen.findByRole('search', { name: 'Поиск полигона' });

    const список = screen.getByLabelText('Группа отходов') as HTMLSelectElement;

    expect([...список.options][0]?.textContent, 'снять отбор списком нечем').toBe('Все группы');
    expect(список.options.length).toBeGreaterThan(1);
  });
});
