#!/usr/bin/env node
// Актуализация оснастки проекта до текущего состояния шаблона TRIP.
//
// Проект создаётся из шаблона копией, и дальше они расходятся: шаблон получает
// исправления, а проект о них не узнаёт. Скрипт переносит ровно те изменения,
// владельцем которых остаётся шаблон, — гейты, правила исключений, проверку
// скелета и ходунки средств. Содержание проекта не трогается.
//
//   node ИНСТРУМЕНТЫ/скрипты/обновить-оснастку.mjs            применить
//   node ИНСТРУМЕНТЫ/скрипты/обновить-оснастку.mjs --проверить только отчёт
//   node ИНСТРУМЕНТЫ/скрипты/обновить-оснастку.mjs --корень <путь>
//
// Скрипт ничего не коммитит. Фиксация — решение человека: часть изменений
// затрагивает методологию (`trip.json`, `trip/`) и требует политики
// `policies-only`, часть — обычной `generic`, и смешивать их в одном коммите
// нельзя. В конце печатается предлагаемый порядок.
//
// Каждое обновление идемпотентно и умеет ответить, применено ли оно: повторный
// запуск безопасен и ничего не дублирует. Режим `--проверить` ничего не пишет и
// отвечает кодом возврата — годится для гейта.

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const аргументы = process.argv.slice(2);
const толькоПроверка = аргументы.includes('--проверить');
const индексКорня = аргументы.indexOf('--корень');
const КОРЕНЬ = resolve(индексКорня >= 0 ? аргументы[индексКорня + 1] : process.cwd());

// ── содержимое, владельцем которого остаётся шаблон ──────────────────────────

const ГЕЙТ_СЛЕДА = `# Гейт Git-следа.
#
# Проверяет то, ради чего в проекте стоит trip-cli: имя ветки, сообщения
# коммитов запроса на слияние, запись в журнале изменений и вклеенные заплатки
# автосжатия.
#
# Почему это здесь, а не только в хуках. Хук — ранняя остановка на машине
# автора: он делает правильный путь дешёвым, но снимается одной командой и
# не ставится вовсе, если участник пропустил \`trip init\`. Барьер, на который
# можно ссылаться, живёт в конвейере — его проходят все и всегда.
#
# \`--require-policy\` объявляет запуск подтверждающим: отсутствие trip.json,
# недоступная база сравнения и отсоединённый HEAD становятся отказом, а не
# молчаливым нулём. Зелёное задание, которое ничего не проверило, хуже
# отсутствующего — оно выдаёт пробел за пройденную проверку.
#
# GIT_DEPTH: 0 обязателен: сравнение с базовой веткой невыполнимо на
# поверхностном клоне, и подтверждающий запуск об этом честно скажет отказом.

след:проверка:
  stage: проверка
  image: $NODE_IMAGE
  variables:
    GIT_DEPTH: 0
  before_script:
    # В slim-образе node git отсутствует: клонирование выполняет образ-помощник
    # раннера, поэтому рабочая копия на месте, а команды git в задании нет.
    # Гейту git незаменим: и дотаскивание базовой ветки, и разбор следа
    # диапазона внутри trip verify делаются через него.
    #
    # ca-certificates ставится вместе с git и по той же причине: в slim-образе
    # корневых сертификатов нет, и \`git fetch\` по https падает с «server
    # certificate verification failed. CAfile: none». Отказ выглядит как
    # недоступность сервера, хотя недоступен он только этому образу.
    #
    # libicu — третья причина того же рода. \`trip\` собран самодостаточным
    # файлом .NET, но глобализацию .NET берёт из системной ICU, которой в
    # slim-образе нет: запуск падает не ошибкой средства, а обрывом процесса
    # «Couldn't find a valid ICU package». Имя пакета привязано к базе образа:
    # bookworm — libicu72, при смене базы его придётся поднять.
    - apt-get update -qq && apt-get install -y -qq --no-install-recommends git ca-certificates libicu72
  script:
    - node ИНСТРУМЕНТЫ/скрипты/инструменты.mjs установить trip-cli
    - TRIP=$(find .trip/tools/trip-cli -type f -name 'trip' | head -n 1)
    - test -n "$TRIP" || { echo "В выпуске не найден исполняемый файл trip"; exit 1; }
    - chmod +x "$TRIP"
    - TARGET="$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - git fetch --no-tags --quiet origin "+refs/heads/$TARGET:refs/remotes/origin/$TARGET"
    - BASE="origin/$TARGET"
    # Имя ветки, сообщение каждого коммита диапазона, журнал изменений и
    # заплатки — одной командой. Имя ветки trip восстанавливает из
    # CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: рабочая копия здесь с отсоединённым
    # HEAD. Слияния при разборе сообщений пропускаются: их заголовок сочиняет
    # git, а не автор.
    #
    # \`--messages\` появился в trip-cli 0.5.2 (R-092); версия закреплена замком
    # средств, поэтому гейт и ходунки поднимаются одним изменением.
    - '"$TRIP" verify --branch --messages --changelog --require-changelog --fixups --require-policy --base "$BASE"'
  rules:
    - if: '$TRIP_TOOLS_TOKEN && $CI_PIPELINE_SOURCE == "merge_request_event"'

след:не настроен:
  stage: проверка
  image: $NODE_IMAGE
  allow_failure: true
  script:
    - 'echo "Гейт Git-следа не настроен: нет TRIP_TOOLS_TOKEN."'
    - 'echo "Пока переменная не дошла до задания, соблюдение правил ветки и коммита ничем не подтверждено."'
    - |
      echo "Ветка: $CI_COMMIT_REF_NAME; защищена: \${CI_COMMIT_REF_PROTECTED:-false}"
      if [ "\${CI_COMMIT_REF_PROTECTED:-false}" != "true" ]; then
        echo "Ветка не защищена, поэтому переменная с флагом Protected сюда не приходит по построению."
        echo "Если переменная задана — снимите у неё Protected либо защитите ветку."
      else
        echo "Ветка защищена, значит дело не в Protected. Проверьте область видимости переменной"
        echo "(Environments должно быть *) и уровень: группа проектов или сам проект."
      fi
      echo "Проверить, что задание её видит: пайплайн должен быть запущен ПОСЛЕ сохранения переменной."
    - 'echo "Порядок настройки — ИНСТРУМЕНТЫ/README.md, раздел «Доступ без личных учётных записей»."'
    - exit 1
  rules:
    - if: '$TRIP_TOOLS_TOKEN'
      when: never
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
`;

