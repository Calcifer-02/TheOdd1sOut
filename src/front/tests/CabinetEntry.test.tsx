/**
 * Вход в кабинет в двух представлениях: рабочее место и телефон (экран Э-09).
 *
 * Состояние «участник не опознан» на стенде единственное доступное — подпись
 * стартовых параметров проверяется по ключу бота, — поэтому именно оно
 * попадает на демонстрацию и обязано выглядеть рабочим местом, а не колонкой
 * телефона в половину окна.
 *
 * Раскладку jsdom не считает, а вычисленное оформление отдаёт. Поэтому
 * проверяется то, из чего раскладка следует: какое дерево разметки построено,
 * какие колонки ему достались, снят ли прежний предел ширины у карточки
 * объяснения и что второй ветки в дереве страницы нет (R-085, AC-085a).
 *
 * Оформление подключается в том же порядке, что в приложении: общее — внешним
 * компонентом, правила экрана — самим экраном. Порядок важен: лист общего слоя
 * ложится последним и при равном весе селекторов побеждает.
 *
 * Проверки фальсифицируемы: верните одно дерево на обе ширины, уберите
 * боковую колонку из правил входа, перепишите объяснение входа второй
 * редакцией в одном из представлений, назовите возможность кабинета иначе,
 * чем её называет сам раздел, пообещайте вход по телефону — они упадут.
 *
 *   npx vitest run tests/CabinetEntry.test.tsx
 *
 * @supports: R-049, R-050, R-052, R-085
 */
import { configure, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CabinetPage } from '@/pages/cabinet';
import { CABINET_BENEFITS, ENTRY_LEAD, benefitDetail, benefitLabel } from '@/pages/cabinet/model/entry';
import { forget, signIn } from '@/entities/participant';
import { useThemeStyles } from '@/shared/ui';
import { layout } from '@/shared/ui/tokens';
import { DESKTOP_WIDTH, MOBILE_WIDTH, setViewportWidth } from './viewport';
import { installCabinetStub, СТАРТОВЫЕ_ПАРАМЕТРЫ, type CabinetStub } from './stubs/cabinet';

configure({ asyncUtilTimeout: 2000 });

let служба: CabinetStub;

/** Экран кабинета вместе с общим оформлением, как его собирает приложение. */
function Экран() {
  useThemeStyles();

  return <CabinetPage />;
}

/** Корень представления входа: у каждой ширины он свой. */
function дерево(вид: 'wide' | 'narrow'): Element | null {
  return document.querySelector(`.imolt-cabinet-entry--${вид}`);
}

/** Вычисленное оформление узла: то, что увидит браузер. */
function вид(селектор: string): CSSStyleDeclaration {
  return window.getComputedStyle(document.querySelector(селектор) as HTMLElement);
}

beforeEach(() => {
  служба = installCabinetStub();
});

afterEach(() => {
  forget();
  delete window.WebApp;
  служба.restore();
});

describe('вход в кабинет на рабочем месте', () => {
  beforeEach(() => {
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('строит представление рабочего места, а не колонку телефона', () => {
    render(<CabinetPage />);

    expect(дерево('wide'), 'на широком окне вход показан деревом телефона').not.toBeNull();
    expect(дерево('narrow'), 'ветка телефона осталась в дереве страницы').toBeNull();
  });

  it('отводит объяснению основную колонку, а перечню — боковую', () => {
    render(<Экран />);

    // Ширина боковой колонки — та же роль из токенов, что и у сводки выбора на
    // экране расчёта: второе число разошлось бы с первым.
    expect(вид('.imolt-cabinet-entry').gridTemplateColumns, 'боковая колонка входу не досталась').toBe(
      `minmax(0, 1fr) ${layout.sideColumnWidth}px`,
    );

    // Прежний предел в половину окна снят: именно он прижимал объяснение к
    // левому краю на окне 1496 точек.
    expect(вид('.imolt-cabinet-signin').maxWidth, 'объяснение осталось карточкой фиксированной ширины').toBe('none');
  });

  it('называет рядом, что кабинет даёт опознанному участнику', () => {
    render(<CabinetPage />);

    const перечень = screen.getByRole('complementary', { name: 'Что кабинет даёт опознанному участнику' });

    for (const возможность of CABINET_BENEFITS) {
      expect(within(перечень).getByText(benefitLabel(возможность.section))).toBeInTheDocument();
      expect(within(перечень).getByText(возможность.detail)).toBeInTheDocument();
    }
  });

  it('не обещает входа по телефону, коду или паролю', () => {
    render(<CabinetPage />);

    // Своего входа у сервиса нет (ADR-0006, снятое решение R-066), поэтому
    // вводить на этом экране нечего: ни одного поля и ни одной кнопки,
    // обещающей код подтверждения.
    expect(document.querySelectorAll('input'), 'на экране входа появилось поле ввода').toHaveLength(0);
    expect(screen.queryByRole('button', { name: /код|войти|пароль/iu })).toBeNull();
    expect(screen.getByRole('link', { name: 'Открыть чат-бота ИМОЛТ' })).toHaveAttribute(
      'href',
      'https://max.ru/t782_hakaton_max_bot',
    );
  });
});

describe('вход в кабинет на телефоне', () => {
  beforeEach(() => {
    setViewportWidth(MOBILE_WIDTH);
  });

  it('оставляет одну колонку', () => {
    render(<CabinetPage />);

    expect(дерево('narrow')).not.toBeNull();
    expect(дерево('wide'), 'ветка рабочего места осталась в дереве страницы').toBeNull();
  });

  it('не выносит перечень возможностей вперёд единственного действия', () => {
    render(<CabinetPage />);

    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByRole('link', { name: 'Открыть чат-бота ИМОЛТ' })).toBeInTheDocument();
  });
});

describe('слова о входе', () => {
  it('одни на оба представления', () => {
    setViewportWidth(DESKTOP_WIDTH);
    const рабочееМесто = render(<CabinetPage />);
    expect(рабочееМесто.container.textContent).toContain(ENTRY_LEAD);
    рабочееМесто.unmount();

    setViewportWidth(MOBILE_WIDTH);
    const телефон = render(<CabinetPage />);
    expect(телефон.container.textContent, 'объяснение входа переписано второй редакцией').toContain(ENTRY_LEAD);
  });

  it('обещают возможность теми же словами, какими её называет сам раздел', async () => {
    setViewportWidth(MOBILE_WIDTH);
    window.WebApp = { initData: СТАРТОВЫЕ_ПАРАМЕТРЫ };
    await signIn(true);
    render(<CabinetPage />);

    const раздел = await screen.findByRole('region', { name: 'Расчёты' });

    expect(within(раздел).getByText(benefitDetail('calculations'))).toBeInTheDocument();
  });
});
