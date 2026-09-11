// Валидатор сообщения коммита — Conventional Commits v1.0.0,
// согласованный с «Соглашением о коммитах» методологии TRIP v1.5.
//
// Формат:
//   <тип>(<направление>[/<область>])[!]: <описание>
//
//   [тело]
//
//   [футеры]
//
// Тип описывает характер изменения:
//   req, docs, feat, fix, refactor, perf, build, ci, style, test, revert, chore
//
// Направление выбирает профильного ревьюера:
//   analytics, development, qa, ux, client; service — вне стратегических направлений.
//
// Примеры:
//   feat(development/auth): добавить вход по SSO (R-101)
//   fix(development): не падать на пустом ответе (R-059)
//   docs(client/demo): зафиксировать решения демонстрации (AC-3)
//   refactor(development/api)!: убрать поле legacyId (R-55)
//
// Глобальные переменные:
//   message      — полный текст сообщения;
//   registry     — идентификаторы требований, заведённые в реестрах репозитория,
//                  по одному в строке; пустая строка означает «реестр недоступен»;
//   registrySource — какие именно реестры прочитаны (для объяснения отказа);
//   gitOperation — выполняемая сейчас операция git: merge, revert, cherry-pick
//                  либо пустая строка.
//   originPolicy — секция политики message.origin в виде JSON; пустая строка
//                  означает «правило происхождения не объявлено».
// Результат: true — сообщение валидно; строка — причина отказа (её покажет trip).

// ── настройки ───────────────────────────────────────────────────────────────
var TYPES = [
  'req', 'docs',
  'feat', 'fix', 'refactor', 'perf', 'build', 'ci', 'style', 'revert',
  'test',
  'chore',
]
var DIRECTIONS = ['analytics', 'development', 'qa', 'ux', 'client', 'service']
var MAX_HEADER = 100 // предел длины заголовка
var MIN_SUBJECT = 10 // минимальная информативность: описание не короче этого числа символов
var REQUIRE_RU_SUBJECT = true // описание на русском (хотя бы одна кириллическая буква)
var REQUIRE_REF = true // ссылка на идентификатор трассируемости обязательна для содержательных изменений
// Идентификаторы из реестров методологии:
//   R — требование · DR — черновое требование · US — история · UC — сценарий использования
//   Q — открытый вопрос · AR — риск (матрица и реестр рисков)
//   ADR — архитектурное решение
//   AC — приёмочный критерий · TC — тестовый сценарий
//   BUG — дефект · ФЗ — практика фонда знаний
// Границы не дают совпасть с куском чужого слова (FAQ-1, FEAR-1, ADR внутри
// слова) или с неканоническим дробным ID. Одна строчная латинская буква после
// номера — часть идентификатора, а не мусор: каталог методологии различает ею
// сценарии одного критерия (AC-042a). Двух букв и прописной канон не знает —
// они отвергаются по-прежнему. Точка как обычный знак препинания допустима
// только перед пробелом или концом текста.
var REF_PATTERN = /(?<![A-Za-zА-ЯЁа-яё0-9_-])(?:R|DR|US|UC|Q|AR|ADR|AC|TC|BUG|ФЗ)-\d+[a-z]?(?![A-Za-zА-ЯЁа-яё0-9_-]|\.(?!\s|$))/

// Сообщения, которые формирует сам git при слиянии, откате и переносе коммита.
// Их грамматика задана git, а не автором: git вызывает commit-msg и на них тоже,
// поэтому проверка заголовка заблокировала бы обычное слияние.
//
// Освобождение действует только при подтверждённой операции git (переменная
// gitOperation): текст сообщения подделывается, состояние репозитория — нет.
// Поэтому вручную набранное «Merge branch ...» остаётся нарушением.
var GIT_GENERATED = [
  /^Merge (branch|branches|remote-tracking branch|pull request|tag) /,
  /^Revert "/,
]

// Заплатки `git commit --fixup|--squash`. Состояния у них нет: git не
// записывает, что идёт правка раннего коммита, — поэтому опознать их можно
// только по тексту, а текст набирается руками. Освобождение здесь оставляет
// лазейку сознательно: она закрыта на отправке, где `trip verify --fixups`
// требует, чтобы заплаток в ветке не осталось. Замысел приёма ровно такой —
// заплатка обязана исчезнуть при `git rebase --autosquash` до отправки.
var AUTOSQUASH = /^(fixup|squash|amend)! /

