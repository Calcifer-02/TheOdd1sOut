// Валидатор имени ветки по соглашению о ветках TRIP.
//
// Обычная ветка:
//   <тип>/<направление>[/<область>]/<основание>-<краткое-имя>
//
// Особые ветки:
//   experiment/<направление>[/<область>]/hyp-<номер>-<краткое-имя>
//   hotfix/<направление>[/<область>]/bug-<номер>-<краткое-имя>
//   release/service/v<major>.<minor>
//
// Глобальная переменная: branch — имя ветки.
// Результат: true — имя валидно; строка — причина отказа.

var BRANCH_TYPES = [
  'req', 'docs',
  'feat', 'fix', 'refactor', 'perf', 'build', 'ci', 'style', 'revert',
  'test',
  'chore',
]
var BRANCH_DIRECTIONS = ['analytics', 'development', 'qa', 'ux', 'client', 'service']
var BRANCH_MAX_LENGTH = 120
var BRANCH_AREA_PATTERN = /^[a-z0-9][a-z0-9._-]*$/
var BRANCH_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
var BRANCH_CANONICAL_TAIL =
  /^(r|dr|us|uc|q|ar|adr|ac|tc|bug|fz)-\d+-([a-z0-9]+(?:-[a-z0-9]+)*)$/
var BRANCH_SERVICE_TAIL =
  /^(branch|workflow|repository|dependencies|tooling|release)-([a-z0-9]+(?:-[a-z0-9]+)*)$/

function branchRoute(parts, specialType) {
  var expectedMin = specialType ? 3 : 3
  var expectedMax = specialType ? 4 : 4
  if (parts.length < expectedMin || parts.length > expectedMax) {
    return 'ожидается направление, необязательная одна область и основание с кратким именем'
  }

  var direction = parts[1]
  if (BRANCH_DIRECTIONS.indexOf(direction) < 0) {
    return 'неизвестное направление «' + direction + '», допустимы: ' +
      BRANCH_DIRECTIONS.join(', ')
  }

  if (parts.length === 4 && !BRANCH_AREA_PATTERN.test(parts[2])) {
    return 'область «' + parts[2] +
      '»: ожидаются строчные латинские буквы, цифры, . _ -'
  }

  return true
}

function branchTail(parts) {
  return parts[parts.length - 1]
}

var branchResult = (function () {
  var name = String(branch || '')

  if (!name) return 'имя ветки пустое'
  if (name.length > BRANCH_MAX_LENGTH) {
    return 'имя ветки длиннее ' + BRANCH_MAX_LENGTH +
      ' символов (сейчас ' + name.length + ')'
  }
  if (name === 'main') {
    return 'прямые коммиты в защищённую ветку main запрещены: создайте рабочую ветку'
  }
  if (/^env\/(?:test|stage|prod)$/.test(name)) {
    return 'env/test, env/stage и env/prod являются указателями окружений и не рабочими ветками'
  }
  if (!/^[a-z0-9._/-]+$/.test(name)) {
    return 'имя ветки содержит недопустимые символы: используйте строчный ASCII'
  }
  if (name.indexOf('//') >= 0 || name[0] === '/' || name[name.length - 1] === '/') {
    return 'имя ветки содержит пустой сегмент'
  }

  var parts = name.split('/')
  var type = parts[0]

  if (type === 'release') {
    if (/^release\/service\/v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(name)) {
      return true
    }
    return 'release-ветка: ожидается «release/service/v<major>.<minor>»'
  }

  if (type === 'experiment') {
    var experimentRoute = branchRoute(parts, true)
    if (experimentRoute !== true) return experimentRoute
    if (!/^hyp-\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchTail(parts))) {
      return 'experiment-ветка: ожидается основание «hyp-<номер>-<краткое-имя>»'
    }
    return true
  }

  if (type === 'hotfix') {
    var hotfixRoute = branchRoute(parts, true)
    if (hotfixRoute !== true) return hotfixRoute
    if (!/^bug-\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(branchTail(parts))) {
      return 'hotfix-ветка: ожидается основание «bug-<номер>-<краткое-имя>»'
    }
    return true
  }

  if (BRANCH_TYPES.indexOf(type) < 0) {
    return 'неизвестный тип «' + type + '», допустимы: ' + BRANCH_TYPES.join(', ')
  }

  var route = branchRoute(parts, false)
  if (route !== true) return route

  var tail = branchTail(parts)
  if (BRANCH_CANONICAL_TAIL.test(tail)) return true

  if (type === 'chore' && parts[1] === 'service' && BRANCH_SERVICE_TAIL.test(tail)) {
    return true
  }

  if (!BRANCH_NAME_PATTERN.test(tail)) {
    return 'основание и краткое имя содержат недопустимые символы'
  }

  return 'основание должно быть каноническим идентификатором ' +
    '(r, dr, us, uc, q, ar, adr, ac, tc, bug, fz); ' +
    'для chore/service допустимы branch, workflow, repository, dependencies, tooling, release'
})()

branchResult
