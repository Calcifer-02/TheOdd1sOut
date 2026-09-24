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
import { Button, Chip, Field } from '@/shared/ui';
import type { WasteGroup } from '@/shared/api/references';

/**
 * Подпись отбора по группе — она же доступное имя группы чипов: второй текст
 * для вспомогательной технологии разошёлся бы с видимым.
 */
const GROUPS_LABEL_ID = 'landfills-groups-label';

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

      {/* Сброс стоит в строке отбора по группе, а не отдельным блоком: обёртка
          выносила его третьей полосой, и отбор распадался (BUG-003). */}
      <div className="imolt-landfills-groups">
        <div className="imolt-landfills-group-field">
          <span className="imolt-label" id={GROUPS_LABEL_ID}>
            Группа отходов
          </span>
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
        </div>

        {filtered ? (
          <Button kind="tertiary" onClick={onReset}>
            Сбросить отбор
          </Button>
        ) : null}
      </div>
    </div>
  );
}
