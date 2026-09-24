/**
 * Карточка полигона: подробности, тарифы, история юридических лиц и отзывы.
 *
 * Карточка — не модальное окно: она адресуется ссылкой и не перехватывает
 * фокус страницы (дизайн-договор, разд. 4.6). Закрытие возвращает к той же
 * выборке, потому что отбор остаётся в адресе.
 *
 * История юридических лиц показывается целиком: смена владельца не обнуляет
 * накопленные тарифы, и это видно прямо в карточке (R-041, AC-041a).
 *
 * @req: R-031, R-041
 * @supports: R-040, R-048
 * @adr: ADR-0008
 */
import { Button, Card, DateStamp, Notice, Skeleton } from '@/shared/ui';
import { StatusBadge } from '@/entities/landfill';
import { ReviewForm, ReviewList, ReviewSummary } from '@/entities/review';
import type { DataFreshness, WasteGroup } from '@/shared/api/references';
import { formatDate } from '@/shared/lib/formatting';
import { STALE_AFTER_DAYS, landfillBadgeStatus } from '../model/freshness';
import { tariffRows } from '../model/tariffs';
import { useLandfillCard } from '../model/useLandfillCard';
import { LandfillTariffs } from './LandfillTariffs';

export function LandfillDetails({
  landfillId,
  groups,
  freshness,
  onClose,
}: {
  landfillId: string;
  groups: WasteGroup[];
  freshness: DataFreshness | null;
  onClose: () => void;
}) {
  const state = useLandfillCard(landfillId);
  const card = state.card;
  const status = card === null ? null : landfillBadgeStatus(card, freshness);

  return (
    <Card
      className="imolt-landfill-details"
      title={card?.name ?? 'Карточка полигона'}
      actions={
        <Button kind="tertiary" onClick={onClose}>
          Закрыть карточку
        </Button>
      }
    >
      {state.loading ? <Skeleton rows={4} label="Карточка полигона загружается" /> : null}

      {!state.loading && state.failure ? (
        <>
          <Notice kind="error">{state.failure}</Notice>
          <Button kind="secondary" onClick={state.retry}>
            Повторить
          </Button>
        </>
      ) : null}

      {!state.loading && card !== null && status !== null ? (
        <>
          <p className="imolt-landfill-address">{card.address}</p>

          <span className="imolt-landfill-card-status">
            <StatusBadge status={status} statusUpdatedAt={card.statusUpdatedAt} />
            <DateStamp iso={card.statusUpdatedAt} kind="statuses" />
          </span>

          {card.status === 'blocked' ? (
            <Notice kind="warning">Полигон заблокирован: вывоз на него сейчас недопустим</Notice>
          ) : null}

          {status === 'stale' ? (
            <Notice kind="warning">
              {`Статус подтверждён более ${STALE_AFTER_DAYS} суток назад: сведения могли устареть`}
            </Notice>
          ) : null}

          <p>{`Юридическое лицо: ${card.legalEntity ?? 'не указано'}`}</p>

          {card.legalEntityHistory && card.legalEntityHistory.length > 0 ? (
            <ul className="imolt-landfill-history" aria-label="История юридических лиц">
              {card.legalEntityHistory.map(period => (
                <li key={`${period.legalEntity}-${period.since}`}>
                  {`${period.legalEntity}, с `}
                  <time dateTime={period.since}>{formatDate(period.since)}</time>
                  {period.until ? (
                    <>
                      {' по '}
                      <time dateTime={period.until}>{formatDate(period.until)}</time>
                    </>
                  ) : (
                    ' по настоящее время'
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          <h4 className="imolt-section">Тарифы утилизации</h4>
          {/* В карточке показаны все принимаемые группы: отбор списка сюда не
              переносится — карточка отвечает на вопрос о полигоне целиком. */}
          <LandfillTariffs rows={tariffRows(card, groups, '')} withDates />

          <h4 className="imolt-section">Отзывы о достоверности сведений</h4>
          <ReviewSummary averageRating={state.reviews?.averageRating ?? null} total={state.reviews?.total ?? 0} />
          <ReviewList
            reviews={state.reviews?.items ?? []}
            loading={state.reviews === null && state.reviewsFailure === ''}
            error={state.reviewsFailure || undefined}
          />
          <ReviewForm
            formId={`review-${landfillId}`}
            onSubmit={state.submitReview}
            sending={state.sending}
            error={state.sendFailure || undefined}
            done={state.sent}
          />
        </>
      ) : null}
    </Card>
  );
}
