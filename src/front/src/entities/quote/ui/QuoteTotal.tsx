/**
 * Итог предложения: «К оплате».
 *
 * Одна сумма и одно её происхождение. Пока предложение не выпущено, это итог
 * по выбору или распределению, названный расчётной частью; после выпуска —
 * итог самого предложения, закреплённый снимком цен (R-037). Складывать
 * строки здесь нельзя: тогда предпросмотр мог бы разойтись с документом.
 *
 * Разбивки «перевозка / утилизация» из макета Э-07 здесь нет: расчётная часть
 * таких подытогов не присылает, а сложить их в браузере значило бы завести
 * второй источник цифры, которой нет в документе.
 *
 * @supports: R-037
 * @adr: ADR-0008
 */
import { formatMoney, type Money } from '@/shared/lib/formatting';

export function QuoteTotal({
  total,
  hint,
}: {
  /** Итог, названный службой; `null` — считать ещё нечего. */
  total: Money | null;
  /** Откуда взят итог: пользователь должен понимать, что перед ним. */
  hint: string;
}) {
  return (
    <div className="imolt-quote-sum">
      <div className="imolt-quote-sum-line">
        <span className="imolt-quote-sum-label">К оплате</span>
        <span className="imolt-quote-sum-value">
          {total === null ? 'нет суммы' : formatMoney(total)}
        </span>
      </div>
      <p className="imolt-quote-sum-hint">{hint}</p>
    </div>
  );
}
