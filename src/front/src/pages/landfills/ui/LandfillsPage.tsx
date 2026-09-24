/**
 * Экран справочника полигонов: режим «Справочник цен» пути UC-009.
 *
 * Демонтажная компания смотрит тарифы утилизации до того, как появился адрес
 * вывоза: бюджет сноса собирается по справочнику, а не по расчёту рейса
 * (запрос на дизайн, разд. 6, UC-009). Поэтому экран отдельный, а не вкладка
 * внутри результатов расчёта.
 *
 * Представлений два. На рабочем месте — таблица со столбцами, на телефоне —
 * карточки: это разные деревья разметки, и выбирает между ними код, а не
 * правило `display: none` (дизайн-договор, разд. 4.5). Предметная часть у них
 * общая — `useLandfillsScreen`.
 *
 * @req: R-039, R-040
 * @supports: R-031, R-041, R-048
 * @adr: ADR-0008
 */
import { Button, EmptyState, Notice, Pager, Skeleton, useStyles } from '@/shared/ui';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { useLandfillsScreen } from '../model/useLandfillsScreen';
import { FreshnessBand } from './FreshnessBand';
import { LandfillDetails } from './LandfillDetails';
import { LandfillsCards } from './LandfillsCards';
import { LandfillsFilters } from './LandfillsFilters';
import { LandfillsTable } from './LandfillsTable';
import { LANDFILLS_CSS } from './styles';

export function LandfillsPage() {
  useStyles('landfills', LANDFILLS_CSS);

  const viewport = useViewport();
  const screen = useLandfillsScreen();

  const scope = screen.selectedGroup
    ? `группа «${screen.selectedGroup.name}»`
    : 'все группы отходов';

  // Один текст на заголовок таблицы и на имя списка карточек: выборка названа
  // одинаково в обоих представлениях (карточка практики PRACT-021). Счётчик
  // показанного сюда не входит — его ведёт `Pager`, и второе место того же
  // числа разошлось бы с первым.
  const caption = `Полигоны справочника: ${scope}`;

  const empty = !screen.loading && screen.failure === '' && screen.landfills.length === 0;

  return (
    <section className="imolt-landfills" aria-label="Справочник цен полигонов">
      <h1 className="imolt-title">Справочник цен полигонов</h1>
      <p className="imolt-lead">
        Тарифы утилизации по полигонам и группам отходов – без ввода адреса вывоза.
      </p>

      <FreshnessBand freshness={screen.freshness} />

      {screen.referenceFailure ? (
        <Notice kind="warning">
          {`${screen.referenceFailure}. Отбор по группе отходов сейчас недоступен`}
        </Notice>
      ) : null}

      <LandfillsFilters
        groups={screen.groups}
        query={screen.filters.query}
        wasteGroupId={screen.filters.wasteGroupId}
        filtered={screen.filters.query !== '' || screen.filters.wasteGroupId !== ''}
        onSearch={screen.search}
        onToggleGroup={screen.toggleGroup}
        onReset={screen.reset}
      />

      {screen.unknownGroup ? (
        <Notice kind="warning">
          {`Группы отходов «${screen.filters.wasteGroupId}» нет в справочнике`}
        </Notice>
      ) : null}

      <div
        className="imolt-landfills-body"
        data-card={screen.filters.landfillId === '' ? 'closed' : 'open'}
      >
        <div className="imolt-landfills-list">
          {screen.loading ? <Skeleton rows={5} label="Справочник полигонов загружается" /> : null}

          {!screen.loading && screen.failure ? (
            <>
              <Notice kind="error">{screen.failure}</Notice>
              <Button kind="secondary" onClick={screen.retry}>
                Повторить
              </Button>
            </>
          ) : null}

          {empty ? (
            <EmptyState
              title="Полигоны не найдены"
              hint="Тарифы различаются по группам отходов: снимите отбор или выберите другую группу."
              action={
                // Подпись отличается от кнопки в полосе отбора намеренно: два
                // действия с одним именем на экране неразличимы на слух.
                <Button kind="secondary" onClick={screen.reset}>
                  Показать все полигоны
                </Button>
              }
            />
          ) : null}

          {!screen.loading && screen.failure === '' && screen.landfills.length > 0 ? (
            isWide(viewport) ? (
              <LandfillsTable
                landfills={screen.landfills}
                groups={screen.groups}
                freshness={screen.freshness}
                wasteGroupId={screen.filters.wasteGroupId}
                caption={caption}
                onOpen={screen.openLandfill}
              />
            ) : (
              <LandfillsCards
                landfills={screen.landfills}
                groups={screen.groups}
                freshness={screen.freshness}
                wasteGroupId={screen.filters.wasteGroupId}
                caption={caption}
                onOpen={screen.openLandfill}
              />
            )
          ) : null}

          {/* Счётчик показанного против найденного остаётся и когда показано
              всё: по нему видно, стоит ли снимать отбор (PRACT-024). */}
          {!screen.loading && screen.failure === '' && screen.landfills.length > 0 ? (
            <Pager
              total={screen.total}
              shown={screen.landfills.length}
              onMore={screen.showMore}
              label="Показать ещё полигоны"
            />
          ) : null}
        </div>

        {screen.filters.landfillId === '' ? null : (
          <LandfillDetails
            key={screen.filters.landfillId}
            landfillId={screen.filters.landfillId}
            groups={screen.groups}
            freshness={screen.freshness}
            onClose={screen.closeLandfill}
          />
        )}
      </div>
    </section>
  );
}
