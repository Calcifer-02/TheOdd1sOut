/**
 * Согласие и обмен стартовых параметров на сессию — один раз на всё
 * приложение (R-054, R-071).
 *
 * Опознание спрашивается в двух местах: карточкой поверх расчёта и в
 * кабинете, который без сессии ничего показать не может. Порядок при этом
 * один — согласие, обмен, отказ заголовком, — и держать его двумя копиями
 * нельзя: копии расходятся, и одна из них рано или поздно перестанет
 * спрашивать согласие.
 *
 * Согласие спрашивается до обмена, а не подставляется истиной: сессия заводит
 * учётную запись, а учётная запись — персональные данные (R-054).
 *
 * @req: R-054
 * @adr: ADR-0009
 */
import { useId, useState } from 'react';
import type { Session } from '@/shared/api/contracts';
import { ApiProblem } from '@/shared/api/http';
import { Button, Checkbox, Notice } from '@/shared/ui';
import { signIn } from '@/entities/participant';

export function SignInPrompt({
  actionLabel,
  onSignedIn,
}: {
  /** Кнопка названа наблюдаемым результатом, а не операцией (PRACT-038). */
  actionLabel: string;
  onSignedIn: (session: Session) => void;
}) {
  const consentId = useId();
  const [consent, setConsent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const connect = async () => {
    setFailure(null);
    setSending(true);

    try {
      onSignedIn(await signIn(consent));
    } catch (error) {
      // Показывается заголовок отказа, а не код причины: код — внутреннее имя
      // (ADR-0008, инвариант 4).
      setFailure(error instanceof ApiProblem ? error.title : 'Опознать участника не удалось');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Checkbox
        id={consentId}
        label="Согласен на обработку персональных данных"
        checked={consent}
        onChange={setConsent}
      />
      <Button onClick={connect} disabled={!consent || sending}>
        {actionLabel}
      </Button>
      {failure !== null && <Notice kind="error">{failure}</Notice>}
    </>
  );
}
