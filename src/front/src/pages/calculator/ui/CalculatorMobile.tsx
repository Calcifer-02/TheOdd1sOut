/**
 * Мобильное представление экрана расчёта: одна колонка, карточки полигонов,
 * сводка выбора нижней панелью, маршрут и заявка — выдвижными листами.
 *
 * Ситуация — телефон в руке у объекта сноса: столбцов на экран не помещается,
 * поэтому сравнение идёт карточками, а не таблицей (дизайн-договор, разд. 4.5;
 * макет «ux/Калькулятор мобильный.dc.html»).
 *
 * Разметка и только разметка: состояние, обращения к расчётной части и правила
 * выбора живут в модели экрана и общие с десктопным представлением.
 *
 * @req: R-013, R-019, R-023, R-048, R-058, R-061
 * @adr: ADR-0008
 */
import { Button, Field, Notice, PhoneField, RadioPills, Sheet, Skeleton } from '@/shared/ui';
import { Combobox } from '@/shared/ui/combobox';
import { OptionCard, RouteDetails, badgeStatus } from '@/entities/landfill';
import { AllocationPanel, SummaryBar } from '@/widgets/selection-summary';
import { CompanyProfile } from '@/widgets/company-profile';
import type { Unit } from '@/shared/lib/formatting';
import { formatDate, formatNumber, formatMoney, unitName } from '@/shared/lib/formatting';
import { SORTS, type CalculatorModel } from '../model/useCalculator';
import { emptyResultTitle } from '../model/emptyResult';