const ЗАМКИ_ОФИСА = `
# Замки открытых документов офисных пакетов. LibreOffice и Word кладут их
# рядом с самим документом, поэтому первый же «git add .» уносит их в
# коммит вместе с материалами заказчика.
.~lock.*#
~$*
`;

const ОГОВОРКА_ГЕЙТА = `#
# Гейт следа исключение: он роняет запрос на слияние с первого дня и не ждёт
# TRIP_GATE_STRICT. Правила ветки и коммита не калибруются по ходу проекта, а
# след, снятый задним числом, уже не восстанавливается.`;

const ГЕЙТ_ЛИНТЕРА = `# Гейт линтера кода стандартного стека (trip-lint).
#
# Запускает движки стека — ESLint и Prettier фронтенда, анализаторы .NET,
# squawk для миграций PostgreSQL, встроенные проверки имён файлов, зависимостей
# и комментариев — и сводит их в один отчёт с кодами выхода TRIP. Движки
# ставятся в проекте: конвейер читает ту же конфигурацию, что и редактор автора.
#
# Задание запускается, только когда объявлен .trip-lint.toml: без него нечего
# проверять, и молчаливое «зелено» было бы неправдой. Пока конфигурации нет,
# работает задание «линтер кода:не объявлен» — оно сообщает пробел, а не выдаёт
# его за пройденную проверку.
#
# Образ — SDK .NET с установкой Node.js: стандартный стек несёт обе части, а
# движок без среды исполнения отвечает «не проверяли» (код 1). Проект без .NET
# задаёт TRIP_LINT_IMAGE: node:22-bookworm-slim на группе или в проекте.
#
# Коды выхода средства: 0 — чисто; 2 — только предупреждения; 3 — находка-ошибка;
# 1 — не проверили: движок не запустился, конфигурация негодна.
#
# TRIP_GATE_STRICT=1 переводит предупреждения в отказ. До этого предупреждения
# видны в журнале задания и не роняют сборку: исходный уровень снимается на
# корпусе проекта, а долг закрывается рассрочкой, а не выключением проверки.

линтер кода:
  stage: проверка
  image: $TRIP_LINT_IMAGE
  variables:
    GIT_DEPTH: 0
    TRIP_LINT_IMAGE: "mcr.microsoft.com/dotnet/sdk:10.0"
    TRIP_LINT_NODE_VERSION: "22.23.2"
  script:
    - |
      if ! command -v node >/dev/null 2>&1; then
        curl -fsSL "https://nodejs.org/dist/v\${TRIP_LINT_NODE_VERSION}/node-v\${TRIP_LINT_NODE_VERSION}-linux-x64.tar.gz" | tar -xz -C /usr/local --strip-components=1
      fi
      node --version
    - node ИНСТРУМЕНТЫ/скрипты/инструменты.mjs установить trip-lint
    - test -f .trip/tools/trip-lint/bin/trip-lint.mjs || { echo "В выпуске не найден вход trip-lint"; exit 1; }
    - |
      # Движки ставятся в проекте: зависимости фронтенда и squawk-cli лежат в его package-lock.json.
      FRONT=$(awk -F'"' '$0=="[frontend]"{s=1;next} substr($0,1,1)=="["{s=0} s && index($0,"root")==1{print $2;exit}' .trip-lint.toml)
      for dir in "." "\${FRONT:-.}"; do
        if [ -f "$dir/package-lock.json" ] && [ ! -d "$dir/node_modules" ]; then
          npm --prefix "$dir" ci --no-audit --fund=false
        fi
      done
    - |
      # База сравнения для режима changed: целевая ветка запроса на слияние либо предыдущий коммит ветки.
      BASE=""
      if [ -n "\${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:-}" ]; then
        git fetch --quiet origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
        BASE="origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
      elif [ -n "\${CI_COMMIT_BEFORE_SHA:-}" ] && [ "$CI_COMMIT_BEFORE_SHA" != "0000000000000000000000000000000000000000" ]; then
        BASE="$CI_COMMIT_BEFORE_SHA"
      fi
      set +e
      if [ -n "$BASE" ]; then
        node .trip/tools/trip-lint/bin/trip-lint.mjs check --root . --base "$BASE"
      else
        node .trip/tools/trip-lint/bin/trip-lint.mjs check --root .
      fi
      code=$?
      set -e
      echo "код завершения линтера кода: $code"
      case "$code" in
        0) exit 0 ;;
        2)
          if [ "$TRIP_GATE_STRICT" = "1" ]; then
            echo "Предупреждения линтера кода роняют задание: TRIP_GATE_STRICT=1."
            exit 1
          fi
          echo "Предупреждения линтера кода: разберите их до следующей контрольной точки."
          exit 0
          ;;
        *) exit "$code" ;;
      esac
  artifacts:
    when: always
    paths:
      - .trip/lint-report.json
    expire_in: 14 days
  rules:
    - if: '$TRIP_TOOLS_TOKEN && ($CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH)'
      exists:
        - .trip-lint.toml

линтер кода:не объявлен:
  stage: проверка
  image: $NODE_IMAGE
  allow_failure: true
  script:
    - 'echo "Линтер кода не запускается: конфигурация .trip-lint.toml не объявлена."'
    - 'echo "Порядок: trip-lint init --root . --write, поставьте зависимости движков в проекте,"'
    - 'echo "снимите исходный уровень в режиме observe и переведите проект в режим changed."'
    - 'echo "Инструкция — ИНСТРУМЕНТЫ/ИНСТРУКЦИИ/trip-lint/README.md."'
    # Красный намеренно: «не проверено» не равно «проверено». Отказ разрешён,
    # конвейер от него не падает.
    - exit 1
  rules:
    - exists:
        - .trip-lint.toml
      when: never
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'

линтер кода:не настроен:
  stage: проверка
  image: $NODE_IMAGE
  allow_failure: true
  script:
    - 'echo "Гейт линтера кода не настроен: нет TRIP_TOOLS_TOKEN, средство не установить."'
    - 'echo "Конфигурация объявлена, но проверить её нечем — это пробел доступа, а не проекта."'
    - 'echo "Порядок настройки — у ведущего; описан в ИНСТРУМЕНТЫ/README.md, раздел «Доступ без личных учётных записей»."'
    - exit 1
  rules:
    - if: '$TRIP_TOOLS_TOKEN'
      when: never
    - exists:
        - .trip-lint.toml
      if: '$CI_PIPELINE_SOURCE == "merge_request_event" || $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH'
`;

