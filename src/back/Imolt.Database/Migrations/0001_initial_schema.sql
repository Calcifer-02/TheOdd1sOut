-- Начальная схема базы данных ИМОЛТ.
-- Состав сущностей и их поля — инженерная модель, СУЩ-01 — СУЩ-15.
-- Схема общая с будущей службой сбора (КНТ-02, ADR-0002), поэтому читается
-- глазами и меняется двумя единицами совместно.
-- Денежные величины numeric(12,2): двоичная дробь округляет рубли по дороге.
-- Перечисления заданы CHECK, а не ENUM: добавление значения в ENUM нельзя
-- откатить внутри транзакции, и миграция перестаёт быть отменяемой.

-- СУЩ-01. Группа отходов: единица справочника проекта с общей ценой
-- перевозки и общим коэффициентом плотности (R-013, R-017, R-039, R-043).
create table if not exists waste_group (
    id                        text            primary key,
    name                      text            not null,
    -- Цена перевозки живёт только здесь, за тонна-километр; в расчёте она
    -- умножается на километраж (R-043). Второго места хранения нет.
    transport_price_per_ton_km numeric(12, 2) not null check (transport_price_per_ton_km > 0),
    density_ton_per_m3        numeric(10, 4)  not null check (density_ton_per_m3 > 0),
    updated_at                date            not null
);

-- СУЩ-01. Коды каталога ФККО, отнесённые к группе: поиск по коду — часть
-- выбора типа отходов (R-013, R-045).
create table if not exists waste_group_fkko_code (
    waste_group_id text not null references waste_group (id) on delete cascade,
    code           text not null,
    primary key (waste_group_id, code)
);

-- СУЩ-02. Полигон: точка приёма отходов (R-004, R-028, R-040, R-044, R-046).
-- Координаты обязательны: без них не считается плечо перевозки.
create table if not exists landfill (
    id                              text           primary key,
    name                            text           not null,
    legal_entity                    text,
    address                         text           not null,
    latitude                        double precision not null check (latitude between -90 and 90),
    longitude                       double precision not null check (longitude between -180 and 180),
    -- Вид объекта и суточный лимит приёма требует R-040; наружу договором
    -- версии 1 они не отдаются, но храним, иначе требование нечем закрыть.
    object_kind                     text           check (object_kind in ('processing', 'recycling', 'disposal')),
    daily_intake_limit_tons         numeric(12, 3) check (daily_intake_limit_tons >= 0),
    registered_in_ais_ossig         boolean,
    has_electronic_ticket_agreement boolean,
    -- «unconfirmed» означает, что сообщение источника не распознано и вручную
    -- не подтверждено: это не «активен» и не «заблокирован» (R-044).
    status                          text           not null check (status in ('active', 'blocked', 'unconfirmed')),
    status_reason                   text,
    status_source                   text           not null default 'manual' check (status_source in ('telegram', 'manual', 'registry')),
    status_updated_at               date           not null
);

-- СУЩ-02. История смены юрлица: смена владельца не должна обнулять
-- накопленные тарифы и статусы (R-041).
create table if not exists landfill_legal_entity_history (
    landfill_id  text not null references landfill (id) on delete cascade,
    legal_entity text not null,
    since        date not null,
    until        date,
    primary key (landfill_id, since),
    check (until is null or until >= since)
);

-- СУЩ-03. Тариф утилизации: ячейка таблицы «полигон и группа отходов»
-- (R-019, R-040, R-042, R-048).
create table if not exists landfill_tariff (
    landfill_id             text           not null references landfill (id) on delete cascade,
    waste_group_id          text           not null references waste_group (id) on delete cascade,
    disposal_price_per_ton  numeric(12, 2) not null check (disposal_price_per_ton >= 0),
    updated_at              date           not null,
    primary key (landfill_id, waste_group_id)
);

create index if not exists landfill_tariff_waste_group_idx on landfill_tariff (waste_group_id);

-- СУЩ-13. Участник: перевозчик, демонтажная компания или менеджер данных.
-- Личность даёт платформа MAX, поэтому паролей и кодов входа здесь нет и
-- быть не должно (ADR-0006, инвариант 1).
create table if not exists subscriber (
    id                       uuid           primary key,
    max_user_id              text           not null unique,
    display_name             text,
    role                     text           check (role in ('carrier', 'demolitionCompany')),
    company_name             text,
    inn                      text           check (inn ~ '^[0-9]{10}$' or inn ~ '^[0-9]{12}$'),
    phone                    text,
    registered_in_ais_ossig  boolean,
    has_transport_license    boolean,
    has_sez                  boolean,
    subscription_state       text           not null default 'none' check (subscription_state in ('none', 'pending', 'active')),
    subscription_active_until date,
    created_at               timestamptz    not null
);