export function CalculatorMobile({ model }: { model: CalculatorModel }) {
  const { view, shown, freshness, selection } = model;

  return (
    <div className="imolt-page">
      <h1 className="imolt-title">Калькулятор вывоза строительных отходов</h1>
      <p className="imolt-lead">Москва и область. Перевозка и утилизация – отдельно, результат сразу.</p>

      <section className="imolt-card" aria-label="Исходные данные расчёта">
        {/* Адрес — единственное поле формы со свободным вводом: перечня
            адресов не существует. Расчёт опирается на координаты выбранной
            подсказки, а не на набранную строку (R-012, AC-012d). */}
        <Combobox
          id="address"
          label="Адрес вывоза"
          listLabel="Подсказки адреса"
          placeholder="Улица и дом"
          error={model.addressError}
          query={model.addressQuery}
          selected={model.addressPicked}
          items={model.addressSuggestions}
          render={item => item.value}
          onQuery={model.changeAddress}
          onPick={model.pickAddress}
        />

        {model.lines.map((line, index) => (
          <div key={line.key}>
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

            <div className="imolt-row">
              <Field
                id={`amount-${index}`}
                className="imolt-field--amount"
                label="Объём"
                value={line.amount}
                inputMode="decimal"
                hint={line.tons !== undefined ? `≈ ${formatNumber(line.tons)} т` : undefined}
                reserveHint
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

            {/* Случайно добавленную строку надо чем-то убрать: на телефоне
                кнопки не было вовсе, и лишний тип отходов оставался в расчёте до
                перезагрузки страницы (замечание заказчика от 24.09.2026). */}
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

        <label className="imolt-consent">
          <input
            type="checkbox"
            className="imolt-check"
            checked={model.disposalRequired}
            onChange={event => model.setDisposalRequired(event.target.checked)}
          />
          Нужна утилизация на полигоне
        </label>

        <button type="button" className="imolt-button" onClick={() => void model.calculate()} disabled={model.busy}>
          Рассчитать
        </button>
      </section>

      {model.busy && <Skeleton rows={3} label="Идёт расчёт" />}

      {model.failure && (
        <Notice kind="error">
          <strong>
            {model.failure.type === 'urn:imolt:problem:distance-service-unavailable'
              ? 'Не удалось рассчитать расстояния'
              : model.failure.title}
          </strong>
          {model.failure.detail && <span>{model.failure.detail}</span>}
          <button type="button" className="imolt-button imolt-button--secondary" onClick={() => void model.calculate()}>
            Повторить
          </button>
        </Notice>
      )}

      {model.calculation && (
        <section aria-label="Результаты">
          <h2 className="imolt-section">Результаты</h2>

          <div className="imolt-tabs" role="tablist" aria-label="Группы отходов">
            {model.calculation.items.map(item => (
              <button
                key={item.wasteGroupId}
                type="button"
                role="tab"
                className="imolt-tab"
                aria-selected={view.wasteGroupId === item.wasteGroupId}
                onClick={() => model.applyView({ wasteGroupId: item.wasteGroupId })}
              >
                {item.wasteGroupName}
              </button>
            ))}
          </div>

          <div className="imolt-sorts-line">
            <RadioPills
              className="imolt-sorts"
              name="sort"
              label="Сортировка"
              value={view.sort}
              options={SORTS.map(sort => ({ value: sort.field, label: sort.label }))}
              onPick={field => model.applyView({ sort: field })}
            />
            {/* Общая кнопка, а не своя разметка: вторая реализация того же
                управления расходится с первой молча, а резерв под вторую
                подпись держит ширину при смене порядка (R-024). */}
            <Button
              kind="tertiary"
              reserve={view.order === 'asc' ? 'По убыванию' : 'По возрастанию'}
              onClick={model.toggleOrder}
            >
              {view.order === 'asc' ? 'По возрастанию' : 'По убыванию'}
            </Button>
          </div>

          <div className="imolt-chips" aria-label="Фильтр расстояния">
            <button
              type="button"
              className="imolt-chip"
              aria-pressed={view.distanceMode === 'atMost'}
              onClick={() => model.setFilterDraft(String(view.distanceKm))}
            >
              до {view.distanceKm} км
            </button>
            <button
              type="button"
              className="imolt-chip"
              aria-pressed={view.distanceMode === 'atLeast'}
              onClick={() => model.applyView({ distanceMode: 'atLeast' })}
            >
              не менее {view.distanceKm} км
            </button>
          </div>

          {model.filterDraft !== null && (
            <div className="imolt-card">
              <Field
                id="distance-limit"
                label="Не более, км"
                value={model.filterDraft}
                inputMode="decimal"
                onChange={model.setFilterDraft}
              />
              <button type="button" className="imolt-button" onClick={() => model.applyDistanceDraft('atMost')}>
                Применить
              </button>
            </div>
          )}

          {freshness && (
            <p className="imolt-freshness">
              {freshness.pricesUpdatedAt === freshness.statusesUpdatedAt
                ? `Цены и статусы на ${formatDate(freshness.pricesUpdatedAt)}`
                : `Цены на ${formatDate(freshness.pricesUpdatedAt)}, статусы на ${formatDate(freshness.statusesUpdatedAt)}`}
            </p>
          )}

          {model.warnings.map(warning => (
            <Notice key={warning.landfillId} kind="warning">
              <span>{warning.message}</span>
            </Notice>
          ))}

          {shown && shown.items.length === 0 && (
            <Notice kind="empty">
              <strong>{emptyResultTitle(shown.emptyReason, view)}</strong>
              <span>Снимите фильтр расстояния или выберите другой тип отходов.</span>
              {shown.emptyReason === 'filteredOutByDistance' && (
                <button
                  type="button"
                  className="imolt-button imolt-button--secondary"
                  onClick={model.clearDistanceFilter}
                >
                  Снять фильтр
                </button>
              )}
            </Notice>
          )}

          <ul className="imolt-options">
            {(shown?.items ?? []).map(option => (
              <OptionCard
                key={option.landfillId}
                option={option}
                status={badgeStatus(option, freshness?.statusesUpdatedAt ?? option.statusUpdatedAt)}
                selected={model.isSelected(option)}
                onToggle={() => void model.toggleLandfill(option)}
                onRoute={() => void model.openRoute(option)}
              />
            ))}
          </ul>

          {shown && shown.items.length < shown.total && (
            <button type="button" className="imolt-button imolt-button--secondary" onClick={model.loadMore}>
              Показать ещё
            </button>
          )}

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
        </section>
      )}

      {selection && selection.selectedLandfills > 0 && (
        // Та же кнопка, что в боковой колонке рабочего места: нижняя панель
        // ведёт на предпросмотр предложения, а не выпускает его (R-036,
        // AC-036f).
        <SummaryBar
          selectedCount={selection.selectedLandfills}
          total={model.allocationTotal ?? formatMoney(selection.total)}
          quoteLabel="Сформировать предложение"
          onOpenQuote={model.openQuote}
          onPickup={model.openPickup}
        />
      )}

      {model.route && (
        // Сколько полигонов в сводке, решает не лист: их перечень пришёл
        // вместе с вопросом — из карточки полигона спрашивают про один, из
        // сводки выбора про весь выбор (R-032).
        <Sheet title="Маршрут" onClose={model.closeRoute}>
          <RouteDetails
            option={model.route.options}
            summary={model.route.summary}
            scope={model.route.scope}
            unavailable={model.route.unavailable}
          />
        </Sheet>
      )}

      {/* Представление компании стоит под работой, а не над ней: пришедший за
          расчётом начинает с формы, а вопросы «кто это» и «как связаться» приходят после
          неё (R-087). */}
      <CompanyProfile />

      {model.pickup && (
        <Sheet title="Заявка на вывоз" onClose={model.closePickup}>
          <Field
            id="pickup-name"
            label="Имя"
            value={model.pickup.name}
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
          <label className="imolt-consent">
            <input
              type="checkbox"
              className="imolt-check"
              checked={model.pickup.consent}
              onChange={event => model.changePickup({ consent: event.target.checked })}
            />
            Согласен на обработку персональных данных согласно политике
          </label>
          {model.pickupError && (
            <p className="imolt-error" role="alert">
              {model.pickupError}
            </p>
          )}
          <button type="button" className="imolt-button" onClick={() => void model.sendPickup()}>
            Отправить заявку
          </button>
        </Sheet>
      )}
    </div>
  );
}
