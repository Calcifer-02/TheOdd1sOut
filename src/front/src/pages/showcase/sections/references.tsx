/**
 * Раздел витрины: компоненты редактора цен и справочников (R-084).
 *
 * Показан двухшаговый импорт справочника во всех состояниях, которые он
 * объявляет: выбор книги, разбор, расхождения, устаревший предпросмотр и
 * применение. Второй реализации здесь нет — это те же компоненты, что и на
 * экране; состояние подаётся доводом, поэтому служба не нужна.
 *
 * Значения образцов взяты из примеров договора
 * (`src/back/Imolt.Api/contracts/openapi.yaml`): цена перевозки группы
 * «Лом бетона и железобетона» 12.00 и правка на 32.00, тариф утилизации
 * полигона «Восток» 450.00 и 480.00. Своих величин витрина не придумывает.
 *
 * Правка ячейки и карточки полигона живут в слое страниц и подключению из
 * витрины не подлежат: чужой слайс того же слоя закрыт границей слоёв
 * (PRACT-012). Это названо разрывом, а не обойдено.
 *
 * @supports: R-084
 */
import { ImportPanel, ImportSteps, type ImportState } from '@/features/reference-import';
import { Section } from '../ui/Section';

/** Пустой обработчик: витрина показывает вид, а не ведёт работу. */
const NOTHING = () => undefined;

const CHANGES = [
  {
    entityId: 'beton-lom',
    field: 'transportPricePerTonKm',
    currentValue: '12.00',
    fileValue: '32.00',
  },
  {
    entityId: 'vostok-timohovo/beton-lom',
    field: 'disposalPricePerTon',
    currentValue: '450.00',
    fileValue: '480.00',
  },
];

const PREVIEW: ImportState = {
  stage: 'preview',
  kind: 'tariffs',
  fileName: 'tarify-polygony.xlsx',
  preview: {
    id: '3f8a1d92-1c44-4c8f-9c41-0b3c6f2d7a15',
    kind: 'tariffs',
    changes: CHANGES,
    rejectedRows: [
      { row: 4, reason: 'Коды каталога отходов не применяются: редакция каталога не сверена' },
    ],
  },
  result: null,
  refusal: null,
  stale: false,
};

const IDLE: ImportState = {
  stage: 'idle',
  kind: 'tariffs',
  fileName: null,
  preview: null,
  result: null,
  refusal: null,
  stale: false,
};

const STALE: ImportState = {
  ...PREVIEW,
  refusal: {
    type: 'urn:imolt:problem:stale-preview',
    title: 'Предпросмотр устарел',
    detail: 'Справочник изменился после разбора файла, разберите его заново',
    status: 409,
  },
  stale: true,
};

const APPLIED: ImportState = {
  ...PREVIEW,
  stage: 'applied',
  result: {
    id: PREVIEW.preview?.id ?? '',
    appliedChanges: 2,
    updatedAt: '2026-09-18T09:20:00+03:00',
  },
};

const DENIED: ImportState = {
  ...IDLE,
  refusal: {
    type: 'urn:imolt:problem:role-required',
    title: 'Операция доступна менеджеру данных',
    detail: 'Ведение справочников закреплено за владельцем данных: обратитесь к нему за правом',
    status: 403,
  },
};

function panel(state: ImportState, disabled = false) {
  return (
    <ImportPanel
      state={state}
      disabled={disabled}
      onPickKind={NOTHING}
      onPickFile={NOTHING}
      onApply={NOTHING}
      onRebuild={NOTHING}
      onClose={NOTHING}
    />
  );
}

export function ReferencesSection() {
  return (
    <>
      <Section title="Импорт справочника: выбор книги">
        {panel(IDLE)}
      </Section>

      <Section title="Импорт справочника: расхождения до применения">{panel(PREVIEW)}</Section>

      <Section title="Импорт справочника: предпросмотр устарел">{panel(STALE)}</Section>

      <Section title="Импорт справочника: изменения применены">{panel(APPLIED)}</Section>

      <Section title="Импорт справочника: права ведения нет">{panel(DENIED, true)}</Section>


      <Section title="Импорт справочника по шагам на телефоне">
        <ImportSteps
          state={PREVIEW}
          onPickKind={NOTHING}
          onPickFile={NOTHING}
          onApply={NOTHING}
          onRebuild={NOTHING}
          onClose={NOTHING}
        />
      </Section>
    </>
  );
}
