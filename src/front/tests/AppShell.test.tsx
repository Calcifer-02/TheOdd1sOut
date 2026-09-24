/**
 * Оболочка приложения: выбор представления по ширине окна, переходы между
 * экранами и основная область содержимого (R-085, R-058).
 *
 * Проверяется поведение, а не разметка: какое дерево попадает в страницу при
 * каждой ширине, чем помечен текущий раздел, куда уходит фокус с перехода к
 * содержимому. Скрытая правилом стиля ветка проверку бы прошла, а дерево
 * доступности испортила, поэтому отсутствие второй ветки проверяется явно.
 *
 * Проверки фальсифицируемы: держите оба представления в странице сразу,
 * уберите `aria-current` у текущего раздела, снимите доступное имя у перечня
 * переходов, оберните содержимое во что угодно кроме основной области,
 * покажите на телефоне шапочные переходы вместо нижней панели, верните
 * кабинет в шапочный перечень или уберите его из нижней панели — они упадут.
 *
 *   npx vitest run tests/AppShell.test.tsx
 *
 * @ac: AC-085a
 * @ac: AC-085b
 * @supports: R-058
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from '@/widgets/app-shell';
import { SHELL_CSS } from '@/widgets/app-shell/ui/shellStyles';
import { layout, space } from '@/shared/ui/tokens';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

/** Открывает адрес экрана до отрисовки: маршрут читается из хеша страницы. */
function открытьАдрес(hash: string): void {
  window.history.replaceState(null, '', hash);
}

function отрисовать() {
  return render(
    <AppShell>
      <p>Содержимое экрана расчёта</p>
    </AppShell>,
  );
}

beforeEach(() => {
  открытьАдрес('#/');
});

describe('оболочка на широком экране', () => {
  it('широкое окно показывает переходы в шапке и не заводит нижней панели', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    const переходы = screen.getByRole('navigation', { name: 'Разделы сервиса' });

    // Перечень один: вторая ветка представления в странице не остаётся.
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(within(screen.getByRole('banner')).getByRole('navigation')).toBe(переходы);

    for (const раздел of ['Расчёт', 'Полигоны', 'Предложение', 'Редактор цен']) {
      expect(within(переходы).getByRole('link', { name: раздел })).toBeInTheDocument();
    }
  });

  it('широкое окно ведёт в кабинет профилем, а не вторым пунктом перечня', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    // Два входа в один экран в одной шапке — шум: на рабочем месте кабинет
    // открывает профиль справа (BUG-009).
    const переходы = screen.getByRole('navigation', { name: 'Разделы сервиса' });
    expect(within(переходы).queryByRole('link', { name: 'Кабинет' })).toBeNull();

    expect(screen.getByRole('link', { name: /Кабинет участника/u })).toHaveAttribute('href', '#/cabinet');
  });

  it('переход ведёт на адрес своего экрана', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    expect(screen.getByRole('link', { name: 'Полигоны' })).toHaveAttribute('href', '#/landfills');
    expect(screen.getByRole('link', { name: 'Редактор цен' })).toHaveAttribute('href', '#/references');
    expect(screen.getByRole('link', { name: 'Расчёт' })).toHaveAttribute('href', '#');
  });

  it('неопознанный участник показан заглушкой профиля, а не приглашением к входу', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    expect(screen.getByText('Гость')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Войти/u })).toBeNull();
  });
});

describe('оболочка на телефоне', () => {
  it('узкое окно показывает нижнюю панель переходов вместо шапочных', () => {
    отрисовать();

    const переходы = screen.getByRole('navigation', { name: 'Разделы сервиса' });

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(within(screen.getByRole('banner')).queryByRole('navigation')).toBeNull();
    expect(screen.getByRole('banner').contains(переходы)).toBe(false);

    // Кабинет на телефоне остаётся в перечне: профиль стоит у верхней кромки,
    // до которой большой палец не достаёт, — ровно та причина, по которой
    // нижняя панель существует (BUG-009).
    for (const раздел of ['Расчёт', 'Полигоны', 'Предложение', 'Кабинет', 'Редактор цен']) {
      expect(within(переходы).getByRole('link', { name: раздел })).toBeInTheDocument();
    }
  });
});

describe('оболочка на любой ширине', () => {
  it('открытый экран помечен текущим разделом, а остальные нет', () => {
    открытьАдрес('#/landfills');
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    expect(screen.getByRole('link', { name: 'Полигоны' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Расчёт' })).not.toHaveAttribute('aria-current');
  });

  it('на телефоне текущий раздел помечен так же, как на широком экране', () => {
    открытьАдрес('#/cabinet');
    отрисовать();

    expect(screen.getByRole('link', { name: 'Кабинет' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Предложение' })).not.toHaveAttribute('aria-current');
  });

  it('содержимое экрана лежит в основной области страницы', () => {
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    expect(within(screen.getByRole('main')).getByText('Содержимое экрана расчёта')).toBeInTheDocument();
  });

  it('переход к содержимому уводит фокус из перечня разделов в основную область', async () => {
    const user = userEvent.setup();
    setViewportWidth(DESKTOP_WIDTH);
    отрисовать();

    await user.click(screen.getByRole('button', { name: 'Перейти к содержимому' }));

    expect(screen.getByRole('main')).toHaveFocus();
  });
});

describe('левая вертикаль оболочки', () => {
  /** Боковое поле правила оболочки: первое значение после вертикального. */
  function бокСтроки(селектор: string): number {
    const заголовок = `
${селектор} {`;
    const от = SHELL_CSS.indexOf(заголовок);

    expect(от, `правило «${селектор}» объявлено оболочкой`).toBeGreaterThan(-1);

    const тело = SHELL_CSS.slice(от, SHELL_CSS.indexOf('}', от));
    const поле = /padding:\s*([^;]+);/u.exec(тело);

    expect(поле, `у правила «${селектор}» объявлено поле`).not.toBeNull();

    const части = (поле?.[1] ?? '').trim().split(/\s+/u);

    return Number.parseFloat(части[1] ?? части[0] ?? '');
  }

  // Экраны отбивают свои блоки на ширину бокового поля ячейки таблицы, чтобы
  // заголовок экрана и подпись таблицы стояли на одной вертикали. Без той же
  // отбивки марка в шапке вставала левее всего остального: на телефоне текст
  // шёл от 28 точек, а марка от 16, и экран читался как несобранный.
  it('ставит марку в шапке на вертикаль содержимого рабочего места', () => {
    expect(бокСтроки('.imolt-shell-head-line')).toBe(layout.gutterWide + space.s);
  });

  it('ставит марку в шапке на вертикаль содержимого телефона', () => {
    expect(бокСтроки('.imolt-shell--narrow .imolt-shell-head-line')).toBe(layout.gutter + space.s);
  });
});