// Отпечатки — sha256 самого архива выпуска, как их отдаёт реестр пакетов.
const TRIP_CLI = {
  версия: '0.6.0',
  отпечатки: {
    'win-x64': 'd648bf1ff3b2bfbc9cdc3e39d0f7f6532e70244dd012cbed35deef098a846f3b',
    'linux-x64': 'ac8e2d7f65989d7268ac5665b91d0b015a37b22655e8daee1588e947491d7395',
    'darwin-arm64': '781b889564193fd589c76681a3c24c4bfae6775ac9b57079e114ec9dbc662e0b',
  },
};

// Линтер кода поставляется одним архивом для всех платформ: ключ файла — any.
const TRIP_LINT = {
  версия: '0.4.0',
  отпечатки: {
    any: '72ed7e05381927c54467145b8bb98d4dc281d35a771953f1e1c3179723e2ed74',
  },
};

// Запись ходунков для проекта, созданного до появления средства; версия и
// отпечаток берутся из TRIP_LINT, чтобы один факт не жил в двух местах.
const ЗАПИСЬ_TRIP_LINT = () => {
  const запись = {
    "id": "trip-lint",
    "label": "Линтер кода стандартного стека",
    "purpose": "Гейт кода стандартного стека: ESLint и Prettier фронтенда, анализаторы .NET, squawk для миграций PostgreSQL, встроенные проверки имён, зависимостей и комментариев — один отчёт с кодами выхода TRIP.",
    "requirement": "рекомендуемое",
    "needed_from_gate": 2,
    "version": "0.4.0",
    "source": {
      "kind": "generic-package",
      "registry": "internal",
      "project": "TRIP/tooling/trip-lint",
      "package": "trip-lint",
      "files": {
        "any": "trip-lint.tar.gz"
      }
    },
    "release_state": "выпускается: конвейер по метке v<версия>, публикация ручная",
    "already_installed_check": "trip-lint --version",
    "sha256": {
      "any": "72ed7e05381927c54467145b8bb98d4dc281d35a771953f1e1c3179723e2ed74"
    },
    "gate": "линтер кода стандартного стека в конвейере: оформление, имена, зависимости, комментарии, анализаторы .NET, миграции PostgreSQL"
  };
  запись.version = TRIP_LINT.версия;
  запись.sha256 = { any: TRIP_LINT.отпечатки.any };
  return запись;
};

