-- Начальный набор данных ИМОЛТ: демонстрационный, а не справочный.
-- Значения взяты из канонического примера договора (набор ConcreteCalculation);
-- то, чего в договоре нет, помечено в строке словом «демонстрационное» и
-- подтверждается заказчиком: цены — вопрос Q-001, каталог ФККО — Q-015.
-- Повторное применение безвредно: on conflict do nothing оставляет уже
-- изменённые записи как есть, иначе повторный запуск затирал бы правку
-- менеджера данных.

-- Группы отходов (R-039).
insert into waste_group (id, name, transport_price_per_ton_km, density_ton_per_m3, updated_at) values
    ('beton-lom',   'Лом бетона и железобетона', 12.00, 2.0000, date '2026-09-17'),
    ('kirpich-lom', 'Лом кирпичной кладки',      14.00, 1.5000, date '2026-09-17'),
    -- Цена перевозки древесины — демонстрационное значение: договор задаёт
    -- для этой группы только коэффициент плотности 0,5.
    ('drevesina',   'Древесина от разборки',     16.00, 0.5000, date '2026-09-17')
on conflict (id) do nothing;

-- Коды каталога ФККО (R-013, R-045). У древесины кода нет намеренно:
-- код — регуляторный факт, а редакция каталога под вопросом Q-015.
-- Поиск по коду её не найдёт, и это видно, а не замаскировано.
insert into waste_group_fkko_code (waste_group_id, code) values
    ('beton-lom',   '8 22 201 01 21 5'),
    ('kirpich-lom', '8 23 101 01 21 5')
on conflict do nothing;

-- Полигоны (R-040). Координаты Икши — демонстрационное значение: договор
-- даёт для неё только название и адрес.
insert into landfill (
    id, name, legal_entity, address, latitude, longitude,
    object_kind, registered_in_ais_ossig, status, status_source, status_updated_at
) values
    ('vostok-timohovo', 'Комплекс переработки «Восток»', 'ООО «Восток»',
     'Московская обл., Богородский г. о., д. Тимохово', 55.7286, 38.2153,
     'recycling', true, 'active', 'registry', date '2026-09-17'),
    ('iksha', 'Площадка «Икша»', null,
     'Московская обл., Дмитровский г. о., пос. Икша', 56.1556, 37.4906,
     'disposal', true, 'active', 'registry', date '2026-09-17')
on conflict (id) do nothing;

-- История юрлица полигона (R-041): показывает, что смена владельца не
-- обнуляет накопленные тарифы.
insert into landfill_legal_entity_history (landfill_id, legal_entity, since, until) values
    ('vostok-timohovo', 'ООО «Тимохово»', date '2023-01-01', date '2026-02-28'),
    ('vostok-timohovo', 'ООО «Восток»',   date '2026-03-01', null)
on conflict do nothing;

-- Тарифы утилизации (R-019, R-040). Тариф Икши выведен из примера договора:
-- 7 600,00 ₽ утилизации за 20 т дают 380,00 ₽ за тонну.
insert into landfill_tariff (landfill_id, waste_group_id, disposal_price_per_ton, updated_at) values
    ('vostok-timohovo', 'beton-lom',   450.00, date '2026-09-17'),
    ('iksha',           'beton-lom',   380.00, date '2026-09-17'),
    -- Тарифы остальных пар — демонстрационные.
    ('vostok-timohovo', 'kirpich-lom', 420.00, date '2026-09-17'),
    ('vostok-timohovo', 'drevesina',   300.00, date '2026-09-17'),
    ('iksha',           'kirpich-lom', 360.00, date '2026-09-17')
on conflict (landfill_id, waste_group_id) do nothing;

-- Адресный справочник (R-012). Адрес вывоза из примера договора плюс два
-- демонстрационных адреса: один в области, чтобы зона обслуживания
-- различалась, и один — для проверки поиска.
insert into address_directory (id, value, latitude, longitude, area) values
    ('msk-godovikova-9',  'г Москва, ул Годовикова, д 9',            55.8055, 37.6206, 'moscow'),
    ('msk-godovikova-11', 'г Москва, ул Годовикова, д 11',           55.8061, 37.6229, 'moscow'),
    ('mo-balashiha-1',    'Московская обл., г Балашиха, ш Энтузиастов, д 1', 55.7963, 37.9385, 'moscowRegion')
on conflict (id) do nothing;

-- Плечо перевозки от адреса вывоза до полигонов (R-020). Значения 45 и 52 км
-- взяты из примера договора; расстояние по прямой сюда не кладётся.
insert into road_distance (from_latitude, from_longitude, landfill_id, distance_km, duration_minutes, source, obtained_at) values
    (55.80550, 37.62060, 'vostok-timohovo', 45.000, 62, 'contract-example', timestamptz '2026-09-17 12:00:00+03'),
    (55.80550, 37.62060, 'iksha',           52.000, 71, 'contract-example', timestamptz '2026-09-17 12:00:00+03')
on conflict (from_latitude, from_longitude, landfill_id) do nothing;