// Ссылка на требование засчитывается, только если требование существует.
// Реестр требований — центральный артефакт каркаса: он отвечает, заведено ли
// требование, а не похоже ли упоминание на идентификатор.
var REQUIREMENT_PATTERN = /(?<![A-Za-zА-ЯЁа-яё0-9_-])R-\d+[a-z]?(?![A-Za-zА-ЯЁа-яё0-9_-]|\.(?!\s|$))/g

// ── происхождение изменения (R-088 — R-091) ────────────────────────────────
// Последний абзац сообщения называет, кто вёл изменение:
//
//   Assisted-by: <средство> | none
//   Model: <идентификатор модели>
//   Session: <url|идентификатор сеанса>
//   Prompt-SHA256: <64 строчных шестнадцатеричных знака>
//
// Трейлер несёт указатель, а не содержимое: текста реплик в репозитории нет,
// и `Prompt-SHA256` — обязательство по реплике, чей открытый текст живёт во
// внешнем леджере с разграниченным доступом. Git остаётся тонким индексом
// указателей; связь «этот коммит вёл вот этот промпт» доказывается сверкой с
// леджером, а не чтением истории.
//
// Блок читается по правилу git: последний абзац и только он, целиком из строк
// «Ключ: значение». Одна посторонняя строка отбрасывает весь абзац — включая
// «BREAKING CHANGE:» с пробелом, который трейлером не является.
//
// Заявление, а не свидетельство: текст сообщения подделывается, и «none» в
// сообщении, написанном средством, проверка от правды не отличит. Проверяются
// наличие и форма — доказательную силу даёт якорь вместе с леджером.
var ORIGIN_AGENT = 'assisted-by'
var ORIGIN_MANUAL = 'none'
// Порядок задаёт и порядок отказов: сначала кто, потом чем и куда смотреть.
var ORIGIN_KEYS = ['assisted-by', 'model', 'session', 'prompt-sha256']
var ORIGIN_TITLES = {
  'assisted-by': 'Assisted-by',
  'model': 'Model',
  'session': 'Session',
  'prompt-sha256': 'Prompt-SHA256',
}
var AGENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
var AGENT_MAX = 32
var MODEL_MAX = 100
// Указатель — URL либо непрозрачный идентификатор. Проверяется только форма:
// разрешить сеанс может леджер, а не валидатор сообщения.
var SESSION_PATTERN = /^[A-Za-z0-9]\S{7,}$/
var SESSION_MAX = 200
var ANCHOR_PATTERN = /^[0-9a-f]{64}$/
// Грамматика трейлера — та же, что читает git: «Ключ: значение».
var TRAILER_LINE = /^([A-Za-z][A-Za-z0-9-]*):[ \t]*(.*)$/

// ── вспомогательное ─────────────────────────────────────────────────────────
function isGitGenerated(header) {
  if (AUTOSQUASH.test(header)) return true

  var operation = String(typeof gitOperation === 'undefined' ? '' : gitOperation || '')
  if (!operation) return false

  for (var i = 0; i < GIT_GENERATED.length; i++) {
    if (GIT_GENERATED[i].test(header)) return true
  }
  return false
}

// Сравнение без ведущих нулей: «R-55» и «R-055» — один и тот же идентификатор.
// Иначе расхождение в записи давало бы нарушение там, где требование заведено.
function normalizeId(id) {
  return id.replace(/-0+(\d)/, '-$1')
}

function knownRequirements() {
  return String(typeof registry === 'undefined' ? '' : registry || '')
    .split(/\s+/)
    .filter(function (s) { return s.length > 0 })
}

function registryCount() {
  return knownRequirements().length
}

// Отказ обязан называть, по чему сверялись: иначе непонятно, ошибся автор
// или проверка прочитала не тот файл.
function registrySources() {
  var source = String(typeof registrySource === 'undefined' ? '' : registrySource || '')
  return source || 'неизвестного источника'
}

// Идентификаторы требований из текста, которых нет ни в одном реестре.
// Пустой реестр означает «проверить нечем»: нарушение не выдумывается.
function unknownRequirements(text) {
  var known = knownRequirements().map(normalizeId)

  if (!known.length) return []

  var found = text.match(REQUIREMENT_PATTERN) || []
  var unknown = []
  for (var i = 0; i < found.length; i++) {
    if (known.indexOf(normalizeId(found[i])) < 0 && unknown.indexOf(found[i]) < 0) {
      unknown.push(found[i])
    }
  }
  return unknown
}

// ── происхождение: разбор трейлеров ─────────────────────────────────────────
function owns(bag, key) {
  return Object.prototype.hasOwnProperty.call(bag, key)
}

