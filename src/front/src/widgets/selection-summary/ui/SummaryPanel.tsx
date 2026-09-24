/**
 * Сводка выбора боковой колонкой (R-027, R-032, R-036).
 *
 * На рабочем месте сводка стоит справа от таблицы и прилипает при прокрутке:
 * итог обязан быть виден в тот момент, когда отмечается очередная строка, а не
 * после возврата к началу списка (дизайн-договор, разд. 4.4).
 *
 * Панель ничего не складывает: и строки, и итог приходят от расчётной части.
 * Второе место сложения тех же сумм разошлось бы с первым (ADR-0008,
 * инвариант 2).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { Button, Card, Stat, useStyles } from '@/shared/ui';
import { colors, fonts, layout, space, stroke } from '@/shared/ui/tokens';

export const SUMMARY_PANEL_CSS = `
/* Правила панели записаны вместе с «imolt-card» намеренно, и это не
   украшение селектора. Общее оформление подключается корнем приложения, а
   правила экрана — самим экраном; действия потомков в React выполняются
   раньше действий корня, поэтому лист общего слоя ложится в страницу
   последним. При равном весе селекторов побеждает он, и одиночное правило
   панели свой зазор теряло: объявленные здесь шаги просто не доходили до
   экрана. Вес «imolt-card.imolt-summary-panel» выше, и порядок листов на
   него уже не влияет.

   Оба состояния — одна поверхность одной геометрии: панель занимает боковую
   колонку целиком, а рамка объявлена и пустому состоянию, и заполненному.
   Рамка только у одного из них сдвинула бы содержимое на толщину линии
   относительно другого, и переход «выбрал – снял выбор» дёргал бы текст. */
.imolt-card.imolt-summary-panel {
  display: flex;
  flex-direction: column;
  gap: ${space.m}px;
  width: 100%;
  border: ${stroke.hairline}px solid transparent;
}

/* Пустое состояние — место, где появится сводка, а не готовая карточка:
   пунктир отличает его от заполненной панели, а заголовок и пояснение стоят
   парой в один шаг шкалы (макет «ux/Калькулятор.dc.html», правая колонка). */
.imolt-card.imolt-summary-panel--empty {
  gap: ${space.xs}px;
  border-color: ${colors.borderDefault};
  border-style: dashed;
}

/* Тень по договору положена всплывающему окну и липкой сводке (разд. 4.3):
   заполненная панель едет над таблицей при прокрутке, и без тени её край
   теряется на белом фоне строк. */
.imolt-card.imolt-summary-panel--filled { box-shadow: ${layout.shadow}; }

.imolt-summary-lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: ${space.xxs}px; }
.imolt-summary-line { display: flex; align-items: baseline; justify-content: space-between; gap: ${space.s}px; }

/* Название полигона режется многоточием, а не переносится: перенос уводит
   сумму на вторую строку, и столбец сумм перестаёт быть столбцом. */
.imolt-summary-line > span:first-child {
  color: ${colors.textSecondary};
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Сумма строки — не итог: общий класс «imolt-total» набран в размер итога, и
   в сводке из двух-трёх строк все числа получались одинаково крупными.
   Собственное правило оставляет табличные цифры, но возвращает строке её
   ступень (разд. 4.2). */
.imolt-summary-sum {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  white-space: nowrap;
}

.imolt-summary-actions { display: flex; flex-direction: column; gap: ${space.xs}px; }
`;

/** Строка сводки: выбранный полигон и его сумма, как её назвала служба. */
export type SummaryLine = { landfillId: string; landfillName: string; sum: string };

/**
 * Слова пустого состояния выбора. Названы здесь, потому что нужны двоим: самой
 * панели в витрине и экрану расчёта, который до выбора панель не показывает и
 * объясняет выбор строкой над таблицей. Вторая редакция этих слов разошлась бы
 * с первой молча.
 */
export const SELECTION_EMPTY_TITLE = 'Выберите полигоны';

export const SELECTION_EMPTY_HINT =
  'Отметьте один или несколько – здесь появится итог, маршрут и коммерческое предложение.';

export function SummaryPanel({
  selectedCount,
  lines,
  total,
  totalLabel,
  onRoute,
  onDownload,
  onPickup,
}: {
  selectedCount: number;
  lines: SummaryLine[];
  total: string;
  /** Чей это итог: выбора или распределения объёма. */
  totalLabel: string;
  onRoute: () => void;
  onDownload: () => void;
  onPickup: () => void;
}) {
  useStyles('selection-summary-panel', SUMMARY_PANEL_CSS);

  if (selectedCount === 0) {
    return (
      <Card title={SELECTION_EMPTY_TITLE} className="imolt-summary-panel imolt-summary-panel--empty">
        <p className="imolt-lead">{SELECTION_EMPTY_HINT}</p>
      </Card>
    );
  }

  return (
    <Card title={`Выбрано ${selectedCount}`} className="imolt-summary-panel imolt-summary-panel--filled">
      <ul className="imolt-summary-lines">
        {lines.map(line => (
          <li className="imolt-summary-line" key={line.landfillId}>
            <span>{line.landfillName}</span>
            <span className="imolt-summary-sum">{line.sum}</span>
          </li>
        ))}
      </ul>

      <Stat label={totalLabel} value={total} />

      <div className="imolt-summary-actions">
        <Button kind="secondary" onClick={onRoute}>
          Получить маршрут
        </Button>
        <Button onClick={onDownload}>Скачать КП</Button>
        <Button kind="tertiary" onClick={onPickup}>
          Оставить заявку на вывоз
        </Button>
      </div>

      <p className="imolt-hint">Цена предварительная. Отклонение финальной – в пределах согласованного порога.</p>
    </Card>
  );
}
