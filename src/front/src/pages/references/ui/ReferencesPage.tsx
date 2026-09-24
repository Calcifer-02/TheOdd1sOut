/**
 * Экран редактора цен и справочников для менеджера данных (Э-11): весь путь
 * от прайса до достоверного расчёта — правка тарифа, ручной статус полигона
 * и двухшаговый импорт книги (UC-005, UC-006).
 *
 * Представлений два: на рабочем месте — таблица «полигон × группа отходов»,
 * на телефоне — карточки и правка отдельным экраном. Выбор делает код по
 * ширине окна, а не правило `display: none`: вторая ветка иначе осталась бы
 * в дереве доступности. Предметная часть у представлений общая
 * (`model/editor.ts`), различаются они только разметкой.
 *
 * @req: R-039, R-040, R-042, R-043, R-044, R-045, R-048
 * @adr: ADR-0008
 */
import { useReferenceImport } from '@/features/reference-import';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { useReferenceEditor } from '../model/editor';
import { useEditorRoute } from '../model/route';
import { ReferencesDesktop } from './ReferencesDesktop';
import { ReferencesMobile } from './ReferencesMobile';

export function ReferencesPage() {
  const editor = useReferenceEditor();
  const route = useEditorRoute();
  // Применённый импорт меняет справочник, и экран обязан показать
  // применённое, а не прежнее: перечитывание идёт тем же путём, что и
  // первая загрузка (R-045).
  const importing = useReferenceImport(editor.reload);
  const viewport = useViewport();

  return isWide(viewport) ? (
    <ReferencesDesktop editor={editor} route={route} importing={importing} />
  ) : (
    <ReferencesMobile editor={editor} route={route} importing={importing} />
  );
}
