/**
 * Объяснение закрытой правки справочника (BUG-012).
 *
 * Заказчик прочитал прежний текст как противоречие: экран советовал открыть
 * мини-приложение в MAX, будучи уже открытым, и тут же сообщал, что
 * справочник открыт для чтения, а правка закрыта. Устройство доступа при этом
 * такое: своего входа у сервиса нет, личность даёт платформа MAX (ADR-0006),
 * мини-приложение работает и в браузере, и внутри MAX, чтение никакой
 * личности не требует, а правка требует и личности, и права ведения
 * справочников.
 *
 * Проверка требует от экрана называть причину, а не действие, и запрещает
 * обещать вход, которого у сервиса нет и не будет: ни по телефону, ни по
 * коду, ни по паролю.
 *
 * Проверки фальсифицируемы: уберите из объяснения причину закрытой правки,
 * верните совет открыть мини-приложение в MAX или допишите обещание входа —
 * упадёт именно та проверка, которая об этом говорит.
 *
 *   npx vitest run tests/ReferencesAccess.test.tsx
 *
 * Критерия приёмки на текст разграничения в реестре нет: AC-050a и AC-050b
 * описывают доступ к деталям маршрута. Поэтому ссылка на требование.
 *
 * @supports: R-050
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReferencesPage } from '@/pages/references';
import { DESKTOP_WIDTH, setViewportWidth } from './viewport';
import {
  AUTHENTICATION_REQUIRED,
  ROLE_REQUIRED,
  installMaintenanceStub,
  type MaintenanceStub,
} from './stubs/maintenance';

const ТАРИФ_ИКША = 'Тариф утилизации, Площадка «Икша», Лом бетона и железобетона';

/**
 * Обещания входа, которого у сервиса нет. Личность даёт платформа MAX, своей
 * регистрации, пароля и кода подтверждения сервис не заводит (ADR-0006).
 */
const ОБЕЩАНИЯ_ВХОДА =
  /войдите|введите|зарегистрируйтесь|регистрация|отправим|пришлём|получите код|подтвердите номер|по паролю/i;

let служба: MaintenanceStub;

beforeEach(() => {
  служба = installMaintenanceStub();
});

afterEach(() => {
  служба.restore();
});

/** Экран без опознанного участника: службе нечем подтвердить личность. */
function безСессии(): void {
  служба.answerWith('GET /v1/sync-runs/latest', {
    status: 401,
    body: AUTHENTICATION_REQUIRED,
  });
}

async function дождатьсяСправочника(): Promise<void> {
  await screen.findByRole('button', { name: new RegExp(`^${ТАРИФ_ИКША}:`) });
}

describe('закрытая правка справочника без опознанного участника', () => {
  it('на рабочем месте называет причину: личность даёт платформа MAX, чтение её не требует', async () => {
    безСессии();
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    const объяснение = (await screen.findByRole('alert')).textContent ?? '';

    // Что даёт доступ, почему правка закрыта и почему чтение открыто.
    expect(объяснение).toMatch(/платформ[ае] MAX/);
    expect(объяснение).toMatch(/право[м]? ведения справочников/);
    expect(объяснение).toMatch(/не знает, кто пришёл/);
    expect(объяснение).toMatch(/чтение не требует/);

    // Совет открыть мини-приложение в MAX и был прочитан как противоречие:
    // мини-приложение уже открыто, просто вне MAX.
    expect(объяснение).not.toMatch(/откройте мини-приложение/i);
    expect(объяснение).not.toMatch(ОБЕЩАНИЯ_ВХОДА);
  });

  it('на телефоне даёт то же объяснение, а не своё', async () => {
    безСессии();
    render(<ReferencesPage />);
    await screen.findByRole('button', { name: 'Править полигон: Площадка «Икша»' });

    const объяснение = (await screen.findByRole('alert')).textContent ?? '';

    expect(объяснение).toMatch(/платформ[ае] MAX/);
    expect(объяснение).toMatch(/право[м]? ведения справочников/);
    expect(объяснение).toMatch(/не знает, кто пришёл/);
    expect(объяснение).toMatch(/чтение не требует/);
    expect(объяснение).not.toMatch(ОБЕЩАНИЯ_ВХОДА);
  });

  it('нигде на экране не советует открыть мини-приложение, которое уже открыто', async () => {
    безСессии();
    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    await screen.findByRole('alert');

    // Отказ по сессии приходит и в панель обновления справочников: совет
    // службы повторялся там вторым абзацем (BUG-012).
    expect(document.body.textContent ?? '').not.toMatch(/откройте мини-приложение/i);
  });
});

describe('закрытая правка справочника без права ведения', () => {
  it('оставляет слова службы и объясняет, что чтение от права не зависит', async () => {
    служба.answerWith('PUT /v1/landfills/:id/tariffs/:wasteGroupId', {
      status: 403,
      body: ROLE_REQUIRED,
    });
    служба.answerWith('GET /v1/sync-runs/latest', { status: 403, body: ROLE_REQUIRED });

    setViewportWidth(DESKTOP_WIDTH);
    render(<ReferencesPage />);
    await дождатьсяСправочника();

    const объяснение = (await screen.findByRole('alert')).textContent ?? '';

    // Причину этого отказа служба называет сама, и её слова остаются.
    expect(объяснение).toMatch(/Операция доступна менеджеру данных/);
    expect(объяснение).toMatch(/обратитесь к нему за правом/);
    expect(объяснение).toMatch(/чтение не требует/);
    expect(объяснение).not.toMatch(ОБЕЩАНИЯ_ВХОДА);
  });
});
