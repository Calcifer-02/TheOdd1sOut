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
 * @req: R-013, R-019, R-023, R-024, R-025, R-027, R-029, R-048, R-058, R-060
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
  PhoneField,
  Popover,
  RadioPills,
  Tabs,
  Toolbar,
  useStyles,
} from '@/shared/ui';
import { Combobox } from '@/shared/ui/combobox';
import { Illustration } from '@/shared/ui/illustrations';
import { OptionTable, RouteModal } from '@/entities/landfill';
import { AllocationPanel, SummaryPanel, SELECTION_EMPTY_HINT } from '@/widgets/selection-summary';
import { CompanyProfile } from '@/widgets/company-profile';
import type { Unit } from '@/shared/lib/formatting';
import { formatMoney, formatNumber, unitName } from '@/shared/lib/formatting';
import { BREAKPOINTS } from '@/shared/lib/viewport';
import { colors, layout, radius, space, stroke } from '@/shared/ui/tokens';
import { SORTS, type CalculatorModel } from '../model/useCalculator';
import { emptyResultTitle } from '../model/emptyResult';

/** Колонка «Объём и мера»: узкое поле количества плюс переключатель меры. */
/**
 * Высота подписи поля вместе с её отбивкой. Типографика в токены не вынесена,
 * поэтому строка подписи названа здесь: правило `.imolt-label` объявляет
 * `line-height: 16px` и отбивку `space.xxs`.
 */
const LABEL_BLOCK = 16 + space.xxs;

const AMOUNT_COLUMN = 280;

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
.imolt-desk-lines { display: flex; flex-direction: column; gap: ${space.s}px; align-items: flex-start; }

/* Одна вертикаль формы: адрес вывоза занимает ту же колонку, что и название
   типа отходов, поэтому оба поля начинаются и заканчиваются на одной линии.
   Разная ширина соседних строк читается как лесенка и сбивает с того, где у
   формы край (BUG-011). */
.imolt-desk-address,
.imolt-desk-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) ${AMOUNT_COLUMN}px auto;
  gap: ${space.s}px;
  align-items: start;
  width: 100%;
}
.imolt-desk-line-amount { display: flex; gap: ${space.xs}px; align-items: start; }

/* Мера объёма подписи не имеет, а стоит рядом с подписанным полем: без сдвига
   на высоту подписи переключатель встал бы на её строку, а не на строку поля.
   Строка при этом выровнена по верху: у кубометров под полем появляется
   пересчёт в тонны, и выравнивание по низу уводило бы «Тип отходов» вниз на
   высоту этой подсказки (R-014, R-015). */
.imolt-desk-line .imolt-units { margin-top: ${LABEL_BLOCK}px; }
.imolt-desk-divider { height: 1px; background: ${colors.borderDivider}; }
.imolt-desk-form-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space.l}px;
  flex-wrap: wrap;
}

/* Подвал формы ставит флажок утилизации и «Рассчитать» на одну линию, а для
   этого обе цели нажатия обязаны быть одной высоты: общая строка согласия
   рассчитана на нижнюю границу 44 px, а кнопка рядом выше, и разница видна
   как съехавший флажок (BUG-005; разд. 4.5). Выравнивание внутри самой
   строки — дело общего компонента, здесь только высота ряда. */
.imolt-desk-form-foot > .imolt-consent { min-height: ${layout.fieldHeight}px; }

.imolt-desk-benefits {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${space.s}px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.imolt-desk-benefit {
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.l}px;
  display: flex;
  flex-direction: column;
  gap: ${space.xs}px;
}

/* Рисунок карточки — второй план: цвет он берёт ролью из токенов, а первым
   остаётся заголовок и объяснение словами (разд. 4.5). */
.imolt-desk-benefit .imolt-illustration { color: ${colors.textSecondary}; flex: none; }
/* Результаты идут одной колонкой: заголовок, вкладки и полоса управления
   стоят над блоком результатов, а сам блок — таблица и сводка — собран в
   общую поверхность ниже. */
.imolt-desk-results { display: flex; flex-direction: column; gap: ${space.m}px; }

/* Общая поверхность блока результатов.
   Таблица и сводка были двумя белыми карточками рядом, и при коротком списке
   правая кончалась заметно ниже левой: на живом стенде при одном полигоне
   область прокрутки таблицы 254 точки высоты против примерно 400 у карточки
   сводки, отчего низ блока получался рваным, а рядом с таблицей оставалось
   пустое место (второй пакет замечаний заказчика, R-058). Одна плашка на оба
   блока даёт им общий низ: колонки тянутся до высоты поверхности, а не
   каждая до своего содержимого. */