-- СУЩ-13. Заявка на подписку: оплата идёт вне сервиса, поэтому состояние
-- «pending» — нормальный исход, а не ошибка (R-008, R-049).
create table if not exists subscription_request (
    id            uuid        primary key,
    subscriber_id uuid        not null references subscriber (id) on delete cascade,
    role          text        not null check (role in ('carrier', 'demolitionCompany')),
    company_name  text        not null,
    inn           text        not null,
    registered_in_ais_ossig boolean,
    created_at    timestamptz not null,
    state         text        not null check (state in ('none', 'pending', 'active'))
);

-- СУЩ-04. Оценка полигона: обратная связь о достоверности сведений, а не о
-- качестве услуги (R-031).
create table if not exists landfill_review (
    id            uuid        primary key,
    landfill_id   text        not null references landfill (id) on delete cascade,
    subscriber_id uuid        references subscriber (id) on delete set null,
    rating        smallint    not null check (rating between 1 and 5),
    text          text        check (length(text) <= 2000),
    created_at    timestamptz not null
);

create index if not exists landfill_review_landfill_idx on landfill_review (landfill_id);

-- СУЩ-05. Адресный справочник Москвы и области: расчёт опирается на
-- координаты, а не на набранную строку (R-012).
create table if not exists address_directory (
    id        text             primary key,
    value     text             not null,
    latitude  double precision not null,
    longitude double precision not null,
    area      text             not null check (area in ('moscow', 'moscowRegion'))
);

-- СУЩ-06. Плечо перевозки по автомобильной дорожной сети. Расстояние по
-- прямой сюда не кладётся: оно занижает результат (R-020).
-- Ключ округляет координаты до пяти знаков — иначе повторный расчёт с того же
-- адреса промахивается мимо сохранённого значения из-за последнего разряда.
create table if not exists road_distance (
    from_latitude    numeric(9, 5)  not null,
    from_longitude   numeric(9, 5)  not null,
    landfill_id      text           not null references landfill (id) on delete cascade,
    distance_km      numeric(9, 3)  not null check (distance_km >= 0),
    duration_minutes integer        check (duration_minutes >= 0),
    source           text           not null,
    obtained_at      timestamptz    not null,
    primary key (from_latitude, from_longitude, landfill_id)
);

-- СУЩ-11. Сезонные и суточные коэффициенты цены перевозки (R-022).
-- Наружу не отдаются: коэффициенты скрыты в серверной части (R-058).
create table if not exists transport_coefficient (
    id         smallint      primary key,
    kind       text          not null check (kind in ('seasonal', 'daily')),
    valid_from date,
    valid_to   date,
    hour_from  smallint      check (hour_from between 0 and 23),
    hour_to    smallint      check (hour_to between 0 and 23),
    factor     numeric(6, 3) not null check (factor > 0)
);

-- СУЩ-07. Расчёт: сохранённый запрос вместе с условиями, на которых он
-- посчитан. Даты актуальности данных закрепляются здесь, а не берутся
-- заново при чтении: иначе старый расчёт молча меняет смысл (R-048).
create table if not exists calculation (
    id                  uuid             primary key,
    created_at          timestamptz      not null,
    pickup_value        text             not null,
    pickup_latitude     double precision not null,
    pickup_longitude    double precision not null,
    pickup_area         text             not null check (pickup_area in ('moscow', 'moscowRegion')),
    pickup_suggestion_id text,
    disposal_required   boolean          not null default true,
    distance_mode       text             not null default 'atMost' check (distance_mode in ('atMost', 'atLeast')),
    distance_km         integer          not null default 50 check (distance_km between 0 and 1000),
    prices_updated_at   date             not null,
    statuses_updated_at date             not null,
    -- Расчёт доступен гостю, поэтому владелец необязателен (R-050).
    subscriber_id       uuid             references subscriber (id) on delete set null
);

create index if not exists calculation_subscriber_idx on calculation (subscriber_id, created_at desc);

-- СУЩ-07. Позиция расчёта: введённый объём и мера, в которой считается
-- стоимость (R-014, R-015).
create table if not exists calculation_item (
    calculation_id uuid           not null references calculation (id) on delete cascade,
    waste_group_id text           not null references waste_group (id),
    input_value    numeric(12, 3) not null check (input_value > 0),
    input_unit     text           not null check (input_unit in ('t', 'm3')),
    tons           numeric(12, 3) not null check (tons > 0),
    primary key (calculation_id, waste_group_id)
);

-- СУЩ-07. Выбор полигонов по группам: выбор задаётся целиком, пустой набор
-- снимает выбор (R-027, R-032).
create table if not exists calculation_selection (
    calculation_id uuid not null references calculation (id) on delete cascade,
    waste_group_id text not null references waste_group (id),
    landfill_id    text not null references landfill (id),
    primary key (calculation_id, waste_group_id)
);

