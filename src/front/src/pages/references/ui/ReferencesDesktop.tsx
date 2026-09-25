/**
 * Редактор цен и справочников на рабочем месте: две вкладки таблицами
 * «полигон × группа отходов» и «группы отходов» (экран Э-11).
 *
 * Таблица — нативная семантика с подписью и заголовками столбцов, ключ
 * строки предметный (карточка практики PRACT-021). Ячейка с ценой — форма,
 * а не текст: правка идёт через `EditableCell`.
 *
 * Заголовок столбца называет то, что стоит в ячейке, вместе с мерой: имя
 * группы отходов не сообщало, что под ним цена за тонну, а «Цены актуальны»
 * не называло дату (второй пакет замечаний заказчика, 24.09.2026). Меру
 * читает человек, а не угадывает по виду значения.
 *
 * @req: R-039, R-040, R-042, R-043, R-048
 * @supports: R-058
 * @adr: ADR-0008
 */
import { useState } from 'react';
import {
  Button,
  DataTable,
  DateStamp,
  Field,
  Notice,
  Popover,
  Skeleton,
  SortControl,
  Tabs,
  Toolbar,
  useStyles,
} from '@/shared/ui';
import { StatusBadge } from '@/entities/landfill';
import { ImportPanel } from '@/features/reference-import';
import { LANDFILL_SORTS, type Landfill } from '@/shared/api/references';
import type { WasteGroup } from '@/shared/api/contracts';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/formatting';
import { latestTariffDate, selectionCaption, tariffCellKey, tariffOf, transportCellKey } from '../model/editor';
import { AccessNotice } from './AccessNotice';
import { EditableCell } from './EditableCell';
import { ManualStatusForm } from './ManualStatusForm';
import { SyncRunPanel } from './SyncRunPanel';
import { REFERENCES_CSS } from './styles';
import type { ReferencesViewProps } from './props';

/** Столбцы, общие для обеих вкладок: имя записи слева, дата справа. */
const NAME_COLUMN = { key: 'name', title: 'Полигон и юридическое лицо' };

/**
 * Столбец статуса шире прочих: в нём стоят значок состояния, дата
 * актуальности и кнопка подтверждения — три вещи, а не одно число
 * (замечание заказчика от 25.09.2026).
 */
const STATUS_COLUMN = { key: 'status', title: 'Статус полигона', width: '300px' };

/**
 * В ячейке стоит дата, на которую известны цены полигона, а не признак
 * «актуальны или нет»: заголовок называет именно дату (термин глоссария
 * «дата актуальности данных»).
 */
const DATE_COLUMN = { key: 'updatedAt', title: 'Дата актуальности цен', align: 'end' as const };

/** Мера тарифа утилизации в заголовке столбца группы отходов: рубли за тонну. */
const TARIFF_UNIT = '₽/т';

/**
 * Ширина столбца тарифа. Считана по содержимому: «12 345,00 ₽» с полями
 * ячейки укладывается в эту меру, а название группы в заголовке переносится.
 */
const TARIFF_COLUMN_WIDTH = '132px';

const WASTE_GROUP_COLUMNS = [
  { key: 'name', title: 'Группа отходов' },
  // Сокращение «т-км» — из глоссария проекта, оно же стоит в справочнике.
  { key: 'transportPricePerTonKm', title: 'Цена перевозки, ₽/т-км', align: 'end' as const },
  { key: 'densityTonPerCubicMeter', title: 'Коэффициент плотности, т/м³', align: 'end' as const },
  { key: 'fkkoCodes', title: 'Коды каталога отходов' },
  { key: 'updatedAt', title: 'Дата актуальности цены', align: 'end' as const },
];

