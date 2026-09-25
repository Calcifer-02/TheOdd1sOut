/**
 * Импорт справочника из книги в редакторе цен (Э-11, R-045).
 *
 * Шага два, и первый ничего не меняет: пока предпросмотр не подтверждён,
 * справочник остаётся прежним. Устаревший предпросмотр применять нельзя —
 * служба отвечает отказом 409, и интерфейс обязан объяснить это словами и
 * предложить пересобрать предпросмотр, а не повторять запрос молча.
 *
 * Разбор книги делает расчётная часть: интерфейс отправляет файл составным
 * телом и показывает то, что вернула служба.
 *
 * Критерия приёмки на интерфейс импорта в пакете аналитики нет: AC-045a,
 * AC-045c и AC-045d описывают поведение расчётной части. Якорь файла —
 * `@supports`, разрыв назван в отчёте.
 *
 * Проверки фальсифицируемы: примените расхождения на первом шаге, повторите
 * подтверждение после отказа 409, уберите объяснение устаревшего
 * предпросмотра, не перечитайте справочник после применения — они упадут.
 *
 *   npx vitest run tests/ReferencesImport.test.tsx
 *
 * @supports: R-045, R-042
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReferencesPage } from '@/pages/references';
import { ReferencesSection } from '@/pages/showcase/sections/references';
import { type MaintenanceStub, STALE_PREVIEW, installMaintenanceStub } from './stubs/maintenance';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';

type Пользователь = ReturnType<typeof userEvent.setup>;

const ТАРИФ_ИКША = 'Тариф утилизации, Площадка «Икша», Лом бетона и железобетона';

const ИМЯ_КНИГИ = 'tarify-polygony.xlsx';

const ТИП_КНИГИ = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let служба: MaintenanceStub;

beforeEach(() => {
  служба = installMaintenanceStub();
});

afterEach(() => {
  служба.restore();
});

function книга(): File {
  return new File(['книга'], ИМЯ_КНИГИ, { type: ТИП_КНИГИ });
}

function тарифИкши(): string | undefined {
  return служба
    .landfills()
    .find(item => item.id === 'iksha')
    ?.tariffs.find(tariff => tariff.wasteGroupId === 'beton-lom')?.disposalPricePerTon.amount;
}

/** Открыть импорт и отдать книгу на разбор. */
async function разобрать(пользователь: Пользователь, подпись: string): Promise<void> {
  await пользователь.click(screen.getByRole('button', { name: 'Импорт из Excel' }));
  await пользователь.upload(screen.getByLabelText(подпись), книга());
  await screen.findByText(/Расхождений: 1/);
}