// ── вспомогательное ─────────────────────────────────────────────────────────

const сделано = [];
const пропущено = [];
const внимание = [];

const путь = (...части) => join(КОРЕНЬ, ...части);
const есть = (относительный) => existsSync(путь(относительный));
const читать = (относительный) => readFileSync(путь(относительный), 'utf8');

function писать(относительный, текст) {
  const полный = путь(относительный);
  mkdirSync(dirname(полный), { recursive: true });
  writeFileSync(полный, текст, 'utf8');
}

/**
 * Одно обновление. `состояние()` отвечает «применено», «нужно» или строкой
 * с причиной, по которой обновление неприменимо: неприменимое не выдаётся за
 * применённое — молчание здесь было бы тем же самым пробелом, выданным за
 * проверку.
 */
function обновление(имя, состояние, применить) {
  const итог = состояние();
  if (итог === 'применено') {
    пропущено.push(`${имя}: уже применено`);
    return;
  }
  if (итог !== 'нужно') {
    внимание.push(`${имя}: ${итог}`);
    return;
  }
  if (толькоПроверка) {
    сделано.push(`${имя}: требуется`);
    return;
  }
  применить();
  сделано.push(`${имя}: применено`);
}

// ── обновления ──────────────────────────────────────────────────────────────

/*
 * Имена машинных файлов переведены на латиницу: их набирают в `include`,
 * передают скриптам и ищут в журнале конвейера, и кириллица в таком имени
 * ломается по дороге — в адресах, в оболочках и в чужих редакторах. Проект,
 * созданный из шаблона раньше, несёт прежние имена; перенос делает шаблон, а
 * не человек, потому что забытое переименование даёт два конвейера: старый,
 * который никто не правит, и новый, которого нет.
 */