.imolt-desk-surface {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
  gap: ${space.m}px;
  min-width: 0;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.m}px;
}
.imolt-desk-main { flex: 1 1 620px; min-width: 0; display: flex; flex-direction: column; gap: ${space.m}px; }

/* Колонка сводки появляется только вместе с выбором: пустая она отнимала у
   таблицы 360 точек ширины и ничем их не занимала. Пока не выбран ни один
   полигон, поверхность равна таблице, а о выборе говорит строка над ней
   (R-027). Разделитель принадлежит колонке сводки: внутри общей плашки две
   стороны разводит линия, а не зазор между карточками. */
.imolt-desk-side {
  flex: 0 0 ${layout.sideColumnWidth}px;
  max-width: ${layout.sideColumnWidth}px;
  min-width: 0;
  align-self: stretch;
  border-left: ${stroke.hairline}px solid ${colors.borderDivider};
  padding-left: ${space.m}px;
}

/* Сводка прилипает при прокрутке: итог обязан быть виден в тот момент, когда
   отмечается очередная строка таблицы (дизайн-договор, разд. 4.4). */
.imolt-desk-side > * { position: sticky; top: ${space.l}px; }

/* Внутри общей поверхности собственных плашек у таблицы и сводки нет: иначе
   выйдет карточка в карточке. У сводки плашка снимается здесь, а не в самой
   панели, — в витрине компонентов панель стоит отдельно, и плашка ей нужна.
   Составным селектором, потому что лист общего слоя ложится в страницу
   последним и при равном весе перебивает одиночный класс панели. */
.imolt-desk-surface .imolt-card.imolt-summary-panel {
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}

/* Объяснение выбора до того, как он сделан: одна строка над таблицей вместо
   пустой карточки в боковой колонке. */
.imolt-desk-pick-hint { margin: 0; }
.imolt-desk-tools { display: flex; align-items: center; gap: ${space.s}px; flex-wrap: wrap; }
.imolt-desk-filter { position: relative; display: flex; gap: ${space.xs}px; align-items: center; }
/* Плашку блоку результатов рисует общая поверхность, поэтому у таблицы
   остаётся только её собственная геометрия. */
