/**
 * Раздел витрины: компоненты расчёта и сравнения полигонов (R-084).
 *
 * Состояния показаны рядом, а не по очереди: расхождение между «активен» и
 * «данные устарели» или между пустой и заполненной сводкой видно только при
 * сравнении на одной странице.
 *
 * @supports: R-084
 */
import { useState } from 'react';
import { OptionCard, OptionTable, RouteDetails, RouteModal, StatusBadge, type BadgeStatus } from '@/entities/landfill';
import { AllocationPanel, SummaryBar, SummaryPanel } from '@/widgets/selection-summary';
import { CompanyProfile } from '@/widgets/company-profile';
import { Button, EmptyState } from '@/shared/ui';
import { formatMoney } from '@/shared/lib/formatting';
import { ApiProblem } from '@/shared/api/http';
import type { PlacementOption, RouteSummary } from '@/shared/api/contracts';
import { Section } from '../ui/Section';

/** Показательный полигон: числа примера договора, чтобы витрина не выдумывала. */
const SAMPLE_OPTION: PlacementOption = {
  landfillId: 'vostok-timohovo',
  landfillName: 'Комплекс переработки «Восток»',
  address: 'Московская обл., Богородский г. о., д. Тимохово',
  distanceKm: 45,
  transportCost: { amount: '10800.00', currency: 'RUB' },
  disposalCost: { amount: '9000.00', currency: 'RUB' },
  totalCost: { amount: '19800.00', currency: 'RUB' },
  status: 'active',
  statusUpdatedAt: '2026-09-17',
};

/** Заблокированный полигон: та же форма данных, другой статус и плечо. */
const BLOCKED_OPTION: PlacementOption = {
  landfillId: 'aleksinskiy-karier',
  landfillName: 'Полигон «Алексинский карьер»',
  address: 'Московская обл., г. о. Клин',
  distanceKm: 88,
  transportCost: { amount: '21120.00', currency: 'RUB' },
  disposalCost: { amount: '12000.00', currency: 'RUB' },
  totalCost: { amount: '33120.00', currency: 'RUB' },
  status: 'blocked',
  statusUpdatedAt: '2026-09-17',
};

const FRESHNESS_DATE = '2026-09-17';

const STATUSES: BadgeStatus[] = ['active', 'blocked', 'unconfirmed', 'stale'];

/** Маршрут с открытыми деталями: разрешение даёт расчётная часть. */
const ROUTE_GRANTED: RouteSummary = {
  access: { granted: true, reason: null },
  legs: [
    {
      landfillId: SAMPLE_OPTION.landfillId,
      distanceKm: 45,
      durationMinutes: 70,
      externalMapUrl: 'https://yandex.ru/maps/',
      encumbrances: [],
    },
  ],
  total: { amount: '19800.00', currency: 'RUB' },
};

/** Тот же маршрут для гостя: детали закрыты подпиской. */
/** Адрес вывоза примера договора: вторая метка на карте окна маршрута. */
const SHOWCASE_PICKUP = {
  value: 'г Москва, ул Годовикова, д 9',
  coordinates: { latitude: 55.8055, longitude: 37.6206 },
};

const ROUTE_LOCKED: RouteSummary = {
  access: { granted: false, reason: 'subscriptionRequired' },
  legs: [],
  total: { amount: '19800.00', currency: 'RUB' },
};

const ALLOCATION_PROBLEM = new ApiProblem(
  'urn:imolt:problem:allocation-mismatch',
  'Распределение не сходится с объёмом',
  422,
  'По группе «Лом бетона» распределено 17 т из 20 т',
);