export function ReferencesDesktop({ editor, route, importing }: ReferencesViewProps) {
  useStyles('references', REFERENCES_CSS);

  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusLandfillId, setStatusLandfillId] = useState<string | null>(null);

  const landfills = editor.visibleLandfills(query);
  const wasteGroups = editor.visibleWasteGroups(query);
  const cellRefusalOf = (key: string) =>
    editor.cellRefusal !== null && editor.cellRefusal.key === key ? editor.cellRefusal.title : null;

  return (
    <div className="imolt-references">
      <div className="imolt-references-head">
        <div className="imolt-references-head-text">
          <h1 className="imolt-references-title">Цены и справочники</h1>
          <span className="imolt-references-subtitle">
            Менеджер данных ИМОЛТ – тарифы утилизации, цены перевозки и статусы приёма
          </span>
        </div>
        <div className="imolt-references-actions">
          <Button kind="secondary" onClick={() => setImportOpen(true)} disabled={!editor.editable}>
            Импорт из Excel
          </Button>
          {/* Операции заведения полигона в договоре нет: реестр пополняется
              из официального перечня (R-046). Кнопка названа, но недоступна —
              скрывать объявленное макетом действие значило бы промолчать. */}
          <Button kind="secondary" disabled>
            Добавить полигон
          </Button>
        </div>
      </div>

      <span className="imolt-references-subtitle">
        Полигон заводится из официального перечня, а не в редакторе: книга импорта существующие записи меняет, а новых
        не создаёт.
      </span>

      {editor.freshness !== null && (
        <div className="imolt-references-status">
          <DateStamp iso={editor.freshness.pricesUpdatedAt} kind="prices" />
          <DateStamp iso={editor.freshness.statusesUpdatedAt} kind="statuses" />
        </div>
      )}

      {editor.maintenanceRefusal !== null && (
        <AccessNotice refusal={editor.maintenanceRefusal} onRetry={() => void editor.retryMaintenance()} />
      )}

      {editor.loadRefusal !== null && (
        <Notice kind="error">
          {editor.loadRefusal.title}
          {editor.loadRefusal.detail ? `. ${editor.loadRefusal.detail}` : ''}
        </Notice>
      )}

      <SyncRunPanel
        run={editor.syncRun}
        refusal={editor.syncRefusal}
        disabled={!editor.editable}
        onManualStatus={() => {
          setStatusLandfillId(editor.landfills[0]?.id ?? null);
          setStatusOpen(true);
        }}
      />

      <Popover title="Статус полигона вручную" open={statusOpen} onClose={() => setStatusOpen(false)}>
        <ManualStatusForm
          landfills={editor.landfills}
          landfillId={statusLandfillId}
          onPickLandfill={setStatusLandfillId}
          disabled={!editor.editable}
          busy={editor.saving === `status:${statusLandfillId ?? ''}`}
          refusal={cellRefusalOf(`status:${statusLandfillId ?? ''}`)}
          onSave={(status, reason) =>
            statusLandfillId === null ? Promise.resolve(false) : editor.saveStatus(statusLandfillId, status, reason)
          }
          onDone={() => setStatusOpen(false)}
        />
      </Popover>

      {importOpen && (
        <ImportPanel
          state={importing.state}
          disabled={!editor.editable}
          onPickKind={importing.pickKind}
          onPickFile={file => void importing.parse(file)}
          onApply={() => void importing.apply()}
          onRebuild={() => void importing.rebuild()}
          onClose={() => {
            importing.reset();
            setImportOpen(false);
          }}
        />
      )}

      {/* Вкладки, счётчик и поиск стоят строками, а не одной линией: три
          управления разной природы и разной высоты читались как три решения
          подряд (второй пакет замечаний заказчика, 24.09.2026). */}
      <Toolbar ariaLabel="Отбор записей справочника" className="imolt-references-filters">
        <Tabs
          label="Справочник"
          value={route.tab}
          options={[
            { value: 'landfills' as const, label: 'Полигоны' },
            { value: 'wasteGroups' as const, label: 'Группы отходов' },
          ]}
          onPick={route.pickTab}
        />
        {/* Счётчик принадлежит выборке, а не полю: он стоит над поиском и
            называет показанное из найденного. Область сообщения нужна, чтобы
            смена числа доходила и без взгляда на таблицу. */}
        {/* То же управление порядком, что на расчёте и в справочнике полигонов:
            вторая его реализация разошлась бы с первой молча (R-088). */}
        <SortControl
          name="references-sort"
          options={LANDFILL_SORTS}
          value={editor.sort}
          direction={editor.order}
          onPick={editor.sortBy}
          onToggle={editor.toggleOrder}
        />

        <div className="imolt-references-selection imolt-references-selection--flush">
          <p className="imolt-references-count" role="status">
            {selectionCaption(
              route.tab,
              route.tab === 'landfills' ? landfills.length : wasteGroups.length,
              route.tab === 'landfills' ? editor.landfillTotal : editor.wasteGroupTotal,
            )}
          </p>
          <Field
            id="references-query"
            label={route.tab === 'landfills' ? 'Поиск по полигону или юрлицу' : 'Поиск по группе или коду каталога'}
            value={query}
            onChange={setQuery}
          />
        </div>
      </Toolbar>

      {editor.loading && <Skeleton rows={5} label="Справочник загружается" />}

      {/* Таблица — сама плашка: у неё есть поверхность, скругление и поле
          подписи. Карточка поверх неё давала вторую рамку и вторую отбивку,
          и подпись таблицы уезжала вправо от заголовка экрана (BUG-003). */}
      {!editor.loading && route.tab === 'landfills' && (
        <DataTable
          caption="Тарифы утилизации за тонну по полигонам и группам отходов"
          columns={[
            NAME_COLUMN,
            // Под именем группы стоит тариф утилизации в рублях за тонну:
            // одно имя группы этого не называло, и заголовок расходился с
            // содержимым (второй пакет замечаний заказчика).
            // Ширина столбца задана содержимым, а не заголовком: в ячейке
            // стоит цена в пять-шесть знаков, а название группы длинное, и по
            // заголовку столбец растягивался втрое (замечание заказчика от
            // 25.09.2026). Заголовок переносится по словам.
            ...editor.wasteGroups.map(group => ({
              key: `group:${group.id}`,
              title: `${group.name}, ${TARIFF_UNIT}`,
              align: 'end' as const,
              width: TARIFF_COLUMN_WIDTH,
            })),
            STATUS_COLUMN,
            DATE_COLUMN,
          ]}
          rows={landfills}
          rowKey={(landfill: Landfill) => landfill.id}
          empty="Полигонов с таким названием или юрлицом нет"
          cell={(landfill: Landfill, column: string) => landfillCell(landfill, column, editor, cellRefusalOf)}
        />
      )}

      {!editor.loading && route.tab === 'wasteGroups' && (
        <DataTable
          caption="Цены перевозки и коэффициенты плотности по группам отходов"
          columns={WASTE_GROUP_COLUMNS}
          rows={wasteGroups}
          rowKey={(group: WasteGroup) => group.id}
          empty="Групп отходов с таким названием или кодом нет"
          cell={(group: WasteGroup, column: string) => wasteGroupCell(group, column, editor, cellRefusalOf)}
        />
      )}

      {!editor.loading && route.tab === 'wasteGroups' && (
        <span className="imolt-references-subtitle">
          Изменение цены перевозки применяется ко всем новым расчётам. Выпущенные коммерческие предложения остаются с
          ценами на дату выпуска.
        </span>
      )}
    </div>
  );
}

