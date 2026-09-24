/**
 * Черновик заявки на подписку: что участник набрал и чего не хватает.
 *
 * Предметная логика заявки живёт здесь и общая для обоих представлений:
 * мобильное и десктопное различаются разметкой, а не правилами. Копия правил
 * в двух файлах разошлась бы, и одна из копий перестала бы спрашивать
 * согласие.
 *
 * Согласие на обработку персональных данных держится в черновике, но в теле
 * запроса не уходит: схема `SubscriptionRequestInput` договора его не
 * принимает (`additionalProperties: false`). Оно — условие отправки на
 * стороне экрана (R-054).
 *
 * @supports: R-049, R-051, R-054
 * @adr: ADR-0006
 */
import type { SubscriberRole, SubscriptionRequestInput } from '@/shared/api/cabinet';

export type SubscriptionDraft = {
  role: SubscriberRole;
  companyName: string;
  inn: string;
  registeredInAisOssig: boolean;
  personalDataConsent: boolean;
};

/**
 * Пустой черновик. Роль предзаполнена перевозчиком: подписка заведена для
 * него (R-049), а демонтажная компания выбирается явно.
 */
export const EMPTY_SUBSCRIPTION_DRAFT: SubscriptionDraft = {
  role: 'carrier',
  companyName: '',
  inn: '',
  registeredInAisOssig: false,
  personalDataConsent: false,
};

export type SubscriptionDraftErrors = { companyName?: string; inn?: string };

/**
 * Образец ИНН — дословно из схемы `SubscriptionRequestInput` договора: десять
 * либо двенадцать цифр. Проверка здесь предварительная и решения службы не
 * заменяет: последнее слово за ней.
 */
const INN_PATTERN = /^[0-9]{10}$|^[0-9]{12}$/;

/** Чего не хватает черновику. Пустой разбор означает «можно отправлять». */
export function subscriptionDraftErrors(draft: SubscriptionDraft): SubscriptionDraftErrors {
  const errors: SubscriptionDraftErrors = {};

  if (draft.companyName.trim().length === 0) {
    errors.companyName = 'Назовите компанию';
  }

  if (!INN_PATTERN.test(draft.inn.trim())) {
    errors.inn = 'ИНН записывается десятью либо двенадцатью цифрами';
  }

  return errors;
}

/**
 * Можно ли отправить заявку. Согласие — отдельное условие, а не одна из
 * ошибок поля: его отсутствие не ошибка ввода, а несостоявшееся решение
 * участника (R-054).
 */
export function readyToSend(draft: SubscriptionDraft): boolean {
  return draft.personalDataConsent && Object.keys(subscriptionDraftErrors(draft)).length === 0;
}

/** Тело заявки по договору: из черновика уходит только объявленное схемой. */
export function subscriptionRequestOf(draft: SubscriptionDraft): SubscriptionRequestInput {
  return {
    role: draft.role,
    companyName: draft.companyName.trim(),
    inn: draft.inn.trim(),
    registeredInAisOssig: draft.registeredInAisOssig,
  };
}