.imolt-desk-table { min-width: 0; }
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
  /* Узкое окно рабочего места уводит сводку под таблицу. Поверхность у них
     по-прежнему одна, но разделяет стороны уже верхняя линия, а не боковая:
     боковая рамка осталась бы висеть вдоль всей ширины экрана. */
  .imolt-desk-side {
    max-width: none;
    flex: 1 1 100%;
    align-self: auto;
    border-left: 0;
    border-top: ${stroke.hairline}px solid ${colors.borderDivider};
    padding-left: 0;
    padding-top: ${space.m}px;
  }
  .imolt-desk-side > * { position: static; }
  .imolt-desk-benefits { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .imolt-desk-pickup-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .imolt-desk-address,
  .imolt-desk-line { grid-template-columns: minmax(0, 1fr); }
}
`;

export function CalculatorDesktop({ model }: { model: CalculatorModel }) {
  useStyles('calculator-desktop', DESKTOP_CSS);

  const { view, shown, freshness, selection, calculation } = model;
  const selectedIds = model.selectedInGroup.map(entry => entry.landfillId);
  const summaryLines = model.selectedInGroup.map(entry => {
    const option = (shown?.items ?? []).find(candidate => candidate.landfillId === entry.landfillId);

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
          Москва и Московская область. Перевозка и утилизация считаются отдельно, результат – сразу на этой странице.
        </p>
      </div>

      <section className="imolt-desk-form" aria-label="Исходные данные расчёта">
        <div className="imolt-desk-address">
          {/* Адрес — единственное поле формы со свободным вводом: перечня
              адресов не существует, и закрыть список здесь нельзя. Расчёт
              всё равно опирается на координаты выбранной подсказки, а не на
              набранную строку (R-012, AC-012d), поэтому обработчика возврата
              у поля нет. */}
          <Combobox
            id="address"
            label="Адрес вывоза"
            listLabel="Подсказки адреса"
            placeholder="Начните вводить адрес"
            error={model.addressError}
            query={model.addressQuery}
            selected={model.addressPicked}
            items={model.addressSuggestions}
            render={item => item.value}
            onQuery={model.changeAddress}
            onPick={model.pickAddress}
          />
        </div>

        <div className="imolt-desk-lines">
          {model.lines.map((line, index) => (
            <div className="imolt-desk-line" key={line.key}>
              {/* Тип отходов берётся только из справочника: набранная строка
                  значением не становится (R-013, BUG-004). */}
              <Combobox
                id={`waste-${index}`}
                label="Тип отходов"
                listLabel="Типы отходов справочника"
                placeholder="Название или код"
                query={line.query}
                selected={line.group ?? null}
                items={line.suggestions}
                render={group => group.name}
                onQuery={value => void model.searchGroup(line.key, value)}
                onOpen={() => void model.browseGroups(line)}
                onDismiss={() => model.dismissGroup(line)}
                onPick={group => model.pickGroup(line, group)}
              />

              <div className="imolt-desk-line-amount">
                <Field
                  id={`amount-${index}`}
                  className="imolt-field--amount"
                  label="Объём"
                  value={line.amount}
                  inputMode="decimal"
                  hint={line.tons !== undefined ? `≈ ${formatNumber(line.tons)} т` : undefined}
                  onChange={value => model.changeAmount(line, value)}
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
                  onPick={unit => model.changeUnit(line, unit)}
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
            // главное действие — «Сформировать предложение», а не повторный расчёт
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
        // Три равноправных объяснения — это список, а не три случайных блока:
        // так вспомогательная технология называет их число, а карточка
        // получает рисунок вместо голого абзаца (BUG-006).
        <ul className="imolt-desk-benefits" aria-label="Что даёт расчёт">
          <li className="imolt-desk-benefit">
            <Illustration kind="transport" />
            <strong>Цена видна сразу</strong>
            <span className="imolt-lead">
              Никаких «оставьте телефон». Перевозка и утилизация показаны отдельно по каждому полигону.
            </span>
          </li>
          <li className="imolt-desk-benefit">
            <Illustration kind="route" />
            <strong>Расстояние по дорогам</strong>
            <span className="imolt-lead">
              Не по прямой: маршрут от вашего адреса до каждой площадки считается по дорожной сети.
            </span>
          </li>
          <li className="imolt-desk-benefit">
            <Illustration kind="statuses" />
            <strong>Актуальные статусы</strong>
            <span className="imolt-lead">
              У каждого полигона статус приёма и дата, на которую подтверждены цена и допуск.
            </span>
          </li>
        </ul>
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
          <h2 className="imolt-section">Результаты</h2>

          <Tabs
            label="Группы отходов"
            value={view.wasteGroupId ?? ''}
            options={calculation.items.map(item => ({
              value: item.wasteGroupId,
              label: item.wasteGroupName,
            }))}
            onPick={wasteGroupId => model.applyView({ wasteGroupId })}
          />

          <div className="imolt-desk-tools">
            <RadioPills
              className="imolt-sorts"
              name="sort"
              label="Сортировка"
              value={view.sort}
              options={SORTS.map(sort => ({ value: sort.field, label: sort.label }))}
              onPick={field => model.applyView({ sort: field })}
            />

            <div className="imolt-desk-filter">
              <Toolbar ariaLabel="Порядок и отбор по расстоянию">
                {/* Подпись переключателя меняется вместе с порядком, и без
                    резерва под вторую подпись кнопка меняла бы ширину, двигая
                    соседей полосы управления. Резерв держит место, доступным
                    именем остаётся текущая подпись (R-024). */}
                <Button
                  kind="tertiary"
                  size="s"
                  reserve={view.order === 'asc' ? 'По убыванию' : 'По возрастанию'}
                  onClick={model.toggleOrder}
                >
                  {view.order === 'asc' ? 'По возрастанию' : 'По убыванию'}
                </Button>
                <Chip
                  label={`до ${view.distanceKm} км`}
                  pressed={view.distanceMode === 'atMost'}
                  expanded={model.filterDraft !== null}
                  onToggle={() => model.setFilterDraft(model.filterDraft === null ? String(view.distanceKm) : null)}
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
                {/* Лаймовая кнопка на экране одна, и это «Сформировать
                      предложение»: применение отбора — действие вторичное
                      (разд. 4.6). */}
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

          {model.warnings.map(warning => (
            <Notice key={warning.landfillId} kind="warning">
              <span>{warning.message}</span>
            </Notice>
          ))}

          {/* До выбора боковой колонки нет, и объяснить назначение флажков
                больше негде. Слова те же, что у пустого состояния сводки:
                второй их редакции в проекте нет (R-027). */}
          {(selection?.selectedLandfills ?? 0) === 0 && (
            <p className="imolt-lead imolt-desk-pick-hint">{SELECTION_EMPTY_HINT}</p>
          )}

          {/* Блок результатов стоит на одной поверхности: слева таблица,
              справа сводка выбора, низ у обеих сторон один (R-058). */}
          <div className="imolt-desk-surface">
            <div className="imolt-desk-main">
              <div className="imolt-desk-table">
                <OptionTable
                  caption="Сравнение полигонов"
                  options={shown?.items ?? []}
                  statusesUpdatedAt={freshness?.statusesUpdatedAt ?? ''}
                  selectedIds={selectedIds}
                  sort={view.sort}
                  order={view.order}
                  onSort={model.sortBy}
                  onToggle={option => void model.toggleLandfill(option)}
                  onRoute={option => void model.openRoute(option)}
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
            </div>

            {(selection?.selectedLandfills ?? 0) > 0 && (
              <div className="imolt-desk-side">
                <SummaryPanel
                  selectedCount={selection?.selectedLandfills ?? 0}
                  lines={summaryLines}
                  total={model.allocationTotal ?? (selection ? formatMoney(selection.total) : '')}
                  totalLabel={model.allocationTotal ? 'Итого по распределению' : 'Итого'}
                  // Сводка спрашивает про весь выбор, а не про первый отмеченный
                  // полигон: требование R-032 называет выбранные полигоны во
                  // множественном числе. Кнопка в строке таблицы — другой
                  // случай: там спрашивают про один полигон строки.
                  onRoute={() => void model.openSelectionRoute()}
                  onOpenQuote={model.openQuote}
                  onPickup={model.openPickup}
                />
              </div>
            )}
          </div>

          {model.selectedInGroup.length > 1 && (
            <AllocationPanel
              rows={model.selectedInGroup.map(entry => ({
                landfillId: entry.landfillId,
                landfillName: model.landfillNameById(entry.landfillId) ?? 'Полигон',
                share: model.allocationDraft[entry.landfillId] ?? '',
              }))}
              mismatch={model.allocationMismatch}
              problem={model.allocationProblem}
              onChange={model.changeAllocationShare}
            />
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
              <p className="imolt-lead">Расчёт уже готов – заявка нужна, только если вывоз организуем мы.</p>
              <div className="imolt-desk-pickup-fields">
                <Field
                  id="pickup-name"
                  label="Имя"
                  value={model.pickup.name}
                  placeholder="Как к вам обращаться"
                  onChange={value => model.changePickup({ name: value })}
                />
                <PhoneField
                  id="pickup-phone"
                  label="Телефон"
                  value={model.pickup.phone}
                  error={model.pickupPhoneError}
                  onChange={phone => model.changePickup({ phone })}
                />
                <Combobox
                  id="pickup-landfill"
                  label="Полигон"
                  listLabel="Выбранные полигоны"
                  query={model.pickupLandfillQuery}
                  selected={model.pickup.landfillName || null}
                  items={model.pickupLandfills}
                  render={name => name}
                  onQuery={model.setPickupLandfillQuery}
                  onDismiss={model.dismissPickupLandfill}
                  onPick={model.pickPickupLandfill}
                />
              </div>
              <div className="imolt-desk-pickup-foot">
                <Checkbox
                  id="pickup-consent"
                  label="Согласен на обработку персональных данных согласно политике"
                  checked={model.pickup.consent}
                  onChange={consent => model.changePickup({ consent })}
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
        </section>
      )}

      {/* Окно маршрута стоит над страницей, а не в таблице: прежде оно
          отрисовывалось внутри ячейки и резалось областью прокрутки таблицы
          (решение заказчика от 24.09.2026, R-033). Открывают его и кнопка
          строки, и сводка выбора, а фокус после закрытия возвращается на то
          управление, которое окно открыло. Сколько полигонов показать, решает
          не окно: их перечень пришёл вместе с вопросом. */}
      {/* Представление компании стоит под работой, а не над ней: пришедший за
          расчётом начинает с формы, а вопросы «кто это» и «как связаться» приходят после
          неё (R-087). */}
      <CompanyProfile />

      {model.route && calculation && (
        <RouteModal
          option={model.route.options}
          summary={model.route.summary}
          scope={model.route.scope}
          unavailable={model.route.unavailable}
          pickup={calculation.pickupAddress}
          onClose={model.closeRoute}
        />
      )}
    </div>
  );
}
