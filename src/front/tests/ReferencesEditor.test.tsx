/**
 * Редактор цен и справочников (Э-11): правка тарифа и цены перевозки,
 * ручной статус полигона, отказ по праву ведения и состояние в адресе.
 *
 * Проверяется единственная измеряемая метрика пути 3 карты пользователя:
 * удачная правка тарифа обязана сдвинуть показанную дату актуальности цен
 * (R-048). Проверяется и обратное: отказ службы оставляет в ячейке прежнее
 * значение — оптимистичная правка без отката показала бы цену, которой в
 * справочнике нет.
 *
 * Критерия приёмки на интерфейс редактора в пакете аналитики нет: AC-042c,
 * AC-044a и AC-048c описывают поведение расчётной части. Поэтому якорь
 * файла — `@supports`, а разрыв назван в отчёте.
 *
 * Проверки фальсифицируемы: оставьте дату актуальности прежней после
 * правки, примените набранное значение при отказе службы, дайте править
 * справочник после ответа 403, потеряйте вкладку из адреса — они упадут.
 *
 *   npx vitest run tests/ReferencesEditor.test.tsx
 *
 * @supports: R-042, R-043, R-044, R-048
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReferencesPage } from '@/pages/references';
import {
  type MaintenanceStub,
  AUTHENTICATION_REQUIRED,
  EDIT_DATE,
  FRESHNESS_DATE,
  ROLE_REQUIRED,
  SYNC_RUN,
  installMaintenanceStub,
  problem,
} from './stubs/maintenance';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

type Пользователь = ReturnType<typeof userEvent.setup>;

/** Доступное имя ячейки тарифа: полигон и группа, а не позиция строки. */
const ТАРИФ_ИКША = 'Тариф утилизации, Площадка «Икша», Лом бетона и железобетона';

const ТАРИФ_ВОСТОК = 'Тариф утилизации, Комплекс переработки «Восток», Лом бетона и железобетона';

const ЦЕНА_БЕТОН = 'Цена перевозки, Лом бетона и железобетона';

let служба: MaintenanceStub;

beforeEach(() => {
  служба = installMaintenanceStub();
});

afterEach(() => {
  служба.restore();
});

