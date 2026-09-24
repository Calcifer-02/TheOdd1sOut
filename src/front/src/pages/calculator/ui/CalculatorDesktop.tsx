/**
 * Десктопное представление экрана расчёта: контейнер 1240, таблица сравнения
 * полигонов и липкая сводка выбора справа.
 *
 * Ситуация — рабочее место перевозчика или сметчика: нужно видеть десяток
 * строк со всеми столбцами сразу и сортировать их, а не пролистывать карточки
 * (карта пути пользователя, путь 1 этап 4 и путь 2 этап 4; макет
 * «ux/Калькулятор.dc.html»).
 *
 * Разметка и только разметка: состояние, обращения к расчётной части и правила
 * выбора живут в модели экрана и общие с мобильным представлением.
 *
 * @req: R-019, R-023, R-024, R-025, R-027, R-029, R-048, R-058, R-060
 * @adr: ADR-0008
 */
import {
  Button,
  Checkbox,
  Chip,
  DateStamp,
  EmptyState,
  Field,
  Notice,
  Pager,
  Popover,
  RadioPills,
  Select,
  SuggestList,
  Tabs,
  Toolbar,
  useStyles,
} from '@/shared/ui';
import { OptionTable, RouteDetails } from '@/entities/landfill';
import { AllocationPanel, SummaryPanel } from '@/widgets/selection-summary';
import type { Unit } from '@/shared/lib/formatting';
import { formatMoney, formatNumber, unitName } from '@/shared/lib/formatting';
import { BREAKPOINTS } from '@/shared/lib/viewport';
import { colors, radius, space } from '@/shared/ui/tokens';
import { SORTS, type CalculatorModel } from '../model/useCalculator';
import { emptyResultTitle } from '../model/emptyResult';

const DESKTOP_CSS = `
/* Предельная ширина и поля содержимого принадлежат оболочке приложения
   (.imolt-shell-container): второй источник тех же чисел разошёлся бы с
   первым при правке дизайн-договора. */
.imolt-desk { display: flex; flex-direction: column; gap: ${space.xl}px; }
.imolt-desk-intro { display: flex; flex-direction: column; gap: ${space.s}px; max-width: 820px; }
.imolt-desk-form {
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.xl}px;
  display: flex;
  flex-direction: column;
  gap: ${space.l}px;
}
.imolt-desk-address { max-width: 640px; position: relative; }
.imolt-desk-lines { display: flex; flex-direction: column; gap: ${space.s}px; align-items: flex-start; }
.imolt-desk-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px auto;
  gap: ${space.s}px;
  align-items: flex-end;
  width: 100%;
}
.imolt-desk-line-amount { display: flex; gap: ${space.xs}px; align-items: flex-end; }
.imolt-desk-divider { height: 1px; background: ${colors.borderDivider}; }
.imolt-desk-form-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.l}px;
  flex-wrap: wrap;
}
.imolt-desk-benefits {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${space.s}px;
}
.imolt-desk-benefit {
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.l}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}
.imolt-desk-results { display: flex; gap: ${space.l}px; align-items: flex-start; flex-wrap: wrap; }
.imolt-desk-main { flex: 1 1 620px; min-width: 0; display: flex; flex-direction: column; gap: ${space.m}px; }
.imolt-desk-side { flex: 1 1 360px; max-width: 360px; min-width: 0; position: sticky; top: ${space.l}px; }
.imolt-desk-tools { display: flex; align-items: center; gap: ${space.s}px; flex-wrap: wrap; }
.imolt-desk-filter { position: relative; display: flex; gap: ${space.xs}px; align-items: center; }
.imolt-desk-table {
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.m}px;
  min-width: 0;
}
.imolt-desk-pickup {
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.l}px;
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
}
.imolt-desk-pickup-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${space.s}px;
}
.imolt-desk-pickup-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.l}px;
  flex-wrap: wrap;
}
@media (max-width: ${BREAKPOINTS.sideSummary - 1}px) {
  .imolt-desk-side { position: static; max-width: none; flex-basis: 100%; }
  .imolt-desk-benefits { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .imolt-desk-pickup-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .imolt-desk-line { grid-template-columns: minmax(0, 1fr); }
}
`;

