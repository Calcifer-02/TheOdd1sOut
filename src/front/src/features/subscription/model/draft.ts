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
  phone: string;
  registeredInAisOssig: boolean;
  hasTransportLicense: boolean;
  hasSanitaryConclusion: boolean;
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
  phone: '',
  registeredInAisOssig: false,
  hasTransportLicense: false,
  hasSanitaryConclusion: false,
  personalDataConsent: false,
};

export type SubscriptionDraftErrors = { companyName?: string; inn?: string; phone?: string };

/**
 * Образец ИНН — дословно из схемы `SubscriptionRequestInput` договора: десять
 * либо двенадцать цифр. Проверка здесь предварительная и решения службы не
 * заменяет: последнее слово за ней.
 */
const INN_PATTERN = /^[0-9]{10}$|^[0-9]{12}$/;

/**
 * Канонический вид телефона — дословно из той же схемы: «+7» и десять цифр.
 * Договор принимает только его, поэтому набранное приводится к нему здесь, а
 * не отвергается: человек пишет номер скобками и чёрточками каждый день.
 */
const PHONE_PATTERN = /^\+7[0-9]{10}$/;

/**
 * Набранный номер в каноническом виде. Одиннадцать цифр с «7» или «8» впереди
 * и десять цифр без кода страны — три записи одного и того же номера; всё
 * прочее возвращается как есть и не проходит проверку.
 */
export function canonicalPhone(typed: string): string {
  const digits = typed.replace(/[^0-9]/g, '');

  if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
    return `+7${digits.slice(1)}`;
  }

  return digits.length === 10 ? `+7${digits}` : typed.trim();
}

/** Чего не хватает черновику. Пустой разбор означает «можно отправлять». */
export function subscriptionDraftErrors(draft: SubscriptionDraft): SubscriptionDraftErrors {
  const errors: SubscriptionDraftErrors = {};

  if (draft.companyName.trim().length === 0) {
    errors.companyName = 'Назовите компанию';
  }

  if (!INN_PATTERN.test(draft.inn.trim())) {
    errors.inn = 'ИНН записывается десятью либо двенадцатью цифрами';
  }

  // Пустой телефон ошибкой не считается: договор его не требует, а обратный
  // канал у менеджера есть и в мессенджере (R-051).
  if (draft.phone.trim().length > 0 && !PHONE_PATTERN.test(canonicalPhone(draft.phone))) {
    errors.phone = 'Телефон записывается как +7 и десять цифр';
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
  const phone = canonicalPhone(draft.phone);

  return {
    role: draft.role,
    companyName: draft.companyName.trim(),
    inn: draft.inn.trim(),
    // Ненабранный телефон в теле не уходит вовсе: пустая строка образцу
    // договора не отвечает, и заявка была бы отвергнута из-за поля, которого
    // никто не заполнял.
    ...(phone.length > 0 ? { phone } : {}),
    registeredInAisOssig: draft.registeredInAisOssig,
    hasTransportLicense: draft.hasTransportLicense,
    hasSanitaryConclusion: draft.hasSanitaryConclusion,
  };
}