// Правило вводит проект, а не версия инструмента: без объявленной секции
// проверка не выполняется вовсе. Иначе обновление валидатора заблокировало бы
// коммиты в репозиториях, которые о правиле не решали.
function originSpec() {
  var raw = String(typeof originPolicy === 'undefined' ? '' : originPolicy || '').trim()
  if (!raw) return { mode: 'off', agents: [], requireAnchor: false }

  var parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { mode: 'broken', agents: [], requireAnchor: false }
  }
  if (!parsed || typeof parsed !== 'object')
    return { mode: 'broken', agents: [], requireAnchor: false }

  var agents = []
  var declared = parsed.agents
  if (declared !== null && declared !== undefined) {
    if (Object.prototype.toString.call(declared) !== '[object Array]')
      return { mode: 'broken', agents: [], requireAnchor: false }
    for (var i = 0; i < declared.length; i++) agents.push(String(declared[i]).toLowerCase())
  }

  return {
    mode: parsed.mode === null || parsed.mode === undefined
      ? 'off'
      : String(parsed.mode).toLowerCase(),
    agents: agents,
    requireAnchor: parsed.requireAnchor === true,
  }
}

// Трейлерный блок — последний абзац сообщения. Границу задал git: %(trailers)
// читает только его, и указатель из тела не увидит ни git log, ни сборщик.
function trailerBlock(all) {
  var block = []
  for (var i = all.length - 1; i >= 1; i--) {
    if (all[i].trim() === '') break
    block.unshift(all[i])
  }
  return block
}

// Ключ в нижнем регистре → все его значения. Именно все: повтор обязан быть
// виден отказу, а не молча перекрыт последним вхождением.
function trailersOf(block) {
  var found = {}
  for (var i = 0; i < block.length; i++) {
    var line = block[i].match(TRAILER_LINE)
    if (!line) continue
    var key = line[1].toLowerCase()
    if (!owns(found, key)) found[key] = []
    found[key].push(line[2].trim())
  }
  return found
}

function trailerValue(found, key) {
  return owns(found, key) ? found[key][0] : null
}

// Блок трейлеров у git — всё или ничего: одна строка, не похожая на
// «Ключ: значение», отбрасывает весь абзац целиком, и
// `git log --format=%(trailers)` возвращает пустоту. Проверка обязана
// совпадать с этим правилом: иначе она пропустит сообщение, из которого
// сборщик не прочитает ни одного указателя, — то есть разрешит ровно то,
// ради запрета чего заведена.
//
// Продолжение с отступа git разрешает, но приклеивает к значению предыдущего
// трейлера. Здесь оно запрещено: проверенное значение и прочитанное git
// разошлись бы молча, а слаг, модель, указатель и хэш в переносе не нуждаются.
function brokenTrailerLine(block) {
  for (var i = 0; i < block.length; i++) {
    if (!TRAILER_LINE.test(block[i])) return block[i]
  }
  return null
}

// Трейлер происхождения, оказавшийся вне трейлерного блока: написан он или нет,
// для git log --format=%(trailers) его не существует.
function strayedOrigin(all, found) {
  var body = all.slice(1)
  var strayed = []
  for (var k = 0; k < ORIGIN_KEYS.length; k++) {
    var key = ORIGIN_KEYS[k]
    if (owns(found, key)) continue
    for (var i = 0; i < body.length; i++) {
      var line = body[i].match(TRAILER_LINE)
      if (line && line[1].toLowerCase() === key) {
        strayed.push(ORIGIN_TITLES[key])
        break
      }
    }
  }
  return strayed
}