const ПЕРЕИМЕНОВАНИЯ = [
  ['.gitlab/ci/след.yml', '.gitlab/ci/git-trail.yml'],
  ['.gitlab/ci/скелет.yml', '.gitlab/ci/skeleton.yml'],
  ['.gitlab/ci/навыки.yml', '.gitlab/ci/agent-skills.yml'],
  ['.gitlab/ci/средства.yml', '.gitlab/ci/training-wheels.yml'],
  ['.gitlab/ci/форма.yml', '.gitlab/ci/code-form.yml'],
  ['.gitlab/ci/документация.yml', '.gitlab/ci/docs.yml'],
  ['ИНСТРУМЕНТЫ/ЗАМОК_ИНСТРУМЕНТОВ.json', 'ИНСТРУМЕНТЫ/training-wheels.json'],
];

обновление(
  'машинные имена файлов латиницей',
  () => {
    const ждут = ПЕРЕИМЕНОВАНИЯ.filter(([старое, новое]) => есть(старое) && !есть(новое));
    if (ждут.length > 0) return 'нужно';
    const ссылки = есть('.gitlab-ci.yml') ? читать('.gitlab-ci.yml') : '';
    return ПЕРЕИМЕНОВАНИЯ.some(([старое]) => ссылки.includes(старое)) ? 'нужно' : 'применено';
  },
  () => {
    for (const [старое, новое] of ПЕРЕИМЕНОВАНИЯ) {
      if (!есть(старое) || есть(новое)) continue;
      писать(новое, читать(старое));
      rmSync(join(КОРЕНЬ, старое));
    }
    if (есть('.gitlab-ci.yml')) {
      let текст = читать('.gitlab-ci.yml');
      for (const [старое, новое] of ПЕРЕИМЕНОВАНИЯ) текст = текст.split(старое).join(новое);
      писать('.gitlab-ci.yml', текст);
    }
  },
);

обновление(
  'гейт следа',
  () => {
    if (!есть('.gitlab/ci')) return 'в проекте нет каталога .gitlab/ci — конвейер описан иначе';
    if (!есть('.gitlab/ci/git-trail.yml')) return 'нужно';
    return читать('.gitlab/ci/git-trail.yml') === ГЕЙТ_СЛЕДА ? 'применено' : 'нужно';
  },
  () => писать('.gitlab/ci/git-trail.yml', ГЕЙТ_СЛЕДА),
);

обновление(
  'подключение гейта в .gitlab-ci.yml',
  () => {
    if (!есть('.gitlab-ci.yml')) return 'в проекте нет .gitlab-ci.yml';
    const текст = читать('.gitlab-ci.yml');
    if (текст.includes('.gitlab/ci/git-trail.yml')) return 'применено';
    if (!текст.includes('include:')) return 'в .gitlab-ci.yml нет секции include — подключите гейт вручную';
    return 'нужно';
  },
  () => {
    let текст = читать('.gitlab-ci.yml');
    текст = текст.replace('include:\n', 'include:\n  - local: .gitlab/ci/git-trail.yml\n');
    const якорь = '# приведён, TRIP_GATE_STRICT переводится в "1" и находки начинают ронять сборку.';
    if (текст.includes(якорь) && !текст.includes('Гейт следа исключение')) {
      текст = текст.replace(якорь, якорь + '\n' + ОГОВОРКА_ГЕЙТА);
    }
    писать('.gitlab-ci.yml', текст);
  },
);

обновление(
  'правило исключений: замки офисных документов',
  () => {
    if (!есть('.gitignore')) return 'в проекте нет .gitignore';
    return читать('.gitignore').includes('.~lock.*#') ? 'применено' : 'нужно';
  },
  () => {
    const текст = читать('.gitignore');
    const якорь = 'Thumbs.db\n';
    писать(
      '.gitignore',
      текст.includes(якорь) ? текст.replace(якорь, якорь + ЗАМКИ_ОФИСА) : текст + ЗАМКИ_ОФИСА,
    );
  },
);

