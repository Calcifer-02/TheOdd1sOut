/**
 * Раздел витрины: компоненты коммерческого предложения (R-084).
 *
 * Каждый компонент сущности «предложение» показан во всех своих состояниях:
 * до выпуска номера нет и срок действия не назначен, после выпуска есть и то,
 * и другое; состав бывает пустым, одной строкой выбора и несколькими долями
 * распределения; утилизация бывает не нужна.
 *
 * Образцы собраны из тех же модулей, что и экран: второй реализации здесь нет
 * (`AC-084b`). Числа — из ответа расчётной части на канонический расчёт
 * договора (`openapi.yaml`, пример `ConcreteCalculation`), а не придуманы.
 *
 * @supports: R-084
 */
import {
  PreliminaryPriceNotice,
  QuoteContacts,
  QuoteFacts,
  QuoteHeading,
  QuoteLineCards,
  QuoteLinesTable,
  QuoteTotal,
  useQuoteStyles,
  type QuoteLine,
} from '@/entities/quote';
import { Section } from '../ui/Section';

/** Канонический расчёт договора: 20 т бетона и 15 м³ древесины на «Восток». */
const CONCRETE_LINE: QuoteLine = {
  id: 'beton-lom-vostok-timohovo-0',
  wasteGroupName: 'Лом бетона и железобетона',
  landfillName: 'Комплекс переработки «Восток»',
  landfillAddress: 'Московская обл., Богородский г. о., д. Тимохово',
  distanceKm: 45,
  quantity: { value: 20, unit: 't' },
  tons: null,
  transportCost: { amount: '10800.00', currency: 'RUB' },
  disposalCost: { amount: '9000.00', currency: 'RUB' },
  totalCost: { amount: '19800.00', currency: 'RUB' },
};

/** Строка с мерой в кубометрах: пересчёт службы показан рядом с введённым. */
const WOOD_LINE: QuoteLine = {
  id: 'drevesina-vostok-timohovo-1',
  wasteGroupName: 'Древесина от разборки',
  landfillName: 'Комплекс переработки «Восток»',
  landfillAddress: 'Московская обл., Богородский г. о., д. Тимохово',
  distanceKm: 45,
  quantity: { value: 15, unit: 'm3' },
  tons: 7.5,
  transportCost: { amount: '5400.00', currency: 'RUB' },
  disposalCost: { amount: '2250.00', currency: 'RUB' },
  totalCost: { amount: '7650.00', currency: 'RUB' },
};

/** Доля распределения без утилизации: вывоз без приёма полигоном (R-021). */
const TRANSPORT_ONLY_LINE: QuoteLine = {
  id: 'beton-lom-iksha-1',
  wasteGroupName: 'Лом бетона и железобетона',
  landfillName: 'Площадка «Икша»',
  landfillAddress: 'Московская обл., Дмитровский г. о., пос. Икша',
  distanceKm: 52,
  quantity: { value: 8, unit: 't' },
  tons: null,
  transportCost: { amount: '4992.00', currency: 'RUB' },
  disposalCost: null,
  totalCost: { amount: '4992.00', currency: 'RUB' },
};

const LINES = [CONCRETE_LINE, WOOD_LINE, TRANSPORT_ONLY_LINE];

const TOTAL = { amount: '32442.00', currency: 'RUB' } as const;

const ISSUED_AT = '2026-09-17T12:04:00+03:00';

const VALID_UNTIL = '2026-09-24';

const PRICES_UPDATED_AT = '2026-09-17';

const PICKUP_ADDRESS = 'г Москва, ул Годовикова, д 9';

export function QuoteSection() {
  useQuoteStyles();

  return (
    <Section title="Предложение">
      <p className="imolt-lead">Шапка документа: до выпуска номера нет, после выпуска есть.</p>
      <QuoteHeading number={null} issuedAt={null} />
      <QuoteHeading number="КП-2026-0917-014" issuedAt={ISSUED_AT} />

      <p className="imolt-lead">Факты предложения: без срока действия и со сроком.</p>
      <QuoteFacts pickupAddress={PICKUP_ADDRESS} pricesUpdatedAt={PRICES_UPDATED_AT} validUntil={null} />
      <QuoteFacts pickupAddress={PICKUP_ADDRESS} pricesUpdatedAt={PRICES_UPDATED_AT} validUntil={VALID_UNTIL} />

      <p className="imolt-lead">Состав таблицей: пусто, без итога и с итогом.</p>
      <QuoteLinesTable lines={[]} total={null} />
      <QuoteLinesTable lines={LINES} total={null} />
      <QuoteLinesTable lines={LINES} total={TOTAL} />

      <p className="imolt-lead">Тот же состав карточками: пусто и со строками.</p>
      <QuoteLineCards lines={[]} />
      <QuoteLineCards lines={LINES} />

      <p className="imolt-lead">Итог: до выбора полигонов, по выбору и по выпущенному.</p>
      <QuoteTotal total={null} hint="Полигоны выбираются на экране расчёта" />
      <QuoteTotal total={TOTAL} hint="Итог по выбранным полигонам. Номер и срок действия присваиваются при выпуске" />
      <QuoteTotal total={TOTAL} hint="Итог выпущенного предложения: цены закреплены снимком на момент выпуска" />

      <p className="imolt-lead">Отметка о предварительности: без срока и со сроком.</p>
      <PreliminaryPriceNotice validUntil={null} />
      <PreliminaryPriceNotice validUntil={VALID_UNTIL} />

      <p className="imolt-lead">Подвал документа.</p>
      <QuoteContacts />
    </Section>
  );
}