describe('импорт справочника на рабочем месте', () => {
  beforeEach(() => {
    setViewportWidth(DESKTOP_WIDTH);
  });

  it('первый шаг показывает расхождения и справочник не меняет', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    await разобрать(пользователь, 'Книга Excel');

    // Книга уходит составным телом: разбор делает расчётная часть.
    expect(служба.bodyOf('POST /v1/reference-imports')).toEqual({
      kind: 'tariffs',
      fileName: ИМЯ_КНИГИ,
    });

    expect(screen.getByText('Тариф утилизации')).toBeInTheDocument();
    expect(screen.getByText('380.00')).toBeInTheDocument();
    expect(screen.getByText('480.00')).toBeInTheDocument();

    // До подтверждения справочник остаётся прежним.
    expect(служба.sentTo('POST /v1/reference-imports/:id/confirmation')).toHaveLength(0);
    expect(тарифИкши()).toBe('380.00');
    expect(screen.getByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) }).textContent).toContain('380');
  });

  it('подтверждение применяет расхождения и справочник показывает значения из файла', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    await разобрать(пользователь, 'Книга Excel');
    await пользователь.click(screen.getByRole('button', { name: 'Применить изменения: 1' }));

    await screen.findByText(/Применено изменений: 1/);
    expect(тарифИкши()).toBe('480.00');

    // Экран обязан показать применённое, а не прежнее.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) }).textContent).toContain('480'),
    );
  });

  /** @supports: R-046 */
  it('книга, заводящая записи, называет их до применения и после', async () => {
    // Служба вернула предпросмотр с заводимой записью: у неё нет текущих
    // значений, и по одним расхождениям менеджер данных не отличил бы
    // заведение полигона от правки его адреса (R-046).
    служба.answerWith('POST /v1/reference-imports', {
      status: 201,
      body: {
        id: '7d1f0a6e-0f2a-4f7a-9a1e-2b6c1d4e5f60',
        kind: 'landfills',
        changes: [
          {
            entityId: 'novyy-poligon',
            field: 'name',
            currentValue: null,
            fileValue: 'Объект из официального перечня',
          },
        ],
        rejectedRows: [],
        additions: ['novyy-poligon'],
      },
    });

    служба.answerWith('POST /v1/reference-imports/:id/confirmation', {
      status: 200,
      body: {
        id: '7d1f0a6e-0f2a-4f7a-9a1e-2b6c1d4e5f60',
        appliedChanges: 1,
        addedEntities: 1,
        updatedAt: '2026-09-25T09:20:03+03:00',
      },
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    await пользователь.click(screen.getByRole('button', { name: 'Импорт из Excel' }));
    await пользователь.upload(screen.getByLabelText('Книга Excel'), книга());

    expect(await screen.findByText(/Будет заведено записей: 1/)).toBeInTheDocument();

    await пользователь.click(screen.getByRole('button', { name: /^Применить изменения/ }));

    expect(await screen.findByText(/Заведено записей: 1/)).toBeInTheDocument();
  });

  it('устаревший предпросмотр не применяется, объясняет причину и предлагает пересобрать', async () => {
    служба.answerWith('POST /v1/reference-imports/:id/confirmation', {
      status: 409,
      body: STALE_PREVIEW,
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    await разобрать(пользователь, 'Книга Excel');
    await пользователь.click(screen.getByRole('button', { name: 'Применить изменения: 1' }));

    const отказ = await screen.findByRole('alert');
    expect(отказ).toHaveTextContent('Предпросмотр устарел');
    expect(отказ).toHaveTextContent('разберите его заново');

    // Повторять отказанное подтверждение бессмысленно: кнопка закрыта.
    expect(screen.getByRole('button', { name: 'Применить изменения: 1' })).toBeDisabled();
    expect(служба.sentTo('POST /v1/reference-imports/:id/confirmation')).toHaveLength(1);
    expect(тарифИкши()).toBe('380.00');

    await пользователь.click(screen.getByRole('button', { name: 'Собрать предпросмотр заново' }));

    await waitFor(() => expect(служба.sentTo('POST /v1/reference-imports')).toHaveLength(2));
  });

  it('отказ по праву ведения на загрузке книги называется заголовком службы', async () => {
    служба.answerWith('POST /v1/reference-imports', {
      status: 403,
      body: {
        type: 'urn:imolt:problem:role-required',
        title: 'Операция доступна менеджеру данных',
        status: 403,
        detail: 'Ведение справочников закреплено за владельцем данных: обратитесь к нему за правом',
      },
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });

    await пользователь.click(screen.getByRole('button', { name: 'Импорт из Excel' }));
    await пользователь.upload(screen.getByLabelText('Книга Excel'), книга());

    expect(await screen.findByRole('alert')).toHaveTextContent('Операция доступна менеджеру данных');
    expect(служба.sentTo('POST /v1/reference-imports/:id/confirmation')).toHaveLength(0);
  });
});

describe('раздел витрины редактора цен', () => {
  it('показывает импорт во всех объявленных состояниях (R-084)', () => {
    render(<ReferencesSection />);

    // Шесть образцов: выбор книги, расхождения, устаревший предпросмотр,
    // применение, отказ по праву и пошаговый вид телефона.
    expect(screen.getAllByRole('heading', { name: 'Импорт справочника из книги' })).toHaveLength(6);

    expect(screen.getByRole('button', { name: 'Собрать предпросмотр заново' })).toBeInTheDocument();
    expect(screen.getByText(/Применено изменений: 2/)).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getAllByRole('table')).toHaveLength(2);
  });
});

describe('импорт справочника на телефоне', () => {
  it('идёт по шагам и второй шаг применяет расхождения', async () => {
    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    await пользователь.click(screen.getByRole('button', { name: 'Импорт из Excel' }));
    expect(screen.getByText('Шаг 1 из 2')).toBeInTheDocument();

    await пользователь.upload(screen.getByLabelText('Книга Excel'), книга());

    expect(await screen.findByText('Шаг 2 из 2')).toBeInTheDocument();
    expect(screen.getByText('380.00')).toBeInTheDocument();
    expect(тарифИкши()).toBe('380.00');

    await пользователь.click(screen.getByRole('button', { name: 'Применить изменения: 1' }));

    await screen.findByText(/Применено изменений: 1/);
    expect(тарифИкши()).toBe('480.00');
  });

  it('устаревший предпросмотр на телефоне объясняется и не применяется повторно', async () => {
    служба.answerWith('POST /v1/reference-imports/:id/confirmation', {
      status: 409,
      body: STALE_PREVIEW,
    });

    const пользователь = userEvent.setup();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    await пользователь.click(screen.getByRole('button', { name: 'Импорт из Excel' }));
    await пользователь.upload(screen.getByLabelText('Книга Excel'), книга());
    await screen.findByText('Шаг 2 из 2');
    await пользователь.click(screen.getByRole('button', { name: 'Применить изменения: 1' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Предпросмотр устарел');
    expect(screen.getByRole('button', { name: 'Применить изменения: 1' })).toBeDisabled();
    expect(служба.sentTo('POST /v1/reference-imports/:id/confirmation')).toHaveLength(1);
  });
});
