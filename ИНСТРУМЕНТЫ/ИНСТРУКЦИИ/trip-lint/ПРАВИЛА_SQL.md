# Правила SQL

## Паспорт артефакта

| Версия | Дата | Автор | Обоснование |
|---|---:|---|---|
| 1.0 | 14.09.2026 | Александр Прокошев (Ведущий) | Первичное заполнение: правила движка sql по лучшим практикам миграций PostgreSQL (squawk) и собственные проверки с парой примеров на каждое; подготовка — ИИ-агент как исполнитель R |

## Назначение и область действия

Движок `sql` проверяет файлы миграций PostgreSQL (по умолчанию
`**/migrations/**/*.sql`): squawk с правилами `assets/sql/squawk.toml`
отвечает за безопасность миграции на живой базе и современные типы, свои
проверки — за имена, зарезервированные слова, `SELECT *` и имена файлов.
Источник правил — практика сообщества PostgreSQL (ADR-0005), не
корпоративный стандарт SQL 2024 года. Карточки каталога правил проекта у
этих правил нет: кандидат `DATA-00x` передан Методологу. По каталогу правило
без пары примеров не заводится, поэтому у каждого правила контрпример и
положительный пример у границы. Проект ставит `squawk-cli` в
devDependencies; без него движок сообщает «не проверяли».

## Безопасность миграции: сигнал «ошибка»

| Правило squawk | Что ловит | Контрпример (гейт обязан упасть) | Положительный пример (гейт обязан пройти) |
|---|---|---|---|
| `ban-drop-column`, `ban-drop-table`, `ban-drop-database` | удаление данных | `ALTER TABLE orders DROP COLUMN note;` | удаление отдельным решением после того, как код перестал читать столбец; пока — переименование в `note_deprecated` |
| `ban-drop-not-null` | ослабление контракта | `ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;` | ограничение остаётся; изменение модели решается на уровне домена |
| `changing-column-type` | переписывание таблицы под блокировкой | `ALTER TABLE orders ALTER COLUMN total TYPE numeric(12,2);` | новый столбец, перенос данных, переключение кода, удаление старого отдельной миграцией |
| `adding-required-field`, `adding-not-nullable-field` | обязательный столбец ломает существующие строки | `ALTER TABLE orders ADD COLUMN status text NOT NULL;` | `ADD COLUMN status text NOT NULL DEFAULT 'new'` либо два шага: добавить, заполнить, затем `SET NOT NULL` |
| `require-concurrent-index-creation`, `require-concurrent-index-deletion` | блокировка записи | `CREATE INDEX ix_orders_customer_id ON orders (customer_id);` | `CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_orders_customer_id ON orders (customer_id);` |
| `constraint-missing-not-valid`, `adding-foreign-key-constraint` | проверка всей таблицы под блокировкой | `ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id);` | то же с `NOT VALID`, затем `ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer;` |
| `disallowed-unique-constraint` | уникальность строит индекс под блокировкой | `ALTER TABLE orders ADD CONSTRAINT uq_orders_number UNIQUE (number);` | `CREATE UNIQUE INDEX CONCURRENTLY …`, затем `ADD CONSTRAINT … UNIQUE USING INDEX` |
| `ban-concurrent-index-creation-in-transaction`, `transaction-nesting` | `CONCURRENTLY` внутри транзакции | `BEGIN; CREATE INDEX CONCURRENTLY …; COMMIT;` | миграция без явной транзакции для операций `CONCURRENTLY` |
| `adding-serial-primary-key-field` | `serial` на существующей таблице переписывает её | `ALTER TABLE orders ADD COLUMN id serial PRIMARY KEY;` | `ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY` |

## Типы и форма: сигнал «предупреждение»

| Правило | Что ловит | Контрпример | Положительный пример |
|---|---|---|---|
| `prefer-timestamp-tz` | время без часового пояса | `created_at timestamp` | `created_at timestamptz NOT NULL DEFAULT now()` |
| `prefer-text-field`, `ban-char-field` | `varchar(n)` и `char(n)` | `note varchar(255)` | `note text` с ограничением `CHECK (length(note) <= 255)`, если предел нужен |
| `prefer-identity`, `prefer-bigint-over-int` | `serial` и `int` для ключей | `id serial PRIMARY KEY, customer_id int` | `id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, customer_id bigint` |
| `prefer-robust-stmts` | миграция не повторяема | `CREATE TABLE orders (…)` | `CREATE TABLE IF NOT EXISTS orders (…)` |
| `require-lock-timeout`, `require-statement-timeout` | блокирующий оператор без предела ожидания | миграция без `SET lock_timeout` | `SET lock_timeout = '5s'; SET statement_timeout = '30s';` в начале миграции |
| `adding-field-with-default` | умолчание с изменчивой функцией переписывает таблицу | `ADD COLUMN token uuid DEFAULT gen_random_uuid()` | умолчание константой либо заполнение отдельным шагом |
| `sql:trip-lint/identifier-case` | имена не в snake_case или в кавычках | `CREATE TABLE Orders ("Id" bigint, customerId bigint)` | `CREATE TABLE orders (id bigint, customer_id bigint)` |
| `sql:trip-lint/reserved-name` | столбец назван зарезервированным словом или агрегатом | `count int, "user" text, "order" int` | `count_value int, user_name text, order_number int` |
| `sql:trip-lint/select-star` | `SELECT *` в миграции или функции | `SELECT * FROM orders` | `SELECT id, customer_id FROM orders` |
| `sql:trip-lint/migration-name` | имя файла не сортируемо | `db/migrations/bad-orders.sql` | `db/migrations/003_add_orders_customer_index.sql` |

## Что исключено намеренно

| Правило | Почему | Когда перепроверить |
|---|---|---|
| `prefer-bigint-over-smallint` | `smallint` — осознанный выбор для перечислений и флагов | при появлении переполнений |
| `renaming-column`, `renaming-table` | переименование ловится ревью и КАСТОЙ, а не гейтом миграций | при первом инциденте с переименованием |

## Связанные артефакты

- `Спецификация средства` (`specification.md` — в исходном репозитории средства)
- `Запись решения ADR-0005` (`analytics/decisions/ADR-0005-sql-and-naming.md` — в исходном репозитории средства)
- `Реестр правил базы знаний` (`analytics/knowledge-base-rules.md` — в исходном репозитории средства)
