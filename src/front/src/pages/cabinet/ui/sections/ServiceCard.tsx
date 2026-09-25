/**
 * Карточка услуги по документации и заказ прямо в ней (экран Э-10).
 *
 * Цена названа «от» либо не названа вовсе — тогда услуга считается по
 * запросу. Оба состояния сразу договор запрещает, и карточка их не смешивает:
 * иначе она перестаёт что-либо сообщать (R-052).
 *
 * Заказ требует явного согласия на обработку персональных данных: без него
 * заявка не уходит, и подставлять согласие за участника нельзя (R-054).
 *
 * @req: R-052
 * @supports: R-054
 * @adr: ADR-0008
 */
import { useId, useState } from 'react';
import { Button, Checkbox, Field, Notice } from '@/shared/ui';
import { formatMoney } from '@/shared/lib/formatting';
import type { DocumentService } from '@/shared/api/cabinet';
import type { ServiceOrderState } from '../../model/cabinet';

/** Цена услуги словом: «от …» либо «по запросу» — третьего договор не даёт. */
function priceWord(service: DocumentService): string {
  if (service.priceOnRequest || !service.priceFrom) {
    return 'по запросу';
  }

  return `от ${formatMoney(service.priceFrom)}`;
}

export function ServiceCard({ service, order }: { service: DocumentService; order: ServiceOrderState }) {
  const fieldId = useId();
  const [objectAddress, setObjectAddress] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);

  const open = order.openFor === service.id;
  const accepted = order.acceptedFor === service.id;
  const addressMissing = objectAddress.trim().length === 0;

  const send = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setTouched(true);

    // Адрес объекта и согласие — условия договора и требования R-054: без
    // них заказ не уходит вовсе, а не отвергается службой.
    if (addressMissing || !consent) {
      return;
    }

    await order.send({
      serviceId: service.id,
      objectAddress: objectAddress.trim(),
      comment: comment.trim() === '' ? undefined : comment.trim(),
      personalDataConsent: consent,
    });
  };

  return (
    <article className="imolt-service" aria-labelledby={`${fieldId}-name`}>
      <div className="imolt-service-grow">
        <h3 className="imolt-service-name" id={`${fieldId}-name`}>
          {service.name}
        </h3>
      </div>

      <div>
        <div className="imolt-service-price-label">Стоимость</div>
        <div className="imolt-service-price">{priceWord(service)}</div>
      </div>

      {accepted && <Notice kind="done">{order.acceptedMessage ?? 'Заказ принят'}</Notice>}

      {open ? (
        <form className="imolt-service-order" onSubmit={send} noValidate>
          <Field
            id={`${fieldId}-address`}
            label="Адрес объекта"
            value={objectAddress}
            placeholder="г Москва, ул Годовикова, д 9"
            error={touched && addressMissing ? 'Назовите адрес объекта' : undefined}
            onChange={setObjectAddress}
          />

          <div>
            <label className="imolt-label" htmlFor={`${fieldId}-comment`}>
              Комментарий
            </label>
            <textarea
              id={`${fieldId}-comment`}
              className="imolt-textarea"
              value={comment}
              placeholder="Сроки, площадь, особенности объекта"
              onChange={event => setComment(event.target.value)}
            />
          </div>

          <Checkbox
            id={`${fieldId}-consent`}
            label="Согласен на обработку персональных данных"
            checked={consent}
            onChange={setConsent}
          />

          {touched && !consent && (
            <Notice kind="error">Без согласия на обработку персональных данных заказ не отправляется</Notice>
          )}

          {order.failure !== null && <Notice kind="error">{order.failure}</Notice>}

          <div className="imolt-service-order-actions">
            <Button type="submit" disabled={order.sending} ariaLabel={`Отправить заказ: ${service.name}`}>
              Отправить
            </Button>
            <Button kind="secondary" onClick={() => order.open(null)} ariaLabel={`Отменить заказ: ${service.name}`}>
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <Button kind="secondary" onClick={() => order.open(service.id)} ariaLabel={`Заказать: ${service.name}`}>
          Заказать
        </Button>
      )}
    </article>
  );
}