обновление(
  'правило исключений: перекрытое состояние .trip/',
  () => {
    if (!есть('.gitignore')) return 'в проекте нет .gitignore';
    const строки = читать('.gitignore').split('\n').map((с) => с.trim());
    const естьВыверенный = строки.includes('.trip/*');
    const естьСплошной = строки.includes('.trip/');
    if (!естьВыверенный) return 'выверенного правила «.trip/*» нет — перекрывать нечего';
    return естьСплошной ? 'нужно' : 'применено';
  },
  () => {
    // Правило на каталог целиком, дописанное `trip init` до 0.5.2, перекрывает
    // возвраты «!…»: в исключённый каталог git не заходит. Снимаем вместе с
    // заголовком блока, если он тут же.
    const строки = читать('.gitignore').split('\n');
    const результат = [];
    for (let i = 0; i < строки.length; i += 1) {
      if (строки[i].trim() === '.trip/') {
        if (результат.at(-1)?.trim() === '# trip state') результат.pop();
        while (результат.at(-1)?.trim() === '') результат.pop();
        continue;
      }
      результат.push(строки[i]);
    }
    писать('.gitignore', результат.join('\n'));
  },
);

обновление(
  'проверка скелета: trip.json и trip/ — обязательные зоны',
  () => {
    const файл = 'ИНСТРУМЕНТЫ/скрипты/проверить-скелет.mjs';
    if (!есть(файл)) return 'в проекте нет проверки скелета';
    return читать(файл).includes("путь: 'trip.json'") ? 'применено' : 'нужно';
  },
  () => {
    const файл = 'ИНСТРУМЕНТЫ/скрипты/проверить-скелет.mjs';
    let текст = читать(файл);
    const зона = "  { путь: '.gitignore', вид: 'файл', важность: 'обязательная', имя: 'Правила исключений' },\n";
    текст = текст.replace(
      зона,
      зона +
        "  { путь: 'trip.json', вид: 'файл', важность: 'обязательная', имя: 'Описание политик trip' },\n" +
        "  { путь: 'trip', вид: 'каталог', важность: 'обязательная', имя: 'Валидаторы политик trip' },\n",
    );
    const замена = "  { файл: 'CLAUDE.md', образец: '<Имя проекта>' },\n";
    if (текст.includes(замена) && !текст.includes("{ файл: 'trip.json'")) {
      текст = текст.replace(замена, замена + "  { файл: 'trip.json', образец: '<Имя проекта>' },\n");
    }
    писать(файл, текст);
  },
);

обновление(
  `ходунки средств: trip-cli ${TRIP_CLI.версия}`,
  () => {
    const файл = 'ИНСТРУМЕНТЫ/training-wheels.json';
    if (!есть(файл)) return 'в проекте нет ходунков средств';
    const ходунки = JSON.parse(читать(файл));
    const средства = Array.isArray(ходунки) ? ходунки : ходунки.tools;
    const запись = средства?.find((с) => с.id === 'trip-cli');
    if (!запись) return 'в ходунках нет записи trip-cli';
    if (запись.version === TRIP_CLI.версия) return 'применено';
    if (сравнитьВерсии(запись.version, TRIP_CLI.версия) > 0) {
      return `в ходунках версия ${запись.version} новее ${TRIP_CLI.версия} — понижать не буду`;
    }
    return 'нужно';
  },
  () => {
    const файл = 'ИНСТРУМЕНТЫ/training-wheels.json';
    const ходунки = JSON.parse(читать(файл));
    const средства = Array.isArray(ходунки) ? ходунки : ходунки.tools;
    const запись = средства.find((с) => с.id === 'trip-cli');
    запись.version = TRIP_CLI.версия;
    // Платформы берутся из самой записи: ходунки могли объявлять их меньше, чем
    // публикует выпуск, и дописывать неизвестную платформу скрипт не вправе.
    for (const платформа of Object.keys(запись.sha256 ?? {})) {
      if (TRIP_CLI.отпечатки[платформа]) запись.sha256[платформа] = TRIP_CLI.отпечатки[платформа];
      else внимание.push(`ходунки объявляют платформу ${платформа}, которой нет в выпуске — сверьте вручную`);
    }
    писать(файл, `${JSON.stringify(ходунки, null, 2)}\n`);
  },
);

обновление(
  'гейт линтера кода',
  () => {
    if (!есть('.gitlab/ci')) return 'в проекте нет каталога .gitlab/ci — конвейер описан иначе';
    if (!есть('.gitlab/ci/code-lint.yml')) return 'нужно';
    return читать('.gitlab/ci/code-lint.yml') === ГЕЙТ_ЛИНТЕРА ? 'применено' : 'нужно';
  },
  () => писать('.gitlab/ci/code-lint.yml', ГЕЙТ_ЛИНТЕРА),
);

