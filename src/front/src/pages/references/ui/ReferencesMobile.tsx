/**
 * Редактор цен и справочников на телефоне: карточки вместо таблицы, правка —
 * отдельным экраном, импорт — по шагам.
 *
 * Мобильного макета у экрана Э-11 нет: карта пути называет ситуацию
 * менеджера данных рабочим местом. Представление дописано в том же стиле,
 * потому что заказчик требует оба представления у каждого экрана. Предметная
 * часть при этом общая: правила живут в `model/editor.ts`, здесь только
 * разметка (ADR-0008).
 *
 * Какая запись правится — видно в адресе, поэтому «назад» возвращает к
 * списку, а ссылка открывает ту же карточку.
 *
 * @req: R-039, R-040, R-042, R-043, R-048
 * @adr: ADR-0008
 */
import { useState } from 'react';
import {
  Button,
  Card,
  DateStamp,
  EmptyState,
  Field,
  Notice,
  Sheet,
  Skeleton,
  Tabs,
  useStyles,
} from '@/shared/ui';
import { StatusBadge } from '@/entities/landfill';
import { ImportSteps } from '@/features/reference-import';
import type { Landfill } from '@/shared/api/references';
import type { WasteGroup } from '@/shared/api/contracts';
import { formatDate, formatMoney, formatNumber } from '@/shared/lib/formatting';
import { latestTariffDate, tariffCellKey, tariffOf, transportCellKey } from '../model/editor';
import { AccessNotice } from './AccessNotice';
import { EditableCell } from './EditableCell';
import { ManualStatusForm } from './ManualStatusForm';
import { SyncRunPanel } from './SyncRunPanel';
import { REFERENCES_CSS } from './styles';
import type { ReferencesViewProps } from './props';

