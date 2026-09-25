/**
 * Отбор справочника: поиск по названию и группа отходов.
 *
 * Поиск применяется отправкой формы, а не на каждом знаке: строка запроса
 * живёт в адресе, и правка по знаку засыпала бы службу запросами ради
 * промежуточных состояний ввода.
 *
 * Группа отходов — переключатель отбора: нажат либо нет, поэтому `Chip` с
 * `aria-pressed`, а не радиогруппа (дизайн-договор, разд. 4.4).
 *
 * На телефоне чипы заменяются закрытым списком. Названия групп длинные
 * («Лом бетона и железобетона»), и в узкой колонке каждый чип вставал своей
 * строкой — столбик разной длины вместо полосы отбора (замечание заказчика
 * от 24.09.2026). Дерево разметки разное, поэтому выбирает код, а не правило
 * стиля: скрытая ветка осталась бы в дереве доступности (R-085).
 *
 * Полоса разделена на две строки: сверху поиск, снизу отбор по группе. Общую
 * высоту управлений держит общий слой, но у поиска и у отбора теперь по
 * собственной подписи, а в одной строке подписи двух блоков встают на разных
 * уровнях (второй пакет замечаний заказчика, 24.09.2026). Подпись у группы
 * отходов заведена здесь же: до этого группа была названа только доступным
 * именем, и зрячий пользователь не знал, по чему идёт отбор.
 *
 * @supports: R-039, R-040, R-058
 * @adr: ADR-0008
 */
import { useEffect, useState } from 'react';
import { Button, Chip, Field, Select, SortControl } from '@/shared/ui';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { LANDFILL_SORTS, type LandfillSort, type WasteGroup } from '@/shared/api/references';

/**
 * Подпись отбора по группе — она же доступное имя группы чипов: второй текст
 * для вспомогательной технологии разошёлся бы с видимым.
 */
const GROUPS_LABEL_ID = 'landfills-groups-label';

export function LandfillsFilters({
  groups,
  query,
  wasteGroupId,
  sort,
  order,
  filtered,
  onSearch,
  onToggleGroup,
  onSortBy,
  onToggleOrder,
  onReset,
}: {
  groups: WasteGroup[];
  query: string;
  wasteGroupId: string;
  /** поле порядка списка */
  sort: LandfillSort;
  /** направление порядка */
  order: 'asc' | 'desc';
  /** отбор задан: только тогда есть что сбрасывать */
  filtered: boolean;
  onSearch: (query: string) => void;
  onToggleGroup: (wasteGroupId: string) => void;
  onSortBy: (sort: LandfillSort) => void;
  onToggleOrder: () => void;
  onReset: () => void;
}) {
  const [text, setText] = useState(query);
  const wide = isWide(useViewport());

  // Ссылка из переписки задаёт поиск адресом: поле обязано показать ту же
  // строку, иначе видимое и действующее состояния расходятся.
  useEffect(() => setText(query), [query]);

  return (
    <div className="imolt-landfills-filters">
      <form
        className="imolt-landfills-search"
        role="search"
        aria-label="Поиск полигона"
        onSubmit={event => {
          event.preventDefault();
          onSearch(text);
        }}
      >
        <Field id="landfills-query" label="Поиск по названию полигона" value={text} onChange={setText} />
        <Button type="submit" kind="secondary">
          Найти
        </Button>
      </form>

      {/* Сброс стоит в строке отбора по группе, а не отдельным блоком: обёртка
          выносила его третьей полосой, и отбор распадался (BUG-003). */}
      <div className="imolt-landfills-groups">
        <div className="imolt-landfills-group-field">
          <span className="imolt-label" id={GROUPS_LABEL_ID}>
            Группа отходов
          </span>
          {wide ? (
            <div className="imolt-landfills-chips" role="group" aria-labelledby={GROUPS_LABEL_ID}>
              {groups.map(group => (
                <Chip
                  key={group.id}
                  label={group.name}
                  pressed={group.id === wasteGroupId}
                  onToggle={() => onToggleGroup(group.id)}
                />
              ))}
            </div>
          ) : (
            <Select
              id="landfills-group"
              label="Группа отходов"
              value={wasteGroupId}
              options={[
                { value: '', label: 'Все группы' },
                ...groups.map(group => ({ value: group.id, label: group.name })),
              ]}
              onPick={picked => {
                // Список называет выбранную группу, а модель экрана ждёт
                // переключения: повторный выбор той же группы отбор не снимает,
                // а «Все группы» снимает его явно.
                if (picked === '') {
                  if (wasteGroupId !== '') {
                    onToggleGroup(wasteGroupId);
                  }

                  return;
                }

                if (picked !== wasteGroupId) {
                  onToggleGroup(picked);
                }
              }}
            />
          )}
        </div>

        {/* То же управление порядком, что на экране расчёта: вторая его
            реализация разошлась бы с первой молча (R-088). */}
        <SortControl
          name="landfills-sort"
          options={LANDFILL_SORTS}
          value={sort}
          direction={order}
          onPick={onSortBy}
          onToggle={onToggleOrder}
        />

        {filtered ? (
          <Button kind="tertiary" onClick={onReset}>
            Сбросить отбор
          </Button>
        ) : null}
      </div>
    </div>
  );
}