-- СУЩ-07. Распределение объёма группы между несколькими полигонами (R-030).
-- Совпадение суммы частей с объёмом группы проверяется сценарием: в схеме
-- такое правило выразить нечем, и молчаливое частичное применение хуже отказа.
create table if not exists calculation_allocation (
    calculation_id uuid           not null references calculation (id) on delete cascade,
    waste_group_id text           not null references waste_group (id),
    landfill_id    text           not null references landfill (id),
    value          numeric(12, 3) not null check (value > 0),
    unit           text           not null check (unit in ('t', 'm3')),
    primary key (calculation_id, waste_group_id, landfill_id)
);

-- СУЩ-08. Коммерческое предложение. Номер выпускается один раз: повторное
-- скачивание не должно порождать второе предложение с другой ценой (R-036).
create table if not exists quote (
    id            uuid           primary key,
    calculation_id uuid          not null references calculation (id) on delete cascade,
    number        text           not null unique,
    issued_at     timestamptz    not null,
    -- Срок действия не назначается, пока заказчик не ответил на Q-010.
    valid_until   date,
    total         numeric(12, 2) not null check (total >= 0),
    customer_name text,
    comment       text
);

-- СУЩ-08. Снимок цен на момент выпуска: справочник потом изменится, а
-- выпущенный документ обязан остаться прежним (R-037, R-038).
create table if not exists quote_line (
    quote_id       uuid           not null references quote (id) on delete cascade,
    landfill_id    text           not null,
    waste_group_id text           not null,
    tons           numeric(12, 3) not null,
    transport_cost numeric(12, 2) not null,
    disposal_cost  numeric(12, 2),
    total_cost     numeric(12, 2) not null,
    primary key (quote_id, landfill_id, waste_group_id)
);

-- СУЩ-09. Заявка на вывоз: обращение клиента к менеджеру ИМОЛТ (R-053).
-- Согласие на обработку персональных данных обязательно и проверяется
-- сервером, а не только формой (R-054).
create table if not exists pickup_request (
    id                    uuid        primary key,
    calculation_id        uuid        references calculation (id) on delete set null,
    landfill_id           text        references landfill (id) on delete set null,
    contact_name          text        not null check (length(contact_name) between 1 and 200),
    phone                 text        not null check (phone ~ '^\+7[0-9]{10}$'),
    personal_data_consent boolean     not null check (personal_data_consent),
    created_at            timestamptz not null,
    state                 text        not null check (state in ('accepted'))
);

-- СУЩ-10. Каталог услуг по документации (R-052). Состав каталога не
-- утверждён заказчиком — открытый вопрос Q-005.
create table if not exists document_service (
    id               text           primary key,
    name             text           not null,
    price_from       numeric(12, 2) check (price_from >= 0),
    price_on_request boolean        not null default true,
    -- Либо названа цена «от», либо услуга считается по запросу: пустая
    -- карточка без цены и без признака ничего не сообщает клиенту.
    check (price_on_request or price_from is not null)
);

-- СУЩ-10. Заказ услуги по документации (R-009, R-054).
create table if not exists document_service_order (
    id                    uuid        primary key,
    service_id            text        not null references document_service (id),
    subscriber_id         uuid        not null references subscriber (id) on delete cascade,
    object_address        text        not null,
    comment               text,
    personal_data_consent boolean     not null check (personal_data_consent),
    created_at            timestamptz not null,
    state                 text        not null check (state in ('accepted'))
);

-- СУЩ-12. Прогон сбора справочных данных (R-044, R-046, R-048).
-- Отказ источника — это отметка «данные не обновлены», а не отказ
-- обслуживания (ADR-0002, инвариант 5).
create table if not exists sync_run (
    id                  uuid        primary key,
    started_at          timestamptz not null,
    finished_at         timestamptz,
    source              text        not null check (source in ('telegram', 'file', 'registry')),
    outcome             text        not null check (outcome in ('succeeded', 'partial', 'failed')),
    recognized_messages integer     not null default 0 check (recognized_messages >= 0),
    updated_landfills   integer     not null default 0 check (updated_landfills >= 0),
    failure_reason      text
);

create index if not exists sync_run_started_idx on sync_run (started_at desc);

-- СУЩ-14. Импорт справочника: предпросмотр расхождений и его применение
-- разделены, и между ними справочник мог измениться (R-045).
-- Отпечаток источника ловит именно этот случай: применять устаревший
-- предпросмотр нельзя.
create table if not exists reference_import (
    id                  uuid        primary key,
    kind                text        not null check (kind in ('wasteGroups', 'landfills', 'tariffs')),
    uploaded_at         timestamptz not null,
    preview             jsonb       not null,
    source_snapshot_hash text       not null,
    applied_at          timestamptz,
    applied_changes     integer     check (applied_changes >= 0)
);
