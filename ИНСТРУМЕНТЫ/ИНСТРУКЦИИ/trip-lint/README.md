# trip-lint

**trip-lint** — линтер кода стандартного стека TRIP (C# .NET, Vue 3 с
TypeScript, PostgreSQL). Средство слоя B экосистемы TRIP: исполнитель задачи
B-424 «Запуск проверок и отчёт» эпика EB-38 «Сканер правил проекта». Оно
запускает движки стека, сводит их вывод в один отчёт `trip.lint-report/v1`,
применяет уровень, сигнал, режим и рассрочку по каталогу правил проекта и
отдаёт коды выхода TRIP.

Средство поставляет корпоративные пресеты движков — `@trip/eslint-config`,
`@trip/eslint-plugin`, `@trip/prettier-config` — и ядро правил комментариев
`@trip/comment-rules`, одно на три языка стека. Владение разделено с соседями:
форму кода (домен `ARCH`) держит КАСТА, полноту трассы — TRIP Trace Service,
Git-след — trip-cli, документы — trip-doc-lint. trip-lint занимает то, что
между ними: стиль и конструкции внутри файла, комментарии, идиомы Vue, стековые
команды для правил каталога и сведение чужих линтеров в один отчёт.

## Состояние

Волна 1 — сделано: агрегатор с движками `eslint`, `prettier`, `lockfile`,
`file-names`, `comments`; пресеты ESLint и Prettier для Vue 3 и TypeScript
(общие правила фронтенда, корпоративная специфика оформления выводится по
итогам пилота); правило имён тестов `TEST-001`; двенадцать правил
комментариев для TypeScript, JavaScript, Vue, C# и SQL с двумя исполнителями
(плагин ESLint и встроенный движок); сопоставление находок с каталогом правил
проекта (`REPO-001`, `REPO-002`, `TEST-001`, `TEST-002`, `DEP-001`, `SEC-001`);
режимы `observe`, `changed`, `enforce`; рассрочка долга `trip.lint-baseline/v1`
со строкой реестра долга на каждую запись; сигнал для оценщика коммитов
`trip.lint-signal/v1`; манифест единого входа `trip.tool-manifest/v1`; контур
выпуска generic-пакетом и публикация пресетов в реестр npm; девяносто три
зелёные автопроверки и самопроверка собственного корпуса.

Волна 2 — сделано: пакет NuGet `Trip.CodeStyle` двумя слоями (дисциплина
без корпоративного стандарта, стиль после него); движок `dotnet` — сборка
решения с журналом SARIF на каждый проект, `dotnet format whitespace`
(`REPO-001`), имена тестов (`TEST-001`), `packages.lock.json` (`DEP-001`),
обоснование подавлений, подключение пакета; выпуск NuGet ручной ступенью;
пилот на копии backend apg-project без ложных срабатываний. Состав правил —
`docs/dotnet-discipline.md`.

Волна 2.1 — сделано: правила подстроены под корпоративную базу знаний:
слой стиля C# (`trip.style.globalconfig`, корпоративный `.editorconfig` в
редакции trip-lint с `lf`), имена тестов `Given_…_When_…_Then_…` и разметка
Arrange, Act, Assert, Prettier и ESLint по стандарту фронтенда (`any`,
вложенные тернарники, именование, суффикс `Async`), точные версии, имена
файлов и признаки секретов по корпоративным наборам. Реестр правил базы с
источниками и состоянием — `docs/analytics/knowledge-base-rules.md`;
противоречия базы переданы владельцу вопросами Q-014…Q-017.

Волна 3 — сделано: движок `sql` по лучшим практикам PostgreSQL (squawk с
курируемыми правилами, свои проверки имён и `SELECT *`), именование C# и
TypeScript по мировой практике (ADR-0005). Волна 4 — интеграция: `trip verify --lint`, перехват
коммита, чтение сигнала оценщиком коммитов, гейт в шаблоне проекта.

## Что зависит не от нас

- Правила каталога проекта заводит Методолог. Кандидаты из правил комментариев
  (TODO с владельцем и сроком, закомментированный код, язык, даты, ссылки,
  инструкции для агента) переданы вопросами в `docs/analytics/open-questions.md`;
  до решения их находки идут в отчёт без идентификатора каталога.