export function CalculatorDesktop({ model }: { model: CalculatorModel }) {
  useStyles('calculator-desktop', DESKTOP_CSS);

  const { view, shown, freshness, selection, calculation } = model;
  const selectedIds = model.selectedInGroup.map((entry) => entry.landfillId);
  const summaryLines = model.selectedInGroup.map((entry) => {
    const option = (shown?.items ?? []).find(
      (candidate) => candidate.landfillId === entry.landfillId,
    );

    return {
      landfillId: entry.landfillId,
      landfillName: option?.landfillName ?? 'Полигон',
      sum: option ? formatMoney(option.totalCost) : '',
    };
  });

  return (
    <div className="imolt-desk">
      <div className="imolt-desk-intro">
        <h1 className="imolt-title">Калькулятор стоимости вывоза строительных отходов</h1>
        <p className="imolt-lead">
          Москва и Московская область. Перевозка и утилизация считаются отдельно, результат –
          сразу на этой странице.
        </p>
      </div>

      <section className="imolt-desk-form" aria-label="Исходные данные расчёта">
        <div className="imolt-desk-address">
          <Field
            id="address"
            label="Адрес вывоза"
            value={model.addressQuery}
            error={model.addressError}
            placeholder="Начните вводить адрес"
            onChange={model.changeAddress}
          />
          <SuggestList
            items={model.addressSuggestions}
            label="Подсказки адреса"
            render={(item) => item.value}
            onPick={model.pickAddress}
          />
        </div>

        <div className="imolt-desk-lines">
          {model.lines.map((line, index) => (
            <div className="imolt-desk-line" key={line.key}>
              <div>
                <Field
                  id={`waste-${index}`}
                  label="Тип отходов"
                  value={line.query}
                  placeholder="Название или код"
                  onChange={(value) => void model.searchGroup(line.key, value)}
                />
                <SuggestList
                  items={line.suggestions}
                  label="Подсказки типа отходов"
                  render={(item) => item.name}
                  onPick={(item) => model.pickGroup(line, item)}
                />
              </div>

              <div className="imolt-desk-line-amount">
                <Field
                  id={`amount-${index}`}
                  className="imolt-field--amount"
                  label="Объём"
                  value={line.amount}
                  inputMode="decimal"
                  hint={line.tons !== undefined ? `≈ ${formatNumber(line.tons)} т` : undefined}
                  onChange={(value) => model.changeAmount(line, value)}
                />
                <RadioPills
                  className="imolt-units"
                  name={`unit-${index}`}
                  label="Мера объёма"
                  value={line.unit}
                  options={[
                    { value: 't' as Unit, label: unitName('t') },
                    { value: 'm3' as Unit, label: unitName('m3') },
                  ]}
                  onPick={(unit) => model.changeUnit(line, unit)}
                />
              </div>

              {model.lines.length > 1 && (
                <Button
                  kind="tertiary"
                  size="s"
                  ariaLabel={`Убрать тип отходов: ${line.query || 'строка не заполнена'}`}
                  onClick={() => model.removeLine(line.key)}
                >
                  Убрать
                </Button>
              )}
            </div>
          ))}

          <Button kind="tertiary" onClick={model.addLine}>
            Добавить тип отходов
          </Button>
        </div>

        <div className="imolt-desk-divider" />

        <div className="imolt-desk-form-foot">
          <Checkbox
            id="disposal-required"
            label="Нужна утилизация на полигоне"
            checked={model.disposalRequired}
            onChange={model.setDisposalRequired}
          />
          <Button
            // Лаймовая кнопка на экране одна: после появления результатов
            // главное действие — «Скачать КП», а не повторный расчёт
            // (дизайн-договор, разд. 4.6).
            kind={calculation ? 'secondary' : 'primary'}
            loading={model.busy}
            onClick={() => void model.calculate()}
          >
            Рассчитать
          </Button>
        </div>
      </section>

      {!calculation && !model.failure && (
        <div className="imolt-desk-benefits">
          <div className="imolt-desk-benefit">
            <strong>Цена видна сразу</strong>
            <span className="imolt-lead">
              Никаких «оставьте телефон». Перевозка и утилизация показаны отдельно по каждому
              полигону.
            </span>
          </div>
          <div className="imolt-desk-benefit">
            <strong>Расстояние по дорогам</strong>
            <span className="imolt-lead">
              Не по прямой: маршрут от вашего адреса до каждой площадки считается по дорожной
              сети.
            </span>
          </div>
          <div className="imolt-desk-benefit">
            <strong>Актуальные статусы</strong>
            <span className="imolt-lead">
              У каждого полигона статус приёма и дата, на которую подтверждены цена и допуск.
            </span>
          </div>
        </div>
      )}

      {model.failure && (
        <Notice kind="error">
          <strong>
            {model.failure.type === 'urn:imolt:problem:distance-service-unavailable'
              ? 'Не удалось рассчитать расстояния'
              : model.failure.title}
          </strong>
          {model.failure.detail && <span>{model.failure.detail}</span>}
          <Button kind="secondary" onClick={() => void model.calculate()}>
            Повторить
          </Button>
        </Notice>
      )}

      {calculation && (
        <section className="imolt-desk-results" aria-label="Результаты">
          <div className="imolt-desk-main">
            <h2 className="imolt-section">Результаты</h2>

            <Tabs
              label="Группы отходов"
              value={view.wasteGroupId ?? ''}
              options={calculation.items.map((item) => ({
                value: item.wasteGroupId,
                label: item.wasteGroupName,
              }))}
              onPick={(wasteGroupId) => model.applyView({ wasteGroupId })}
            />

            <div className="imolt-desk-tools">
              <RadioPills
                className="imolt-sorts"
                name="sort"
                label="Сортировка"
                value={view.sort}
                options={SORTS.map((sort) => ({ value: sort.field, label: sort.label }))}
                onPick={(field) => model.applyView({ sort: field })}
              />

              <div className="imolt-desk-filter">
                <Toolbar ariaLabel="Порядок и отбор по расстоянию">
                  <Button kind="tertiary" size="s" onClick={model.toggleOrder}>
                    {view.order === 'asc' ? 'По возрастанию' : 'По убыванию'}
                  </Button>
                  <Chip
                    label={`до ${view.distanceKm} км`}
                    pressed={view.distanceMode === 'atMost'}
                    expanded={model.filterDraft !== null}
                    onToggle={() =>
                      model.setFilterDraft(
                        model.filterDraft === null ? String(view.distanceKm) : null,
                      )
                    }
                  />
                  <Chip
                    label={`не менее ${view.distanceKm} км`}
                    pressed={view.distanceMode === 'atLeast'}
                    onToggle={() => model.applyView({ distanceMode: 'atLeast' })}
                  />
                </Toolbar>

                <Popover
                  title="Предел расстояния"
                  open={model.filterDraft !== null}
                  onClose={() => model.setFilterDraft(null)}
                >
                  <Field
                    id="distance-limit"
                    label="Не более, км"
                    value={model.filterDraft ?? ''}
                    inputMode="decimal"
                    onChange={model.setFilterDraft}
                  />
                  {/* Лаймовая кнопка на экране одна, и это «Скачать КП»:
                      применение отбора — действие вторичное (разд. 4.6). */}
                  <Button kind="secondary" onClick={() => model.applyDistanceDraft('atMost')}>
                    Применить
                  </Button>
                </Popover>
              </div>
            </div>

            {freshness && (
              <p className="imolt-freshness">
                <DateStamp iso={freshness.pricesUpdatedAt} kind="prices" />
                {' · '}
                <DateStamp iso={freshness.statusesUpdatedAt} kind="statuses" />
              </p>
            )}

            {model.warnings.map((warning) => (
              <Notice key={warning.landfillId} kind="warning">
                <span>{warning.message}</span>
              </Notice>
            ))}

            <div className="imolt-desk-table">
              <OptionTable
                caption="Сравнение полигонов"
                options={shown?.items ?? []}
                statusesUpdatedAt={freshness?.statusesUpdatedAt ?? ''}
                selectedIds={selectedIds}
                sort={view.sort}
                order={view.order}
                onSort={model.sortBy}
                onToggle={(option) => void model.toggleLandfill(option)}
                onRoute={(option) => void model.openRoute(option)}
                openRouteFor={model.route?.option.landfillId}
                routeDetails={
                  model.route && (
                    <RouteDetails option={model.route.option} summary={model.route.summary} />
                  )
                }
                onCloseRoute={model.closeRoute}
                loading={model.loadingOptions}
                empty={
                  <EmptyState
                    title={emptyResultTitle(shown?.emptyReason, view)}
                    hint="Снимите фильтр расстояния или выберите другой тип отходов."
                    action={
                      shown?.emptyReason === 'filteredOutByDistance' ? (
                        <Button kind="secondary" onClick={model.clearDistanceFilter}>
                          Снять фильтр
                        </Button>
                      ) : undefined
                    }
                  />
                }
              />

              {shown && shown.items.length > 0 && (
                <Pager total={shown.total} shown={shown.items.length} onMore={model.loadMore} />
              )}
            </div>

            {model.selectedInGroup.length > 1 && (
              <AllocationPanel
                rows={model.selectedInGroup.map((entry) => ({
                  landfillId: entry.landfillId,
                  landfillName: model.landfillNameById(entry.landfillId) ?? 'Полигон',
                  share: model.allocationDraft[entry.landfillId] ?? '',
                }))}
                mismatch={model.allocationMismatch}
                problem={model.allocationProblem}
                onChange={model.changeAllocationShare}
              />
            )}

            {model.quote && (
              <Notice kind="done">
                <strong>КП сохранено</strong>
                <a href={model.quoteDocumentHref} download>
                  Открыть коммерческое предложение
                </a>
                <a href={model.quoteScreenHref}>Открыть экран предложения</a>
              </Notice>
            )}

            {model.pickupDone && (
              <Notice kind="done">
                <strong>Заявка принята</strong>
                <span>{model.pickupDone}</span>
              </Notice>
            )}

            {model.pickup && (
              <section className="imolt-desk-pickup" aria-label="Заявка на вывоз">
                <h3 className="imolt-section">Заявка на вывоз</h3>
                <p className="imolt-lead">
                  Расчёт уже готов – заявка нужна, только если вывоз организуем мы.
                </p>
                <div className="imolt-desk-pickup-fields">
                  <Field
                    id="pickup-name"
                    label="Имя"
                    value={model.pickup.name}
                    placeholder="Как к вам обращаться"
                    onChange={(value) => model.changePickup({ name: value })}
                  />
                  <Field
                    id="pickup-phone"
                    label="Телефон"
                    value={model.pickup.phone}
                    inputMode="tel"
                    placeholder="+7"
                    onChange={(value) => model.changePickup({ phone: value })}
                  />
                  <Select
                    id="pickup-landfill"
                    label="Полигон"
                    value={model.pickup.landfillName}
                    options={(selection?.entries ?? []).map((entry) => ({
                      value: model.landfillNameById(entry.landfillId) ?? '',
                      label: model.landfillNameById(entry.landfillId) ?? '',
                    }))}
                    onPick={(landfillName) => model.changePickup({ landfillName })}
                  />
                </div>
                <div className="imolt-desk-pickup-foot">
                  <Checkbox
                    id="pickup-consent"
                    label="Согласен на обработку персональных данных согласно политике"
                    checked={model.pickup.consent}
                    onChange={(consent) => model.changePickup({ consent })}
                  />
                  <Button kind="secondary" onClick={() => void model.sendPickup()}>
                    Отправить заявку
                  </Button>
                </div>
                {model.pickupError && (
                  <p className="imolt-error" role="alert">
                    {model.pickupError}
                  </p>
                )}
              </section>
            )}
          </div>

          <div className="imolt-desk-side">
            <SummaryPanel
              selectedCount={selection?.selectedLandfills ?? 0}
              lines={summaryLines}
              total={model.allocationTotal ?? (selection ? formatMoney(selection.total) : '')}
              totalLabel={model.allocationTotal ? 'Итого по распределению' : 'Итого'}
              onRoute={() => {
                const first = (shown?.items ?? []).find((option) =>
                  selectedIds.includes(option.landfillId),
                );
                if (first) {
                  void model.openRoute(first);
                }
              }}
              onDownload={() => void model.download()}
              onPickup={model.openPickup}
            />
          </div>
        </section>
      )}
    </div>
  );
}