// Причина отказа по происхождению либо null. Проверяются наличие и форма:
// удостоверить, что заявление правдиво, git не может.
function originProblem(all) {
  var spec = originSpec()
  if (spec.mode === 'off') return null
  if (spec.mode === 'broken')
    return 'секция политики message.origin не разобралась: правило происхождения объявлено, ' +
      'а прочитать его нечем. Непонятная запись — отказ, а не разрешение: исправьте trip.json'
  if (spec.mode !== 'required')
    return 'неизвестный режим message.origin «' + spec.mode + '», допустимы: off, required'

  var block = trailerBlock(all)
  var found = trailersOf(block)

  var strayed = strayedOrigin(all, found)
  if (strayed.length)
    return (strayed.length > 1 ? 'трейлеры ' : 'трейлер ') + strayed.join(', ') +
      (strayed.length > 1 ? ' стоят' : ' стоит') + ' не в последнем абзаце сообщения: ' +
      'git читает трейлеры только там, и для сборщика такого указателя не существует'

  // Целостность блока проверяется только там, где указатель заявлен: в сообщении
  // без трейлеров происхождения последний абзац — обычная проза, и требовать от
  // неё грамматику трейлеров не за что. Отсутствие Assisted-by назовёт проверка
  // ниже — своим отказом, а не жалобой на прозу.
  var declared = false
  for (var d = 0; d < ORIGIN_KEYS.length; d++) {
    if (owns(found, ORIGIN_KEYS[d])) declared = true
  }

  if (declared) {
    var broken = brokenTrailerLine(block)
    if (broken !== null) {
      var shown = broken.length > 60 ? broken.slice(0, 57) + '…' : broken
      if (/^BREAKING CHANGE:/.test(broken))
        return 'строка «BREAKING CHANGE: …» отбрасывает весь трейлерный блок: ' +
          'ключ с пробелом git трейлером не считает, и вместе с ним теряются ' +
          'указатели происхождения. Напишите «BREAKING-CHANGE: …» через дефис ' +
          'либо вынесите объяснение в тело коммита'
      return 'строка «' + shown + '» в последнем абзаце не является трейлером: ' +
        'git отбрасывает такой абзац целиком, и указателей в нём не остаётся. ' +
        'Оставьте в последнем абзаце только строки вида «Ключ: значение», ' +
        'а прозу и переносы перенесите в тело'
    }
  }

  for (var k = 0; k < ORIGIN_KEYS.length; k++) {
    var key = ORIGIN_KEYS[k]
    if (owns(found, key) && found[key].length > 1)
      return 'трейлер ' + ORIGIN_TITLES[key] + ' указан ' + found[key].length +
        (found[key].length >= 5 ? ' раз: ' : ' раза: ') +
        'указатель, показывающий на два места, не показывает никуда'
  }

  var agent = trailerValue(found, ORIGIN_AGENT)
  if (agent === null)
    return 'нет трейлера Assisted-by: последний абзац обязан назвать средство, которое вело ' +
      'изменение, либо «Assisted-by: none» для правки, сделанной без средства'
  if (!agent)
    return 'трейлер Assisted-by пуст: назовите средство либо «none»'

  var slug = agent.toLowerCase()

  if (slug === ORIGIN_MANUAL) {
    var extra = []
    for (var e = 1; e < ORIGIN_KEYS.length; e++) {
      if (owns(found, ORIGIN_KEYS[e])) extra.push(ORIGIN_TITLES[ORIGIN_KEYS[e]])
    }
    if (extra.length)
      return 'коммит объявлен ручным («Assisted-by: none»), но несёт ' + extra.join(', ') + ': ' +
        'сеанса, на который можно сослаться, не было — уберите трейлер либо назовите средство'
    return null
  }

  if (slug.length > AGENT_MAX || !AGENT_PATTERN.test(slug))
    return 'средство «' + agent + '» записано не слагом: строчная латиница, цифры и дефис, ' +
      'не длиннее ' + AGENT_MAX + ' знаков — например claude-code'
  if (spec.agents.length && spec.agents.indexOf(slug) < 0)
    return 'средство «' + slug + '» не объявлено в message.origin.agents. Объявлены: ' +
      spec.agents.join(', ') + '. Словарь пополняется решением проекта в trip.json, ' +
      'а не догадкой проверки'

  var model = trailerValue(found, 'model')
  if (model === null)
    return 'нет трейлера Model: средство названо, а модель — нет'
  if (!model || model.length > MODEL_MAX)
    return 'трейлер Model пуст или длиннее ' + MODEL_MAX + ' знаков: укажите идентификатор модели'

  var session = trailerValue(found, 'session')
  if (session === null)
    return 'нет трейлера Session: без указателя на сеанс запись о средстве никуда не ведёт'
  if (session.length > SESSION_MAX || !SESSION_PATTERN.test(session))
    return 'указатель сеанса «' + session + '» не разобрался: ожидается URL либо идентификатор ' +
      'без пробелов, не короче 8 и не длиннее ' + SESSION_MAX + ' знаков'

  var anchor = trailerValue(found, 'prompt-sha256')
  if (anchor === null)
    return spec.requireAnchor
      ? 'нет трейлера Prompt-SHA256: политика требует якорь реплики (sha256 от текста, ' +
        'который лежит в леджере, а не в репозитории)'
      : null
  if (!ANCHOR_PATTERN.test(anchor))
    return 'якорь Prompt-SHA256 — ровно 64 строчных шестнадцатеричных знака; ' +
      'открытый текст реплики в репозиторий не кладётся'

  return null
}

