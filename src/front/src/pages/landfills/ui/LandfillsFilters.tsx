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
 * @supports: R-039, R-040
 * @adr: ADR-0008
 */
import { useEffect, useState } from 'react';
import { Button, Chip, Field } from '@/shared/ui';
import type { WasteGroup } from '@/shared/api/references';

export function LandfillsFilters({
  groups,
  query,
  wasteGroupId,
  filtered,
  onSearch,
  onToggleGroup,
  onReset,
}: {
  groups: WasteGroup[];
  query: string;
  wasteGroupId: string;
  /** отбор задан: только тогда есть что сбрасывать */
  filtered: boolean;
  onSearch: (query: string) => void;
  onToggleGroup: (wasteGroupId: string) => void;
  onReset: () => void;
}) {
  const [text, setText] = useState(query);

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

      <div className="imolt-landfills-groups" role="group" aria-label="Группа отходов">
        {groups.map(group => (
          <Chip
            key={group.id}
            label={group.name}
            pressed={group.id === wasteGroupId}
            onToggle={() => onToggleGroup(group.id)}
          />
        ))}
      </div>

      {/* Сброс стоит в той же полосе, что поиск и группы: обёртка выносила
          его отдельной строкой, и полоса отбора распадалась на три блока
          (BUG-003). */}
      {filtered ? (
        <Button kind="tertiary" onClick={onReset}>
          Сбросить отбор
        </Button>
      ) : null}
    </div>
  );
}
