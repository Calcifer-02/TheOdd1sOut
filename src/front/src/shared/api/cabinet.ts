/**
 * Обращения кабинета: профиль, подписка, сохранённые расчёты и услуги.
 *
 * Область обращений отделена от расчётной (`imolt.ts`) намеренно: экраны
 * пишутся раздельно, и единый файл обращений стал бы местом, где правки
 * сталкиваются. Общая часть обмена — адрес, маркер и отказ — берётся из
 * `http.ts` и здесь не повторяется.
 *
 * Формы списаны со схем `src/back/Imolt.Api/contracts/openapi.yaml` и сверены
 * с ответами службы: интерфейс не заводит своей модели доступа (ADR-0008,
 * инвариант 2).
 *
 * @supports: R-049, R-050, R-051, R-052, R-054
 * @adr: ADR-0008
 */
import { request } from '@/shared/api/http';
import type { Page, Profile, SubscriptionStanding } from '@/shared/api/contracts';
import type { Money } from '@/shared/lib/formatting';

/** Роль подписчика: перевозчик либо демонтажная компания. */
export type SubscriberRole = NonNullable<Profile['role']>;

/**
 * Состояние подписки и профиль участника берутся из общего зеркала договора:
 * второе объявление той же формы разошлось бы с первым молча. Имена
 * переэкспортируются, потому что кабинет — их главный потребитель.
 */
export type { SubscriptionStanding };

/** Профиль участника в форме, которую присылает служба. */
export type ParticipantProfile = Profile;

/**
 * Строка кабинета: расчёт, каким его видит владелец. Итог — сумма выбранных
 * полигонов; у расчёта без выбора он равен нулю (схема `CalculationSummary`).
 */
export type CalculationSummary = {
  id: string;
  createdAt: string;
  pickupAddress: string;
  total: Money;
  quoteNumber?: string | null;
};

/**
 * Услуга каталога по документации. Цена названа «от» либо не названа вовсе —
 * тогда `priceOnRequest` истинно. Оба состояния сразу договор запрещает.
 */
export type DocumentService = {
  id: string;
  name: string;
  priceFrom?: Money | null;
  priceOnRequest: boolean;
};

/**
 * Заявка на подписку. Согласия на обработку персональных данных договор здесь
 * не принимает (`additionalProperties: false`): сессия уже создана с явным
 * согласием, а перед отправкой заявки оно подтверждается на экране (R-054).
 */
export type SubscriptionRequestInput = {
  role: SubscriberRole;
  companyName: string;
  inn: string;
  registeredInAisOssig?: boolean;
};

export type SubscriptionRequestAccepted = {
  id: string;
  createdAt: string;
  subscription: SubscriptionStanding;
  message?: string;
};

export type DocumentServiceOrderInput = {
  serviceId: string;
  objectAddress: string;
  comment?: string;
  personalDataConsent: boolean;
};

export type DocumentServiceOrderAccepted = {
  id: string;
  serviceId: string;
  createdAt: string;
  state: 'accepted';
  message?: string;
};

/** Профиль участника и состояние его подписки (R-049, R-051). */
export function getProfile(): Promise<ParticipantProfile> {
  return request<ParticipantProfile>('/v1/profile');
}

/**
 * Заявка на подписку (R-008, R-049, R-051). Оплата идёт вне сервиса, поэтому
 * нормальный исход операции — состояние «ожидает подтверждения», а не отказ.
 */
export function requestSubscription(
  input: SubscriptionRequestInput,
): Promise<SubscriptionRequestAccepted> {
  return request<SubscriptionRequestAccepted>('/v1/subscription-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Сохранённые расчёты участника, постранично (R-008, R-049). */
export function listCalculations(limit: number, offset: number): Promise<Page<CalculationSummary>> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  return request<Page<CalculationSummary>>(`/v1/calculations?${query.toString()}`);
}

/**
 * Каталог услуг по документации (R-052). Состав каталога — данные службы, а
 * не перечень в коде: заказчик его не подтверждал.
 */
export function listDocumentServices(): Promise<Page<DocumentService>> {
  return request<Page<DocumentService>>('/v1/document-services');
}

/** Заказ услуги по документации (R-009, R-052, R-054). */
export function orderDocumentService(
  input: DocumentServiceOrderInput,
): Promise<DocumentServiceOrderAccepted> {
  return request<DocumentServiceOrderAccepted>('/v1/document-service-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