export function ReferencesMobile({ editor, route, importing }: ReferencesViewProps) {
  useStyles('references', REFERENCES_CSS);

  const [query, setQuery] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusLandfillId, setStatusLandfillId] = useState<string | null>(null);

  const cellRefusalOf = (key: string) =>
    editor.cellRefusal !== null && editor.cellRefusal.key === key ? editor.cellRefusal.title : null;

  const openLandfill = editor.landfills.find((landfill) => landfill.id === route.landfillId) ?? null;
  const openGroup = editor.wasteGroups.find((group) => group.id === route.wasteGroupId) ?? null;

  const refusals = (
    <>
      {/* Объяснение закрытой правки — то же, что на рабочем месте: текст
          один на оба представления, вторая копия разошлась бы (BUG-012). */}
      {editor.maintenanceRefusal !== null && (
        <AccessNotice
          refusal={editor.maintenanceRefusal}
          onRetry={() => void editor.retryMaintenance()}
        />
      )}
      {editor.loadRefusal !== null && (
        <Notice kind="error">
          {editor.loadRefusal.title}
          {editor.loadRefusal.detail ? `. ${editor.loadRefusal.detail}` : ''}
        </Notice>
      )}
    </>
  );

  if (openLandfill !== null) {
    return (
      <div className="imolt-references">
        <Button kind="tertiary" onClick={route.closeCard}>
          Назад к списку полигонов
        </Button>
        <h1 className="imolt-references-title">{openLandfill.name}</h1>
        <span className="imolt-references-card-entity">
          {openLandfill.legalEntity ?? 'юридическое лицо не указано'}
        </span>
        {refusals}

        <Card title="Тарифы утилизации за тонну" className="imolt-references-form">
          {editor.wasteGroups.map((group) => {
            const tariff = tariffOf(openLandfill, group.id);
            const key = tariffCellKey(openLandfill.id, group.id);

            return (
              <div className="imolt-references-form-row" key={group.id}>
                <span className="imolt-references-card-entity">{group.name}</span>
                <EditableCell
                  name={`Тариф утилизации, ${openLandfill.name}, ${group.name}`}
                  value={tariff === undefined ? 'не задан' : formatMoney(tariff.disposalPricePerTon)}
                  draft={tariff === undefined ? '' : tariff.disposalPricePerTon.amount}
                  disabled={!editor.editable}
                  busy={editor.saving === key}
                  refusal={cellRefusalOf(key)}
                  onStart={editor.forgetCellRefusal}
                  onSave={(text) => editor.saveTariff(openLandfill.id, group.id, text)}
                />
              </div>
            );
          })}
        </Card>

        <Card title="Статус приёма">
          <div className="imolt-references-status">
            <StatusBadge
              status={openLandfill.status}
              statusUpdatedAt={openLandfill.statusUpdatedAt}
            />
          </div>
          <ManualStatusForm
            landfills={[]}
            landfillId={openLandfill.id}
            disabled={!editor.editable}
            busy={editor.saving === `status:${openLandfill.id}`}
            refusal={cellRefusalOf(`status:${openLandfill.id}`)}
            onSave={(status, reason) => editor.saveStatus(openLandfill.id, status, reason)}
          />
        </Card>
      </div>
    );
  }

  if (openGroup !== null) {
    const key = transportCellKey(openGroup.id);

    return (
      <div className="imolt-references">
        <Button kind="tertiary" onClick={route.closeCard}>
          Назад к списку групп отходов
        </Button>
        <h1 className="imolt-references-title">{openGroup.name}</h1>
        {refusals}

        <Card className="imolt-references-form">
          <div className="imolt-references-form-row">
            <span className="imolt-references-card-entity">Цена перевозки за тонна-километр</span>
            <EditableCell
              name={`Цена перевозки, ${openGroup.name}`}
              value={formatMoney(openGroup.transportPricePerTonKm)}
              draft={openGroup.transportPricePerTonKm.amount}
              disabled={!editor.editable}
              busy={editor.saving === key}
              refusal={cellRefusalOf(key)}
              onStart={editor.forgetCellRefusal}
              onSave={(text) => editor.saveTransportPrice(openGroup.id, text)}
            />
          </div>
          <dl>
            <div>
              <dt>Коэффициент плотности, т/м³</dt>
              <dd>{formatNumber(openGroup.densityTonPerCubicMeter)}</dd>
            </div>
            <div>
              <dt>Коды каталога отходов</dt>
              <dd>
                {openGroup.fkkoCodes.length === 0
                  ? 'коды не заведены'
                  : openGroup.fkkoCodes.join(', ')}
              </dd>
            </div>
            <div>
              <dt>Актуально</dt>
              <dd>{formatDate(openGroup.updatedAt)}</dd>
            </div>
          </dl>
        </Card>
      </div>
    );
  }

  const landfills = editor.visibleLandfills(query);
  const wasteGroups = editor.visibleWasteGroups(query);

  return (
    <div className="imolt-references">
      <h1 className="imolt-references-title">Цены и справочники</h1>
      <span className="imolt-references-subtitle">
        Менеджер данных ИМОЛТ – тарифы утилизации, цены перевозки и статусы приёма
      </span>

      {editor.freshness !== null && (
        <div className="imolt-references-status">
          <DateStamp iso={editor.freshness.pricesUpdatedAt} kind="prices" />
          <DateStamp iso={editor.freshness.statusesUpdatedAt} kind="statuses" />
        </div>
      )}

      {refusals}

      <SyncRunPanel
        run={editor.syncRun}
        refusal={editor.syncRefusal}
        disabled={!editor.editable}
        onManualStatus={() => {
          setStatusLandfillId(editor.landfills[0]?.id ?? null);
          setStatusOpen(true);
        }}
      />

      {statusOpen && (
        <Sheet title="Статус полигона вручную" onClose={() => setStatusOpen(false)}>
          <ManualStatusForm
            landfills={editor.landfills}
            landfillId={statusLandfillId}
            onPickLandfill={setStatusLandfillId}
            disabled={!editor.editable}
            busy={editor.saving === `status:${statusLandfillId ?? ''}`}
            refusal={cellRefusalOf(`status:${statusLandfillId ?? ''}`)}
            onSave={(status, reason) =>
              statusLandfillId === null
                ? Promise.resolve(false)
                : editor.saveStatus(statusLandfillId, status, reason)
            }
            onDone={() => setStatusOpen(false)}
          />
        </Sheet>
      )}

      <div className="imolt-references-actions">
        <Button kind="secondary" onClick={() => setImportOpen(true)} disabled={!editor.editable}>
          Импорт из Excel
        </Button>
      </div>

      {importOpen && (
        <ImportSteps
          state={importing.state}
          disabled={!editor.editable}
          onPickKind={importing.pickKind}
          onPickFile={(file) => void importing.parse(file)}
          onApply={() => void importing.apply()}
          onRebuild={() => void importing.rebuild()}
          onClose={() => {
            importing.reset();
            setImportOpen(false);
          }}
        />
      )}

      <Tabs
        label="Справочник"
        value={route.tab}
        options={[
          { value: 'landfills' as const, label: 'Полигоны' },
          { value: 'wasteGroups' as const, label: 'Группы отходов' },
        ]}
        onPick={route.pickTab}
      />

      <Field
        id="references-query-mobile"
        label={
          route.tab === 'landfills'
            ? 'Поиск по полигону или юрлицу'
            : 'Поиск по группе или коду каталога'
        }
        value={query}
        onChange={setQuery}
      />

      {editor.loading && <Skeleton rows={4} label="Справочник загружается" />}

      {!editor.loading && route.tab === 'landfills' && (
        <div className="imolt-references-cards">
          {landfills.length === 0 && (
            <EmptyState
              title="Полигонов с таким названием или юрлицом нет"
              hint="Измените строку поиска"
            />
          )}
          {landfills.map((landfill) => (
            <LandfillCard
              key={landfill.id}
              landfill={landfill}
              wasteGroups={editor.wasteGroups}
              onOpen={() => route.openLandfill(landfill.id)}
            />
          ))}
        </div>
      )}

      {!editor.loading && route.tab === 'wasteGroups' && (
        <div className="imolt-references-cards">
          {wasteGroups.length === 0 && (
            <EmptyState
              title="Групп отходов с таким названием или кодом нет"
              hint="Измените строку поиска"
            />
          )}
          {wasteGroups.map((group) => (
            <WasteGroupCard
              key={group.id}
              group={group}
              onOpen={() => route.openWasteGroup(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Карточка полигона в списке: что известно и чем это правится. */
function LandfillCard({
  landfill,
  wasteGroups,
  onOpen,
}: {
  landfill: Landfill;
  wasteGroups: WasteGroup[];
  onOpen: () => void;
}) {
  const date = latestTariffDate(landfill);

  return (
    <article className="imolt-references-card">
      <span className="imolt-references-card-name">{landfill.name}</span>
      <span className="imolt-references-card-entity">
        {landfill.legalEntity ?? 'юридическое лицо не указано'}
      </span>
      <div className="imolt-references-status">
        <StatusBadge status={landfill.status} statusUpdatedAt={landfill.statusUpdatedAt} />
      </div>
      <dl>
        {landfill.tariffs.map((tariff) => (
          <div key={tariff.wasteGroupId}>
            <dt>
              {wasteGroups.find((group) => group.id === tariff.wasteGroupId)?.name
                ?? tariff.wasteGroupId}
            </dt>
            <dd>{formatMoney(tariff.disposalPricePerTon)}</dd>
          </div>
        ))}
      </dl>
      <span className="imolt-references-card-entity">
        {date === null ? 'тарифов нет' : `Цены актуальны на ${formatDate(date)}`}
      </span>
      <Button kind="secondary" onClick={onOpen} ariaLabel={`Править полигон: ${landfill.name}`}>
        Править
      </Button>
    </article>
  );
}

/** Карточка группы отходов в списке. */
function WasteGroupCard({ group, onOpen }: { group: WasteGroup; onOpen: () => void }) {
  return (
    <article className="imolt-references-card">
      <span className="imolt-references-card-name">{group.name}</span>
      <dl>
        <div>
          <dt>Цена перевозки за тонна-километр</dt>
          <dd>{formatMoney(group.transportPricePerTonKm)}</dd>
        </div>
        <div>
          <dt>Коэффициент плотности, т/м³</dt>
          <dd>{formatNumber(group.densityTonPerCubicMeter)}</dd>
        </div>
        <div>
          <dt>Коды каталога отходов</dt>
          <dd>{group.fkkoCodes.length === 0 ? 'коды не заведены' : group.fkkoCodes.join(', ')}</dd>
        </div>
      </dl>
      <span className="imolt-references-card-entity">
        {`Актуально на ${formatDate(group.updatedAt)}`}
      </span>
      <Button kind="secondary" onClick={onOpen} ariaLabel={`Править группу отходов: ${group.name}`}>
        Править
      </Button>
    </article>
  );
}
