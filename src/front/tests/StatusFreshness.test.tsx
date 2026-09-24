/**
 * Состояние полигона и дата, на которую оно известно, как одна запись
 * (R-028, R-048).
 *
 * На живом стенде значок и дата стояли в ячейке таблицы двумя соседями в
 * потоке текста, и содержимое ячейки читалось как «Активенданные от 17.09»:
 * зазор между ними не задавало ни одно правило, а пробел разметки его не
 * заменяет — он пропадает на переносе и в пересказе ячейки (второй пакет
 * замечаний заказчика по живому стенду).
 *
 * Раскладку jsdom не считает, поэтому проверяется то, из чего дефект следует:
 * общая обёртка записи и объявленный ею зазор. Разделение проверок намеренное:
 * обёртка без зазора и зазор без обёртки — два разных способа вернуть дефект.
 *
 * Проверки фальсифицируемы: верните `StatusBadge` возврат фрагментом без
 * обёртки, уберите зазор или перенос у правила «.imolt-status», оставьте от
 * значка один цвет без слова и знака — они упадут.
 *
 *   npx vitest run tests/StatusFreshness.test.tsx
 *
 * Критерия приёмки на совместный показ значка и даты в реестре нет
 * (разрыв назван в отчёте), поэтому якоря обслуживающие.
 *
 * @supports: R-028
 * @supports: R-048
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STATUS_WORD, StatusBadge } from '@/entities/landfill';
import { THEME_CSS } from '@/shared/ui';
import { space } from '@/shared/ui/tokens';

/** Дата подтверждения статуса из раздела 7 дизайн-договора. */
const ДАТА_СТАТУСА = '2026-09-17';

describe('значок статуса и дата актуальности', () => {
  it('собраны в одну запись, а не стоят двумя соседями в потоке текста', () => {
    render(<StatusBadge status="active" statusUpdatedAt={ДАТА_СТАТУСА} />);

    const значок = screen.getByText(STATUS_WORD.active);
    const дата = screen.getByText(/данные от 17\.09/u);
    const запись = значок.parentElement;

    expect(запись, 'значок и дата лежат в общей обёртке записи').toHaveClass('imolt-status');
    expect(дата.parentElement, 'дата принадлежит той же записи, что и значок').toBe(запись);
  });

  it('точный момент остаётся размеченным, а не превращается в подпись', () => {
    render(<StatusBadge status="stale" statusUpdatedAt={ДАТА_СТАТУСА} />);

    const дата = screen.getByText(/данные от 17\.09/u);

    expect(дата.tagName).toBe('TIME');
    expect(дата).toHaveAttribute('datetime', ДАТА_СТАТУСА);
  });

  it('называет состояние словом и знаком, а не одним цветом', () => {
    render(<StatusBadge status="blocked" statusUpdatedAt={ДАТА_СТАТУСА} />);

    const значок = screen.getByText(STATUS_WORD.blocked);

    expect(значок).toHaveAttribute('data-status', 'blocked');
    expect(значок.querySelector('svg'), 'знак состояния рисуется рядом со словом (разд. 4.6)').not.toBeNull();
  });

  it('разведены зазором из шкалы отступов и переносятся в узком столбце', () => {
    const правило = /\n\.imolt-status \{([^}]*)\}/u.exec(THEME_CSS);

    expect(правило, 'правило «.imolt-status» объявлено в общем слое').not.toBeNull();

    const тело = правило?.[1] ?? '';

    expect(тело).toContain(`gap: ${space.xxs}px ${space.xs}px`);
    expect(тело, 'в узком столбце дата уходит на свою строку, а не под значок').toContain('flex-wrap: wrap');
  });
});
