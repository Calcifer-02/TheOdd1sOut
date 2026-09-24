/**
 * Публичный вход возможности «импорт справочника из книги» (R-045).
 * Подключаться к внутренним путям слайса запрещено: граница держится
 * проверкой, а не договорённостью (PRACT-012).
 *
 * @supports: R-045
 * @adr: ADR-0008
 */
export { ImportPanel, type ImportViewProps } from './ui/ImportPanel';
export { ImportSteps } from './ui/ImportSteps';
export {
  IMPORT_KINDS,
  fieldName,
  importKindName,
  useReferenceImport,
  type ImportStage,
  type ImportState,
  type ReferenceImport,
} from './model/import';
