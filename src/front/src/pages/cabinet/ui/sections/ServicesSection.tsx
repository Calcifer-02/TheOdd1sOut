/**
 * Раздел «Услуги»: каталог услуг по документации (экран Э-10).
 *
 * Состав каталога — данные службы, а не перечень в коде: заказчик его не
 * подтверждал, и зашитый список разошёлся бы со справочником молча (R-052).
 *
 * Разметка карточки у телефона и рабочего места одна; различается число
 * колонок сетки, а это выражается оформлением, а не вторым деревом разметки.
 *
 * @req: R-052
 * @adr: ADR-0008
 */
import { EmptyState, Notice, Skeleton } from '@/shared/ui';
import type { ServiceOrderState, ServicesState } from '../../model/cabinet';
import { ServiceCard } from './ServiceCard';

export function ServicesSection({
  state,
  order,
  wide,
}: {
  state: ServicesState;
  order: ServiceOrderState;
  wide: boolean;
}) {
  const empty = !state.loading && state.failure === null && state.services.length === 0;

  return (
    <section className="imolt-cabinet-section" aria-labelledby="imolt-cabinet-services">
      <div className="imolt-cabinet-heading">
        <h1 className="imolt-title" id="imolt-cabinet-services">
          Услуги по документации
        </h1>
        <p className="imolt-lead">
          Цена указана от минимального объёма работ – точную назовёт менеджер после уточнения
          объекта.
        </p>
      </div>

      {state.failure !== null && <Notice kind="error">{state.failure}</Notice>}

      {state.loading && state.services.length === 0 && (
        <Skeleton rows={3} label="Каталог услуг загружается" />
      )}

      {empty && (
        <EmptyState
          title="Каталог услуг пуст"
          hint="Справочник услуг по документации ещё не заполнен."
        />
      )}

      {state.services.length > 0 && (
        <div className={wide ? 'imolt-cabinet-services imolt-cabinet-services--wide' : 'imolt-cabinet-services'}>
          {state.services.map((service) => (
            <ServiceCard key={service.id} service={service} order={order} />
          ))}
        </div>
      )}
    </section>
  );
}
