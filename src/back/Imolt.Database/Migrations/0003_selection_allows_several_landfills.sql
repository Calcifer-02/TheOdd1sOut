-- Выбор по группе отходов допускает несколько полигонов.
--
-- Начальная схема дала calculation_selection ключ (расчёт, группа), то есть
-- по группе можно было выбрать ровно один полигон. Договор допускает
-- несколько: распределение объёма между полигонами (R-030) без этого не
-- существует, и собственный пример договора выбирает по одной группе два.
-- Правка отдельной миграцией, а не заменой начальной: изменённая задним
-- числом миграция отвергается по отпечатку.

alter table calculation_selection
  drop constraint if exists calculation_selection_pkey;

alter table calculation_selection
  add primary key (calculation_id, waste_group_id, landfill_id);
