/**
 * Доводы представления редактора. Оба представления — таблица рабочего
 * места и карточки телефона — получают одно и то же состояние: различаются
 * они разметкой, а не правилами (ADR-0008).
 *
 * @supports: R-042
 * @adr: ADR-0008
 */
import type { ReferenceImport } from '@/features/reference-import';
import type { ReferenceEditor } from '../model/editor';
import type { EditorRoute } from '../model/route';

export type ReferencesViewProps = {
  editor: ReferenceEditor;
  route: EditorRoute;
  importing: ReferenceImport;
};