- Разрешение якорей трассы в реестрах выполняется тем же способом, что у
  trip-cli для сообщений коммитов (`trip.json`, ключ `message.registry`);
  полноту следа и покрытие считает TRIP Trace Service.
- Реестр GitLab `TRIP/tooling/trip-lint`, замок средств шаблона проекта и волна
  хаба выпусков заполняются владельцем после первого выпуска.

## Быстрый старт

```bash
git clone https://git-internal.imbalanced.tech/TRIP/tooling/trip-lint.git
cd trip-lint && npm ci && npm run verify
node bin/trip-lint.mjs --version
```

Подключение к проекту:

```bash
trip-lint init --root . --frontend frontend --write   # .trip-lint.toml, eslint.config.js, .prettierrc.json
cd frontend && npm i -D eslint@10.10.0 prettier@3.9.6 @trip/eslint-config@0.1.0 @trip/prettier-config@0.1.0
trip-lint check --root . --mode observe               # исходный уровень без остановки работы
trip-lint check --root . --write-baseline --owner Ведущий --until 31.12.2026
trip-lint check --root .                              # режим из [gate].mode; в changed блокирует только изменённое
```

Коды выхода: `0` чисто, `2` только предупреждения, `3` находка-ошибка,
`1` не проверили — движок не запустился, конфигурация негодна, рассрочка без
строки реестра долга. Код `1` не подменяется кодом `0` ни в одном режиме.

Команды: `check`, `rules`, `explain <REPO-001 | trip/comment-language>`,
`init`. Отчёт пишется в `.trip/lint-report.json`; сигнал — по ключу
`--signal`.

## Конфигурация проекта

```toml
schema = "trip.lint-config/v1"

[frontend]
root = "frontend"            # каталог с package.json, eslint.config.js и настройками Prettier
# enabled = false            # служба без интерфейса — с причиной: reason = "…"

[gate]
mode = "changed"             # observe | changed | enforce
raised_to_error = ["TEST-001"]

[baseline]
file = "trip/lint-baseline.json"

[comments]
exclude = ["src/generated/**"]
terms = ["order", "workflow"]   # слова глоссария проекта латиницей
max_lines = 8
```

Ключей «выключить правило» нет намеренно: понижение сигнала есть отступление,
а не настройка. Проект вправе только повысить сигнал (`raised_to_error`) и
уточнить словари и пределы правил комментариев.

## Главные артефакты

- `docs/specification.md` — спецификация средства: позиционирование, модель,
  контракты, волны.
- `docs/comment-standard.md` — стандарт комментариев в коде: что в них должно
  быть, чего не должно, двенадцать правил с примерами.
- `docs/stack-overlay.md` — надстройка стека стандартного стека: правило
  каталога → команда → где запускается → состояние.
- `docs/user-guide.md` — руководство пользователя.
- `contracts/` — схемы `trip.lint-config/v1`, `trip.lint-report/v1`,
  `trip.lint-signal/v1`, `trip.lint-baseline/v1`.
- `packages/` — `comment-rules`, `eslint-plugin`, `eslint-config`,
  `prettier-config`.
- `pilot/` — протокол и отчёты пилотов на корпусах apg-project и tuzic.
- `docs/rollout/` — заготовки для внедрения: гейт конвейера шаблона проекта,
  запись замка средств, порядок выпуска через хаб.

## Связи

- Каталог правил проекта и надстройка стека — методология TRIP
  (`МЕТОДОЛОГИЯ/05_АНКЕТЫ_И_КАТАЛОГИ/КАТАЛОГ_ПРАВИЛ_ПРОЕКТА.md`,
  `МЕТОДОЛОГИЯ/08_БИБЛИОТЕКА_ЗАГОТОВОК/ПАМЯТЬ_ПРОЕКТА/НАДСТРОЙКА_СТЕКА.md`).
- Соседние средства: КАСТА (`trip-cast`), TRIP Trace Service, trip-cli,
  trip-doc-lint, TRIP Reviewer.