обновление(
  'подключение гейта линтера кода в .gitlab-ci.yml',
  () => {
    if (!есть('.gitlab-ci.yml')) return 'в проекте нет .gitlab-ci.yml';
    const текст = читать('.gitlab-ci.yml');
    if (текст.includes('.gitlab/ci/code-lint.yml')) return 'применено';
    if (!текст.includes('include:')) return 'в .gitlab-ci.yml нет секции include — подключите гейт вручную';
    return 'нужно';
  },
  () => {
    const текст = читать('.gitlab-ci.yml');
    const строка = '  - local: .gitlab/ci/code-lint.yml\n';
    const после = '  - local: .gitlab/ci/code-form.yml\n';
    писать(
      '.gitlab-ci.yml',
      текст.includes(после) ? текст.replace(после, после + строка) : текст.replace('include:\n', 'include:\n' + строка),
    );
  },
);

обновление(
  `ходунки средств: trip-lint ${TRIP_LINT.версия}`,
  () => {
    const файл = 'ИНСТРУМЕНТЫ/training-wheels.json';
    if (!есть(файл)) return 'в проекте нет ходунков средств';
    const ходунки = JSON.parse(читать(файл));
    const средства = Array.isArray(ходунки) ? ходунки : ходунки.tools;
    const запись = средства?.find((с) => с.id === 'trip-lint');
    if (!запись) return 'нужно';
    if (запись.version === TRIP_LINT.версия) return 'применено';
    if (сравнитьВерсии(запись.version, TRIP_LINT.версия) > 0) {
      return `в ходунках версия ${запись.version} новее ${TRIP_LINT.версия} — понижать не буду`;
    }
    return 'нужно';
  },
  () => {
    const файл = 'ИНСТРУМЕНТЫ/training-wheels.json';
    const ходунки = JSON.parse(читать(файл));
    const средства = Array.isArray(ходунки) ? ходунки : ходунки.tools;
    let запись = средства.find((с) => с.id === 'trip-lint');
    if (!запись) {
      // Новое средство встаёт рядом с соседним гейтом кода, а не в конец списка.
      запись = ЗАПИСЬ_TRIP_LINT();
      const место = средства.findIndex((с) => с.id === 'trip-cast');
      средства.splice(место >= 0 ? место + 1 : средства.length, 0, запись);
    }
    запись.version = TRIP_LINT.версия;
    запись.sha256 = { ...запись.sha256, any: TRIP_LINT.отпечатки.any };
    писать(файл, `${JSON.stringify(ходунки, null, 2)}\n`);
  },
);

обновление(
  'политика trip под контролем версий',
  () => {
    if (!есть('trip.json') || !есть('trip')) {
      return 'нет trip.json или trip/ — выполните `trip init`, затем повторите запуск';
    }
    return 'применено';
  },
  () => {},
);

function сравнитьВерсии(а, б) {
  const разбор = (в) => String(в).split('.').map((ч) => Number.parseInt(ч, 10) || 0);
  const [а1, а2, а3] = разбор(а);
  const [б1, б2, б3] = разбор(б);
  return а1 - б1 || а2 - б2 || а3 - б3;
}

// ── отчёт ───────────────────────────────────────────────────────────────────

console.log(`Корень проекта: ${КОРЕНЬ}\n`);
for (const строка of пропущено) console.log(`  =  ${строка}`);
for (const строка of сделано) console.log(`  +  ${строка}`);
for (const строка of внимание) console.log(`  !  ${строка}`);

if (!сделано.length && !внимание.length) {
  console.log('\nОснастка соответствует шаблону. Делать нечего.');
  process.exit(0);
}

if (толькоПроверка) {
  console.log(`\nТребуется обновлений: ${сделано.length}. Запустите без «--проверить».`);
  process.exit(сделано.length ? 1 : 0);
}

console.log(`
Файлы изменены, ничего не зафиксировано — это решение человека.

Порядок фиксации: методология и остальное идут разными коммитами, потому что
политика «generic» запрещает править trip.json и trip/, а «policies-only»
запрещает всё остальное.

  git switch -c chore/service/repository-trip-gate

  trip policy policies-only
  git add trip.json trip/
  git commit                      # chore(service/repository): ...

  trip policy generic
  git add -A
  git commit                      # chore(service/repository): ...

Запись в CHANGELOG.md для chore(service) не требуется, но гейт следа —
наблюдаемое изменение для команды, и записать его стоит.
`);