/** Ячейка справочника в покое: доступное имя несёт и значение. */
function ячейка(имя: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${имя}:`) });
}

/** Дата на экране в разметке времени: точный момент доступен машине. */
function датаНаЭкране(дата: string): Element | null {
  return document.querySelector(`time[datetime="${дата}"]`);
}

/** Набор нового значения в ячейке: прежнее стирается, а не дополняется. */
async function набрать(
  пользователь: Пользователь,
  имя: string,
  значение: string,
): Promise<HTMLElement> {
  await пользователь.click(ячейка(имя));

  const поле = screen.getByRole('textbox', { name: имя });
  await пользователь.clear(поле);
  await пользователь.type(поле, значение);

  return поле;
}

async function дождатьсяСправочника(): Promise<void> {
  await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });
}

describe('редактор цен на рабочем месте', () => {
  beforeEach(() => {
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('правка тарифа утилизации двигает показанную дату актуальности цен', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    expect(датаНаЭкране(FRESHNESS_DATE)).not.toBeNull();
    expect(датаНаЭкране(EDIT_DATE)).toBeNull();

    await набрать(пользователь, ТАРИФ_ИКША, '480');
    await пользователь.click(screen.getByRole('button', { name: `Сохранить ${ТАРИФ_ИКША}` }));

    await waitFor(() => expect(датаНаЭкране(EDIT_DATE)).not.toBeNull());

    expect(служба.bodyOf('PUT /v1/landfills/:id/tariffs/:wasteGroupId')).toEqual({
      disposalPricePerTon: { amount: '480.00', currency: 'RUB' },
    });
    expect(ячейка(ТАРИФ_ИКША).textContent).toContain('480');
  });

  it('отказ службы оставляет в ячейке прежнее значение и называет причину', async () => {
    служба.answerWith('PUT /v1/landfills/:id/tariffs/:wasteGroupId', {
      status: 422,
      body: problem(
        'urn:imolt:problem:validation',
        'Цена утилизации не может быть отрицательной',
        422,
      ),
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await набрать(пользователь, ТАРИФ_ИКША, '999');
    await пользователь.keyboard('{Enter}');

    await screen.findByText('Цена утилизации не может быть отрицательной');

    expect(ячейка(ТАРИФ_ИКША).textContent).toContain('380');
    expect(ячейка(ТАРИФ_ИКША).textContent).not.toContain('999');
    // Дата актуальности отказом не двигается: цены остались прежними.
    expect(датаНаЭкране(EDIT_DATE)).toBeNull();
  });

  it('отмена по Escape возвращает ячейку к прежнему значению и не трогает службу', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await набрать(пользователь, ТАРИФ_ИКША, '777');
    await пользователь.keyboard('{Escape}');

    expect(ячейка(ТАРИФ_ИКША).textContent).toContain('380');
    expect(служба.sentTo('PUT /v1/landfills/:id/tariffs/:wasteGroupId')).toHaveLength(0);
  });

  it('участник без права ведения видит отказ службы, а справочник остаётся читаемым', async () => {
    служба.answerWith('PUT /v1/landfills/:id/tariffs/:wasteGroupId', {
      status: 403,
      body: ROLE_REQUIRED,
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await набрать(пользователь, ТАРИФ_ИКША, '480');
    await пользователь.keyboard('{Enter}');

    const отказ = await screen.findByRole('alert');
    expect(отказ).toHaveTextContent('Операция доступна менеджеру данных');
    expect(отказ).toHaveTextContent('обратитесь к нему за правом');

    // Таблица не опустела: значения справочника читаются и без права правки.
    expect(ячейка(ТАРИФ_ИКША)).toBeDisabled();
    expect(ячейка(ТАРИФ_ИКША).textContent).toContain('380');
    expect(ячейка(ТАРИФ_ВОСТОК).textContent).toContain('450');
  });

  it('отказ по сессии закрывает правку до первой попытки и объясняет почему', async () => {
    служба.answerWith('GET /v1/sync-runs/latest', {
      status: 401,
      body: AUTHENTICATION_REQUIRED,
    });

    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await waitFor(() => expect(ячейка(ТАРИФ_ИКША)).toBeDisabled());
    expect(await screen.findByRole('alert')).toHaveTextContent('Нужна сессия участника');
  });

  it('повтор проверки права после входа снова открывает правку', async () => {
    // Сессия появляется позже открытия экрана: согласие на обработку
    // персональных данных участник даёт уже на странице (R-054).
    let безСессии = true;
    служба.answerWith('GET /v1/sync-runs/latest', () =>
      безСессии
        ? { status: 401, body: AUTHENTICATION_REQUIRED }
        : { status: 200, body: SYNC_RUN },
    );

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await дождатьсяСправочника();
    await waitFor(() => expect(ячейка(ТАРИФ_ИКША)).toBeDisabled());

    безСессии = false;
    await пользователь.click(screen.getByRole('button', { name: 'Проверить право заново' }));

    await waitFor(() => expect(ячейка(ТАРИФ_ИКША)).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('статус полигона задаётся вручную с основанием и дата статуса становится датой правки', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await пользователь.click(screen.getByRole('button', { name: 'Задать статус вручную' }));
    await пользователь.click(screen.getByRole('radio', { name: 'Заблокирован' }));
    await пользователь.type(
      screen.getByRole('textbox', { name: 'Основание' }),
      'публикация Минэкологии области',
    );
    await пользователь.click(screen.getByRole('button', { name: 'Задать статус' }));

    await waitFor(() =>
      expect(служба.bodyOf('PUT /v1/landfills/:id/status')).toEqual({
        status: 'blocked',
        reason: 'публикация Минэкологии области',
      }),
    );

    const полигон = служба.landfills().find((item) => item.id === 'iksha');
    expect(полигон?.status).toBe('blocked');
    expect(полигон?.statusUpdatedAt).toBe(EDIT_DATE);
  });

  it('открытая вкладка групп отходов восстанавливается из адреса', async () => {
    window.history.replaceState(null, '', '#/references?tab=wasteGroups');

    render(<ReferencesPage />);

    const цена = await screen.findByRole('button', { name: new RegExp(`^${ЦЕНА_БЕТОН}:`) });
    expect(цена.textContent).toContain('12');
    expect(screen.queryByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) })).toBeNull();
  });

  it('смена вкладки кладётся в адрес', async () => {
    const пользователь = userEvent.setup();
    window.history.replaceState(null, '', '#/references?tab=landfills');
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await пользователь.click(screen.getByRole('tab', { name: 'Группы отходов' }));

    await waitFor(() => expect(window.location.hash).toContain('tab=wasteGroups'));
    await screen.findByRole('button', { name: new RegExp(`^${ЦЕНА_БЕТОН}:`) });
  });

  it('правка цены перевозки группы отходов двигает дату актуальности цен', async () => {
    const пользователь = userEvent.setup();
    window.history.replaceState(null, '', '#/references?tab=wasteGroups');
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: new RegExp(`^${ЦЕНА_БЕТОН}:`) });

    await набрать(пользователь, ЦЕНА_БЕТОН, '32');
    await пользователь.keyboard('{Enter}');

    await waitFor(() => expect(датаНаЭкране(EDIT_DATE)).not.toBeNull());

    // Непереданные поля правка не трогает: договор объявляет частичную правку.
    expect(служба.bodyOf('PATCH /v1/waste-groups/:id')).toEqual({
      transportPricePerTonKm: { amount: '32.00', currency: 'RUB' },
    });
  });
});

describe('редактор цен на телефоне', () => {
  it('правка тарифа идёт отдельным экраном и двигает дату актуальности цен', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);

    await пользователь.click(
      await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' }),
    );

    // Какая запись правится — видно в адресе: ссылка открывает ту же карточку.
    expect(window.location.hash).toContain('landfill=iksha');
    expect(await screen.findByRole('heading', { name: 'Площадка «Икша»' })).toBeInTheDocument();

    await набрать(пользователь, ТАРИФ_ИКША, '480');
    await пользователь.keyboard('{Enter}');

    await waitFor(() =>
      expect(
        служба
          .landfills()
          .find((item) => item.id === 'iksha')
          ?.tariffs.find((tariff) => tariff.wasteGroupId === 'beton-lom')?.disposalPricePerTon
          .amount,
      ).toBe('480.00'),
    );

    await пользователь.click(screen.getByRole('button', { name: 'Назад к списку полигонов' }));
    await waitFor(() => expect(датаНаЭкране(EDIT_DATE)).not.toBeNull());
  });

  it('список полигонов показан карточками, а не таблицей', async () => {
    render(<ReferencesPage />);

    const кнопка = await screen.findByRole('button', {
      name: 'Править полигон: Комплекс переработки «Восток»',
    });
    expect(screen.queryByRole('table')).toBeNull();

    const карточка = кнопка.closest('article');
    expect(карточка).not.toBeNull();
    expect(within(карточка as HTMLElement).getByText('ООО «Восток»')).toBeInTheDocument();
  });

  it('отказ по праву ведения на телефоне оставляет карточку читаемой', async () => {
    служба.answerWith('PUT /v1/landfills/:id/tariffs/:wasteGroupId', {
      status: 403,
      body: ROLE_REQUIRED,
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);

    await пользователь.click(
      await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' }),
    );
    await набрать(пользователь, ТАРИФ_ИКША, '480');
    await пользователь.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Операция доступна менеджеру данных');
    expect(ячейка(ТАРИФ_ИКША).textContent).toContain('380');
  });
});