export function CalculatorSection() {
  // Витрина показывает живые компоненты, а не снимки: отметка строки должна
  // работать здесь так же, как на экране расчёта.
  const [selected, setSelected] = useState<string[]>([SAMPLE_OPTION.landfillId]);
  const [routeOpen, setRouteOpen] = useState(false);

  return (
    <>
      <Section title="Состояния полигона">
        {STATUSES.map(status => (
          <div className="imolt-split" key={status}>
            <StatusBadge status={status} statusUpdatedAt={FRESHNESS_DATE} />
          </div>
        ))}
      </Section>

      <Section title="Карточка полигона">
        <ul className="imolt-options">
          <OptionCard
            option={SAMPLE_OPTION}
            status="active"
            selected={false}
            onToggle={() => undefined}
            onRoute={() => undefined}
          />
          <OptionCard
            option={SAMPLE_OPTION}
            status="active"
            selected
            onToggle={() => undefined}
            onRoute={() => undefined}
          />
          <OptionCard
            option={{ ...BLOCKED_OPTION, disposalCost: null }}
            status="blocked"
            selected={false}
            onToggle={() => undefined}
            onRoute={() => undefined}
          />
        </ul>
      </Section>

      <Section title="Таблица сравнения полигонов">
        <OptionTable
          caption="Сравнение полигонов"
          options={[SAMPLE_OPTION, BLOCKED_OPTION]}
          statusesUpdatedAt={FRESHNESS_DATE}
          selectedIds={selected}
          sort="total"
          order="asc"
          onSort={() => undefined}
          onToggle={option =>
            setSelected(current =>
              current.includes(option.landfillId)
                ? current.filter(id => id !== option.landfillId)
                : [...current, option.landfillId],
            )
          }
          onRoute={() => undefined}
        />
      </Section>

      <Section title="Таблица сравнения: загрузка">
        <OptionTable
          caption="Сравнение полигонов, идёт расчёт"
          options={[]}
          statusesUpdatedAt={FRESHNESS_DATE}
          selectedIds={[]}
          sort="total"
          order="asc"
          onSort={() => undefined}
          onToggle={() => undefined}
          onRoute={() => undefined}
          loading
        />
      </Section>

      <Section title="Таблица сравнения: пустой результат">
        <OptionTable
          caption="Сравнение полигонов, ничего не найдено"
          options={[]}
          statusesUpdatedAt={FRESHNESS_DATE}
          selectedIds={[]}
          sort="total"
          order="asc"
          onSort={() => undefined}
          onToggle={() => undefined}
          onRoute={() => undefined}
          empty={
            <EmptyState
              title="Нет полигонов, принимающих этот тип отходов ближе 50 км"
              hint="Снимите фильтр расстояния или выберите другой тип отходов."
            />
          }
        />
      </Section>

      <Section title="Детали маршрута">
        <div className="imolt-card">
          <RouteDetails option={SAMPLE_OPTION} summary={ROUTE_GRANTED} />
        </div>
        <div className="imolt-card">
          <RouteDetails option={SAMPLE_OPTION} summary={ROUTE_LOCKED} />
        </div>
      </Section>

      <Section title="Окно маршрута">
        {/* Окно уходит порталом в корень страницы: внутри обрезающей области
            оно резалось бы её краями. В витрине это значит, что образец не
            рисуется на месте, а открывается поверх неё. */}
        <p className="imolt-lead">
          Модальное окно поверх страницы: карта с метками адреса вывоза и полигона, расстояние и переход во внешние
          карты. Прокрутка страницы под ним заблокирована, закрывается крестиком, нажатием вне окна и клавишей Escape.
        </p>
        <Button size="s" kind="secondary" onClick={() => setRouteOpen(true)}>
          Показать окно маршрута
        </Button>
        {routeOpen && (
          <RouteModal
            option={SAMPLE_OPTION}
            summary={ROUTE_GRANTED}
            pickup={SHOWCASE_PICKUP}
            onClose={() => setRouteOpen(false)}
          />
        )}
      </Section>

      <Section title="Распределение объёма">
        <AllocationPanel
          rows={[
            {
              landfillId: SAMPLE_OPTION.landfillId,
              landfillName: SAMPLE_OPTION.landfillName,
              share: '12',
            },
            {
              landfillId: BLOCKED_OPTION.landfillId,
              landfillName: BLOCKED_OPTION.landfillName,
              share: '8',
            },
          ]}
          mismatch={null}
          problem={null}
          onChange={() => undefined}
        />
        <AllocationPanel
          rows={[
            {
              landfillId: `${SAMPLE_OPTION.landfillId}-mismatch`,
              landfillName: SAMPLE_OPTION.landfillName,
              share: '12',
            },
            {
              landfillId: `${BLOCKED_OPTION.landfillId}-mismatch`,
              landfillName: BLOCKED_OPTION.landfillName,
              share: '5',
            },
          ]}
          mismatch="Разложено 17 т из 20 т: сумма долей обязана сойтись с объёмом группы"
          problem={ALLOCATION_PROBLEM}
          onChange={() => undefined}
        />
      </Section>

      <Section title="Сводка выбора: боковая колонка">
        <SummaryPanel
          selectedCount={0}
          lines={[]}
          total=""
          totalLabel="Итого"
          onRoute={() => undefined}
          onOpenQuote={() => undefined}
          onPickup={() => undefined}
        />
        <SummaryPanel
          selectedCount={2}
          lines={[
            {
              landfillId: SAMPLE_OPTION.landfillId,
              landfillName: SAMPLE_OPTION.landfillName,
              sum: formatMoney(SAMPLE_OPTION.totalCost),
            },
            {
              landfillId: BLOCKED_OPTION.landfillId,
              landfillName: BLOCKED_OPTION.landfillName,
              sum: formatMoney(BLOCKED_OPTION.totalCost),
            },
          ]}
          total={formatMoney({ amount: '52920.00', currency: 'RUB' })}
          totalLabel="Итого"
          onRoute={() => undefined}
          onOpenQuote={() => undefined}
          onPickup={() => undefined}
        />
      </Section>

      <Section title="Представление компании">
        {/* Образец идёт со своими сведениями: услуги, проекты и контакты
            приходят из модуля сведений, а не из службы (R-087). */}
        <CompanyProfile />
      </Section>

      <Section title="Сводка выбора: нижняя панель">
        <SummaryBar
          selectedCount={2}
          total={formatMoney({ amount: '52920.00', currency: 'RUB' })}
          quoteLabel="Сформировать предложение"
          onOpenQuote={() => undefined}
          onPickup={() => undefined}
        />
      </Section>
    </>
  );
}
