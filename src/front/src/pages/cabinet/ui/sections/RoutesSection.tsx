/**
 * Раздел «Маршруты» (экран Э-10).
 *
 * Договор API не объявляет перечня маршрутов участника: маршрут считается для
 * конкретного расчёта (`getCalculationRoute`) и живёт рядом с выбором
 * полигонов. Раздел в меню назван дизайн-договором, поэтому он остаётся, но
 * показывает, откуда маршрут открывается, а не выдуманный список рейсов.
 *
 * @supports: R-032, R-050
 * @adr: ADR-0008
 */
import { Button, EmptyState } from '@/shared/ui';
import type { CabinetSection } from '@/widgets/cabinet-nav';

export function RoutesSection({ openSection }: { openSection: (next: CabinetSection) => void }) {
  return (
    <section className="imolt-cabinet-section" aria-labelledby="imolt-cabinet-routes">
      <div className="imolt-cabinet-heading">
        <h1 className="imolt-title" id="imolt-cabinet-routes">
          Маршруты
        </h1>
      </div>

      <EmptyState
        title="Маршрут открывается из расчёта"
        hint="Расстояние и стоимость видны в расчёте, время в пути и переход в карты – по подписке."
      />

      <Button kind="secondary" onClick={() => openSection('calculations')}>
        Перейти к расчётам
      </Button>
    </section>
  );
}
