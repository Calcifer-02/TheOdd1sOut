/**
 * Заявка на подписку: роль, реквизиты компании и согласие (экран Э-09).
 *
 * Оплаты на экране нет и быть не должно: дизайн-договор запрещает рисовать
 * оплату и корзину, а договор API объявляет заявку намерением — деньги
 * проходят вне сервиса. Поэтому кнопка называется заявкой, а не покупкой.
 *
 * Цена тарифа и перечень привилегий здесь не названы числами: состав
 * закрытого подпиской заказчиком не установлен, и подставлять его за
 * заказчика нельзя.
 *
 * @req: R-051
 * @supports: R-049, R-054
 * @adr: ADR-0006
 */
import { useId, useState } from 'react';
import { ApiProblem } from '@/shared/api/http';
import { requestSubscription, type SubscriptionStanding } from '@/shared/api/cabinet';
import { Button, Checkbox, Field, Notice, RadioPills, useStyles } from '@/shared/ui';
import { colors, fonts, radius, space } from '@/shared/ui/tokens';
import { SUBSCRIBER_ROLES } from '@/entities/participant';
import {
  EMPTY_SUBSCRIPTION_DRAFT,
  readyToSend,
  subscriptionDraftErrors,
  subscriptionRequestOf,
  type SubscriptionDraft,
} from '../model/draft';

const SUBSCRIPTION_FORM_CSS = `
.imolt-subscription-form { display: grid; gap: ${space.m}px; }
.imolt-subscription-roles { display: grid; gap: ${space.xs}px; }
.imolt-subscription-terms {
  padding: ${space.s}px ${space.m}px;
  border-radius: ${radius.field}px;
  background: ${colors.bgSurfaceMuted};
  font-family: ${fonts.ui};
  font-size: 12px;
  line-height: 17px;
  color: ${colors.textSecondary};
}
`;

export function SubscriptionRequestForm({
  onAccepted,
}: {
  onAccepted: (subscription: SubscriptionStanding, message?: string) => void;
}) {
  useStyles('subscription-form', SUBSCRIPTION_FORM_CSS);

  const fieldId = useId();
  const [draft, setDraft] = useState<SubscriptionDraft>(EMPTY_SUBSCRIPTION_DRAFT);
  const [touched, setTouched] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const errors = subscriptionDraftErrors(draft);
  const shown = touched ? errors : {};
  const change = (patch: Partial<SubscriptionDraft>) => setDraft({ ...draft, ...patch });

  const send = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setTouched(true);

    // Согласие — условие отправки, а не поле формы: без него заявка не
    // уходит вовсе, и отказ службы здесь ни при чём (R-054).
    if (!readyToSend(draft)) {
      return;
    }

    setFailure(null);
    setSending(true);

    try {
      const accepted = await requestSubscription(subscriptionRequestOf(draft));
      onAccepted(accepted.subscription, accepted.message);
    } catch (error) {
      setFailure(error instanceof ApiProblem ? error.title : 'Заявку отправить не удалось');
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="imolt-subscription-form" onSubmit={send} noValidate>
      <RadioPills
        className="imolt-subscription-roles"
        name={`${fieldId}-role`}
        label="Кто вы"
        value={draft.role}
        options={SUBSCRIBER_ROLES}
        onPick={role => change({ role })}
      />

      <Field
        id={`${fieldId}-company`}
        label="Название компании"
        value={draft.companyName}
        placeholder="ООО «Перевозчик»"
        error={shown.companyName}
        onChange={companyName => change({ companyName })}
      />

      <Field
        id={`${fieldId}-inn`}
        label="ИНН"
        value={draft.inn}
        inputMode="tel"
        placeholder="7701234567"
        hint="Десять цифр у организации, двенадцать у предпринимателя"
        error={shown.inn}
        onChange={inn => change({ inn })}
      />

      <Field
        id={`${fieldId}-phone`}
        label="Телефон"
        value={draft.phone}
        inputMode="tel"
        placeholder="+7 916 123-45-67"
        hint="Необязательно: менеджер напишет и в мессенджере"
        error={shown.phone}
        onChange={phone => change({ phone })}
      />

      <Checkbox
        id={`${fieldId}-ais`}
        label="Транспорт зарегистрирован в АИС ОССиГ"
        checked={draft.registeredInAisOssig}
        onChange={registeredInAisOssig => change({ registeredInAisOssig })}
      />

      <Checkbox
        id={`${fieldId}-license`}
        label="Есть лицензия на транспортирование отходов I–IV классов опасности"
        checked={draft.hasTransportLicense}
        onChange={hasTransportLicense => change({ hasTransportLicense })}
      />

      <Checkbox
        id={`${fieldId}-sez`}
        label="Есть санитарно-эпидемиологическое заключение"
        checked={draft.hasSanitaryConclusion}
        onChange={hasSanitaryConclusion => change({ hasSanitaryConclusion })}
      />

      <p className="imolt-subscription-terms">
        Оплата проходит вне сервиса: менеджер свяжется, назовёт условия и откроет доступ. Стоимость и состав подписки
        заказчиком пока не названы, поэтому сервис их не показывает.
      </p>

      <Checkbox
        id={`${fieldId}-consent`}
        label="Согласен на обработку персональных данных"
        checked={draft.personalDataConsent}
        onChange={personalDataConsent => change({ personalDataConsent })}
      />

      <Button type="submit" disabled={sending}>
        Оставить заявку на подписку
      </Button>

      {touched && !draft.personalDataConsent && (
        <Notice kind="error">Без согласия на обработку персональных данных заявка не отправляется</Notice>
      )}

      {failure !== null && <Notice kind="error">{failure}</Notice>}
    </form>
  );
}