// ── разбор ──────────────────────────────────────────────────────────────────
var text = String(message || '').replace(/\r\n/g, '\n')

// комментарии git (# ...) и подпись Signed-off-by в разбор не идут
var lines = text.split('\n').filter(function (l) {
  return l.indexOf('#') !== 0
})
while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
var fullText = lines.join('\n')

var header = (lines[0] || '').trim()

if (!header) 'сообщение пустое'
else if (isGitGenerated(header)) true
else if (header.length > MAX_HEADER)
  'заголовок длиннее ' + MAX_HEADER + ' символов (сейчас ' + header.length + ')'
else {
  var m = header.match(/^([a-z]+)(?:\(([^()]+)\))?(!)?: (\S.*)$/)

  if (!m) {
    if (/^[a-z]+(\([^()]+\))?!?:/.test(header))
      'после двоеточия нужен ровно один пробел: ' + header.split(':')[0] + ': <описание>'
    else 'ожидается «тип(направление[/область]): описание», например «feat(development/auth): добавить вход по SSO (R-101)»'
  } else {
    var type = m[1]
    var scope = m[2]
    var breaking = !!m[3]
    var subject = m[4]
    var scopeMatch = scope && scope.match(/^([a-z]+)(?:\/([a-z0-9][a-z0-9._-]*))?$/)
    var direction = scopeMatch ? scopeMatch[1] : null
    var refExempt = type === 'revert' || (type === 'chore' && direction === 'service')

    // BREAKING CHANGE объявляется либо «!» в заголовке, либо футером
    var hasBreakingFooter = lines.some(function (l) {
      return /^BREAKING[ -]CHANGE: /.test(l)
    })

    // тело и футеры отделяются от заголовка пустой строкой
    var bodyStartsWrong = lines.length > 1 && lines[1].trim() !== ''

    // Происхождение не освобождается ни типом, ни направлением: служебная
    // правка и откат тоже кем-то сделаны. Освобождены только сообщения,
    // сочинённые самим git, — они отсеяны выше, до разбора заголовка.
    var originIssue = originProblem(lines)

    if (TYPES.indexOf(type) < 0) 'неизвестный тип «' + type + '», допустимы: ' + TYPES.join(', ')
    else if (!scope)
      'направление обязательно: ' + type + '(<направление>[/<область>]): <описание>'
    else if (!scopeMatch)
      'область «' + scope + '»: ожидается направление или направление/область; латиница в нижнем регистре, цифры, . _ -'
    else if (DIRECTIONS.indexOf(direction) < 0)
      'неизвестное направление «' + direction + '», допустимы: ' + DIRECTIONS.join(', ')
    else if (!subject.trim()) 'описание пустое'
    else if (subject.trim().length < MIN_SUBJECT)
      'описание недостаточно информативно (' + subject.trim().length + ' симв., минимум ' + MIN_SUBJECT + '): укажите, какое изменение вносит коммит'
    else if (/\.$/.test(subject)) 'описание не должно заканчиваться точкой'
    else if (/^[A-ZА-ЯЁ]/.test(subject) && !/^[A-ZА-ЯЁ]{2,}/.test(subject))
      'описание начинается со строчной буквы'
    else if (REQUIRE_RU_SUBJECT && !/[а-яёА-ЯЁ]/.test(subject))
      'описание — на русском (после префикса); идентификаторы — латиницей'
    else if (bodyStartsWrong) 'между заголовком и телом нужна пустая строка'
    else if (breaking && !hasBreakingFooter && lines.length === 1)
      'ломающее изменение: опишите его в теле или футером «BREAKING CHANGE: ...»'
    else if (REQUIRE_REF && !refExempt && !REF_PATTERN.test(fullText))
      'нет ссылки на идентификатор трассируемости (R, DR, US, UC, Q, AR, ADR, AC, TC, BUG, ФЗ); без ссылки допустимы только chore(service) и revert'
    else if (unknownRequirements(fullText).length)
      'требование ' + unknownRequirements(fullText).join(', ') + ' не заведено в реестре. ' +
        'Прочитано ' + registryCount() + ' идентификаторов из: ' + registrySources() + '. ' +
        'Ссылка на несуществующее требование трассируемости не даёт — ' +
        'заведите требование в реестре или исправьте номер'
    else if (originIssue) originIssue
    else true
  }
}
