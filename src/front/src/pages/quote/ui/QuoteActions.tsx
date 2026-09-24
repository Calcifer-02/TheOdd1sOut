/**
 * Действия с предложением. Разметка у представлений разная — боковая колонка
 * на рабочем месте и нижняя панель на телефоне, — а набор действий и их
 * названия одни: они объявлены моделью (`../model/view`).
 *
 * Скачивание — ссылка, а не кнопка: файл отдаёт расчётная часть по адресу из
 * ответа о предложении, и переход по адресу обязан работать так же, как любая
 * ссылка, — средней кнопкой, из меню, с клавиатуры. Заодно повторное
 * скачивание не обращается к выпуску предложения вовсе (`AC-036e`).
 *
 * Главное действие на экране ровно одно: лаймовой кнопки две быть не может
 * (дизайн-договор, разд. 4.6).
 *
 * @supports: R-036
 * @adr: ADR-0008
 */
import { CALCULATOR_PATH, useNavigate } from '@/shared/lib/routing';
import { QUOTE_LABELS, calculationQuery, type QuoteView } from '../model/view';

export function QuotePrimaryAction({
  view,
  issuing,
  onIssue,
}: {
  view: QuoteView;
  issuing: boolean;
  onIssue: () => void;
}) {
  if (view.documentHref !== null) {
    return (
      <a className="imolt-button imolt-quote-link" href={view.documentHref} download>
        {QUOTE_LABELS.download}
      </a>
    );
  }

  return (
    <button type="button" className="imolt-button" onClick={onIssue} disabled={!view.canIssue || issuing}>
      {issuing ? QUOTE_LABELS.issuing : QUOTE_LABELS.issue}
    </button>
  );
}

export function QuoteSecondaryActions({ calculationId }: { calculationId: string }) {
  const navigate = useNavigate();

  // Расчёт называется в адресе перехода: экран расчёта восстанавливает набранные
  // данные и выбранные полигоны из адреса, и переход без параметра открыл бы
  // пустую форму вместо того расчёта, по которому смотрят предложение
  // (AC-036g; `@/shared/lib/viewState`).
  const toCalculation = () => navigate(CALCULATOR_PATH, calculationQuery(calculationId));

  // Оба перехода ведут на экран расчёта: карточка заявки на вывоз живёт там
  // же, под результатами (дизайн-договор, разд. 5, Э-08). Названы они
  // по-разному, потому что это разные намерения пользователя.
  return (
    <>
      <button type="button" className="imolt-button imolt-button--secondary" onClick={toCalculation}>
        {QUOTE_LABELS.pickupRequest}
      </button>
      <button type="button" className="imolt-button imolt-button--tertiary" onClick={toCalculation}>
        {QUOTE_LABELS.backToCalculation}
      </button>
    </>
  );
}