/** Содержимое ячейки строки полигона. */
function landfillCell(
  landfill: Landfill,
  column: string,
  editor: ReferencesViewProps['editor'],
  refusalOfCell: (key: string) => string | null,
) {
  if (column === 'name') {
    // Название и юридическое лицо — две строки ячейки: подряд идущие span
    // остались бы в одной строке и читались бы одним слитым названием.
    return (
      <span className="imolt-references-cell-name">
        <span className="imolt-references-card-name">{landfill.name}</span>
        <span className="imolt-references-card-entity">{landfill.legalEntity ?? 'юридическое лицо не указано'}</span>
      </span>
    );
  }

  if (column === 'status') {
    return (
      <div className="imolt-references-status-cell">
        <StatusBadge status={landfill.status} statusUpdatedAt={landfill.statusUpdatedAt} />
        {landfill.status === 'unconfirmed' && (
          <Button
            kind="secondary"
            size="s"
            disabled={!editor.editable}
            onClick={() => void editor.saveStatus(landfill.id, 'active')}
            ariaLabel={`Подтвердить приём: ${landfill.name}`}
          >
            Подтвердить приём
          </Button>
        )}
      </div>
    );
  }

  if (column === 'updatedAt') {
    const date = latestTariffDate(landfill);
    return date === null ? 'тарифов нет' : formatDate(date);
  }

  const wasteGroupId = column.slice('group:'.length);
  const tariff = tariffOf(landfill, wasteGroupId);
  const key = tariffCellKey(landfill.id, wasteGroupId);
  const groupName = editor.wasteGroups.find(group => group.id === wasteGroupId)?.name ?? wasteGroupId;

  return (
    <EditableCell
      name={`Тариф утилизации, ${landfill.name}, ${groupName}`}
      value={tariff === undefined ? 'не задан' : formatMoney(tariff.disposalPricePerTon)}
      draft={tariff === undefined ? '' : tariff.disposalPricePerTon.amount}
      disabled={!editor.editable}
      busy={editor.saving === key}
      refusal={refusalOfCell(key)}
      onStart={editor.forgetCellRefusal}
      onSave={text => editor.saveTariff(landfill.id, wasteGroupId, text)}
    />
  );
}

/** Содержимое ячейки строки группы отходов. */
function wasteGroupCell(
  group: WasteGroup,
  column: string,
  editor: ReferencesViewProps['editor'],
  refusalOfCell: (key: string) => string | null,
) {
  if (column === 'name') {
    return <span className="imolt-references-card-name">{group.name}</span>;
  }

  if (column === 'densityTonPerCubicMeter') {
    return formatNumber(group.densityTonPerCubicMeter);
  }

  if (column === 'fkkoCodes') {
    return group.fkkoCodes.length === 0 ? 'коды не заведены' : group.fkkoCodes.join(', ');
  }

  if (column === 'updatedAt') {
    return formatDate(group.updatedAt);
  }

  const key = transportCellKey(group.id);

  return (
    <EditableCell
      name={`Цена перевозки, ${group.name}`}
      value={formatMoney(group.transportPricePerTonKm)}
      draft={group.transportPricePerTonKm.amount}
      disabled={!editor.editable}
      busy={editor.saving === key}
      refusal={refusalOfCell(key)}
      onStart={editor.forgetCellRefusal}
      onSave={text => editor.saveTransportPrice(group.id, text)}
    />
  );
}
