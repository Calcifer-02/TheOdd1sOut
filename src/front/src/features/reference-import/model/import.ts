/**
 * Двухшаговый импорт справочника из книги (R-045).
 *
 * Шага два, потому что молчаливая перезапись цен файлом не откатывается
 * взглядом: сначала служба показывает расхождения, и только подтверждение
 * их применяет. Разбор книги делает расчётная часть — интерфейс отправляет
 * файл и показывает то, что вернула служба, своего разбора у него нет.
 *
 * Предпросмотр устаревает, когда справочник изменился после разбора. Служба
 * отвечает на такое подтверждение отказом, и повторять его бессмысленно:
 * состояние ведёт к пересборке предпросмотра, а не к новой попытке.
 *
 * @req: R-045
 * @adr: ADR-0008
 */
import { useCallback, useMemo, useState } from 'react';
import { accessToken } from '@/entities/participant';
import {
  type ReferenceImportKind,
  type ReferenceImportPreview,
  type ReferenceImportResult,
  type Refusal,
  STALE_PREVIEW,
  confirmReferenceImport,
  refusalOf,
  startReferenceImport,
} from '@/shared/api/maintenance';

/**
 * Где находится импорт: закрыт, книга разбирается, расхождения показаны,
 * изменения применяются, изменения применены.
 */
export type ImportStage = 'idle' | 'parsing' | 'preview' | 'applying' | 'applied';

export type ImportState = {
  stage: ImportStage;
  kind: ReferenceImportKind;
  fileName: string | null;
  preview: ReferenceImportPreview | null;
  result: ReferenceImportResult | null;
  refusal: Refusal | null;
  /** Предпросмотр устарел: применять его нельзя, книгу надо разобрать заново. */
  stale: boolean;
};

/** Какие справочники переносятся книгой — перечень договора. */
export const IMPORT_KINDS: { value: ReferenceImportKind; label: string }[] = [
  { value: 'tariffs', label: 'Тарифы утилизации' },
  { value: 'wasteGroups', label: 'Группы отходов' },
  { value: 'landfills', label: 'Реестр полигонов' },
];

/** Имя вида справочника для экрана. */
export function importKindName(kind: ReferenceImportKind): string {
  return IMPORT_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

/**
 * Имена полей договора для экрана. Служба называет поле своим именем
 * (`transportPricePerTonKm`), а менеджер данных читает термин глоссария.
 * Незнакомое поле показывается как есть: выдуманное имя хуже технического.
 */
const FIELD_NAMES: Record<string, string> = {
  transportPricePerTonKm: 'Цена перевозки',
  disposalPricePerTon: 'Тариф утилизации',
  densityTonPerCubicMeter: 'Коэффициент плотности',
  fkkoCodes: 'Коды каталога отходов',
  name: 'Название',
  legalEntity: 'Юридическое лицо',
  address: 'Адрес',
};

export function fieldName(field: string): string {
  return FIELD_NAMES[field] ?? field;
}

const EMPTY: ImportState = {
  stage: 'idle',
  kind: 'tariffs',
  fileName: null,
  preview: null,
  result: null,
  refusal: null,
  stale: false,
};

export type ReferenceImport = {
  state: ImportState;
  pickKind(kind: ReferenceImportKind): void;
  /** Первый шаг: книга уходит на разбор, справочник не меняется. */
  parse(file: File): Promise<void>;
  /** Второй шаг: разобранные расхождения применяются. */
  apply(): Promise<void>;
  /** Собрать предпросмотр заново тем же файлом после отказа по устареванию. */
  rebuild(): Promise<void>;
  reset(): void;
};

/**
 * Состояние импорта. `onApplied` вызывается после удачного применения:
 * справочник на экране обязан показать применённое, а не прежнее.
 */
export function useReferenceImport(onApplied: () => void): ReferenceImport {
  const [state, setState] = useState<ImportState>(EMPTY);
  // Файл держится отдельно от состояния показа: он нужен для пересборки
  // предпросмотра и не участвует в отрисовке.
  const [book, setBook] = useState<File | null>(null);

  const parseBook = useCallback(async (kind: ReferenceImportKind, file: File) => {
    setBook(file);
    setState((current) => ({
      ...current,
      kind,
      stage: 'parsing',
      fileName: file.name,
      preview: null,
      result: null,
      refusal: null,
      stale: false,
    }));

    try {
      const preview = await startReferenceImport(kind, file);
      setState((current) => ({ ...current, stage: 'preview', preview }));
    } catch (error) {
      setState((current) => ({ ...current, stage: 'idle', refusal: refusalOf(error) }));
    }
  }, []);

  const parse = useCallback(
    (file: File) => parseBook(state.kind, file),
    [parseBook, state.kind],
  );

  const rebuild = useCallback(async () => {
    if (book === null) {
      return;
    }

    await parseBook(state.kind, book);
  }, [book, parseBook, state.kind]);

  const apply = useCallback(async () => {
    const preview = state.preview;

    if (preview === null) {
      return;
    }

    setState((current) => ({ ...current, stage: 'applying', refusal: null, stale: false }));

    try {
      const result = await confirmReferenceImport(preview.id);
      setState((current) => ({ ...current, stage: 'applied', result }));
      onApplied();
    } catch (error) {
      const refusal = refusalOf(error);

      // Устаревший предпросмотр остаётся на экране, но применить его уже
      // нельзя: следующий шаг — разобрать книгу заново, а не повторить.
      setState((current) => ({
        ...current,
        stage: 'preview',
        refusal,
        stale: refusal.type === STALE_PREVIEW,
      }));
    }
  }, [onApplied, state.preview]);

  const pickKind = useCallback((kind: ReferenceImportKind) => {
    setState((current) => ({ ...current, kind }));
  }, []);

  const reset = useCallback(() => {
    setBook(null);
    setState(EMPTY);
  }, []);

  return useMemo(
    () => ({ state, pickKind, parse, apply, rebuild, reset }),
    [state, pickKind, parse, apply, rebuild, reset],
  );
}
