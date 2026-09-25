/**
 * Управление порядком списка: поле и направление.
 *
 * Три экрана упорядочивают списки одинаково — сравнение полигонов на расчёте,
 * справочник полигонов и редактор цен, — и до этого управление было написано
 * только на одном из них. Вторая его реализация разошлась бы с первой молча:
 * у одной появилась бы новая подпись, у другой — нет (R-088, R-024).
 *
 * Поля приходят снаружи: набор полей — дело экрана, а не общего слоя. Здесь
 * только правило показа: переключатель полей и кнопка направления, у которой
 * подпись меняется, а ширина держится резервом — иначе соседние управления
 * прыгают при каждом переключении.
 *
 * Выбранный порядок живёт в адресе страницы, но кладёт его туда экран: общий
 * слой об адресе не знает (ADR-0008, инвариант 1).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { Button } from './buttons';
import { RadioPills } from './controls';

/** Поле порядка: значение уходит в запрос, подпись видит читатель. */
export type SortOption<T extends string> = { value: T; label: string };

/** Направление порядка: то же слово, что в договоре расчётной части. */
export type SortDirection = 'asc' | 'desc';

/** Подписи направления. Объявлены один раз: кнопка и резерв берут их отсюда. */
const DIRECTION_WORD: Record<SortDirection, string> = {
  asc: 'По возрастанию',
  desc: 'По убыванию',
};

export function SortControl<T extends string>({
  name,
  label = 'Сортировка',
  options,
  value,
  direction,
  onPick,
  onToggle,
  className,
}: {
  /** Имя группы переключателей: на странице их может быть несколько. */
  name: string;
  label?: string;
  options: SortOption<T>[];
  value: T;
  direction: SortDirection;
  onPick: (value: T) => void;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div className={className ? `imolt-sorts-line ${className}` : 'imolt-sorts-line'}>
      <RadioPills className="imolt-sorts" name={name} label={label} value={value} options={options} onPick={onPick} />
      {/* Резерв под вторую подпись держит ширину кнопки при смене направления:
          без него соседние управления полосы сдвигаются на каждое нажатие. */}
      <Button kind="tertiary" reserve={DIRECTION_WORD[direction === 'asc' ? 'desc' : 'asc']} onClick={onToggle}>
        {DIRECTION_WORD[direction]}
      </Button>
    </div>
  );
}
