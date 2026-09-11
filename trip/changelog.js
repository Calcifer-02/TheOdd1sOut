// Валидатор CHANGELOG.md по соглашению о журнале изменений TRIP.
//
// Глобальные переменные:
//   content       — staged-содержимое CHANGELOG.md;
//   previous      — содержимое CHANGELOG.md в базовом коммите;
//   branch        — имя текущей ветки;
//   requireChange — нужно ли требовать новую запись для этой проверки.
//
// Результат: true — журнал валиден; строка — причина отказа.

var CHANGELOG_SECTIONS = [
  'Аналитика',
  'Разработка',
  'QA и тесты',
  'UX и эстетика',
  'Клиент',
  'Служебные изменения',
]
var CHANGELOG_DIRECTION_SECTIONS = {
  analytics: 'Аналитика',
  development: 'Разработка',
  qa: 'QA и тесты',
  ux: 'UX и эстетика',
  client: 'Клиент',
  service: 'Служебные изменения',
}
var CHANGELOG_DIRECTIONS = ['analytics', 'development', 'qa', 'ux', 'client', 'service']
var CHANGELOG_RELEASE_PATTERN =
  /^## \[(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\] — (\d{4})-(\d{2})-(\d{2}) — ТЗ v(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function changelogNormalize(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
}

function changelogComparable(value) {
  return changelogNormalize(value)
    .split('\n')
    .map(function (line) { return line.replace(/[ \t]+$/, '') })
    .join('\n')
    .replace(/\n+$/, '')
}

function changelogValidReleaseHeading(heading) {
  var match = heading.match(CHANGELOG_RELEASE_PATTERN)
  if (!match) return false

  var year = Number(match[4])
  var month = Number(match[5])
  var day = Number(match[6])
  var date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

function changelogEntryText(lines) {
  return lines
    .map(function (line) { return line.trim() })
    .filter(function (line) { return line.length > 0 })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function changelogParse(value) {
  var lines = changelogNormalize(value).split('\n')
  var entries = []
  var error = null
  var firstH1Seen = false
  var firstH2Seen = false
  var currentH2 = null
  var currentSection = null
  var currentSectionIndex = -1
  var sectionHasEntry = false
  var activeEntry = null

  function finishEntry() {
    if (!activeEntry) return
    entries.push({
      h2: activeEntry.h2,
      section: activeEntry.section,
      text: changelogEntryText(activeEntry.lines),
    })
    activeEntry = null
  }

  function finishSection() {
    finishEntry()
    if (currentSection !== null && !sectionHasEntry && !error) {
      error = 'раздел «' + currentSection + '» пуст: удалите его или добавьте запись'
    }
  }

  for (var i = 0; i < lines.length && !error; i++) {
    var raw = lines[i]
    var line = raw.trim()
    var h1 = line.match(/^# (?!#)(.+)$/)
    var h2 = line.match(/^## (?!#)(.+)$/)
    var h3 = line.match(/^### (?!#)(.+)$/)

    if (h1) {
      finishSection()
      if (error) break
      if (firstH1Seen || line !== '# Журнал изменений') {
        error = 'первый и единственный заголовок первого уровня должен быть «# Журнал изменений»'
        break
      }
      if (firstH2Seen) {
        error = 'заголовок «# Журнал изменений» должен находиться до разделов выпусков'
        break
      }
      firstH1Seen = true
      continue
    }

    if (h2) {
      finishSection()
      if (error) break
      if (!firstH1Seen) {
        error = 'перед разделами нужен заголовок «# Журнал изменений»'
        break
      }

      if (!firstH2Seen) {
        firstH2Seen = true
        if (line !== '## Невыпущено') {
          error = 'первый раздел второго уровня должен быть «## Невыпущено»'
          break
        }
      } else if (!changelogValidReleaseHeading(line)) {
        error = 'заголовок выпуска должен иметь формат ' +
          '«## [X.Y.Z] — YYYY-MM-DD — ТЗ vA.B»'
        break
      }

      currentH2 = line
      currentSection = null
      currentSectionIndex = -1
      sectionHasEntry = false
      activeEntry = null
      continue
    }

    if (h3) {
      if (currentH2 === null) {
        error = 'подраздел «' + h3[1] + '» расположен до «## Невыпущено»'
        break
      }

      finishSection()
      if (error) break

      var sectionIndex = CHANGELOG_SECTIONS.indexOf(h3[1])
      if (sectionIndex < 0) {
        error = 'неизвестный раздел «' + h3[1] + '», допустимы: ' +
          CHANGELOG_SECTIONS.join(', ')
        break
      }
      if (sectionIndex <= currentSectionIndex) {
        error = 'раздел «' + h3[1] + '» повторяется или нарушает установленный порядок'
        break
      }

      currentSection = h3[1]
      currentSectionIndex = sectionIndex
      sectionHasEntry = false
      activeEntry = null
      continue
    }

    if (/^#{2,3}(?:[^#\s]|$)/.test(line)) {
      error = 'некорректный Markdown-заголовок «' + line + '»'
      break
    }

    if (/^- /.test(line)) {
      if (currentH2 !== null && currentSection === null) {
        error = 'запись журнала расположена вне подраздела направления'
        break
      }
      if (currentSection === null) continue

      finishEntry()
      var firstLine = line.slice(2).trim()
      if (!firstLine) {
        error = 'пустая запись в разделе «' + currentSection + '»'
        break
      }

      activeEntry = { h2: currentH2, section: currentSection, lines: [firstLine] }
      sectionHasEntry = true
      continue
    }

    if (activeEntry && line) {
      activeEntry.lines.push(line)
    }
  }

  if (!error) finishSection()
  if (!error && !firstH1Seen) {
    error = 'не найден заголовок «# Журнал изменений»'
  }
  if (!error && !firstH2Seen) {
    error = 'не найден обязательный раздел «## Невыпущено»'
  }

  return { error: error, entries: entries }
}

function changelogBranchInfo(value) {
  var name = String(value || '')
  var parts = name.split('/')
  var type = parts[0] || ''
  var direction = parts[1] || ''
  var tail = parts[parts.length - 1] || ''
  var canonical = tail.match(/^(r|dr|us|uc|q|ar|adr|ac|tc|bug|fz)-(\d+)(?:-|$)/)
  var reference = null

  if (canonical) {
    var prefix = canonical[1] === 'fz' ? 'ФЗ' : canonical[1].toUpperCase()
    reference = prefix + '-' + canonical[2]
  }

  return {
    type: type,
    direction: direction,
    reference: reference,
    isExperiment: type === 'experiment',
    isRelease: type === 'release' && direction === 'service',
    isOptionalService: type === 'chore' && direction === 'service',
  }
}

function changelogNewEntries(currentEntries, previousEntries) {
  var counts = {}
  var result = []

  previousEntries.forEach(function (entry) {
    var key = '@' + entry.h2 + '\n' + entry.section + '\n' + entry.text
    counts[key] = (counts[key] || 0) + 1
  })

  currentEntries.forEach(function (entry) {
    var key = '@' + entry.h2 + '\n' + entry.section + '\n' + entry.text
    if (counts[key]) counts[key]--
    else result.push(entry)
  })

  return result
}

function changelogContainsReference(text, reference) {
  var escaped = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  var pattern = new RegExp(
    '(^|[^A-ZА-ЯЁ0-9_-])' + escaped + '(?![A-ZА-ЯЁ0-9_.-])'
  )
  return pattern.test(text)
}

var changelogResult = (function () {
  var currentText = changelogNormalize(content)
  var previousText = changelogNormalize(previous)
  var parsed = changelogParse(currentText)

  if (parsed.error) return parsed.error
  if (!requireChange) return true

  var info = changelogBranchInfo(branch)
  var changed = changelogComparable(currentText) !== changelogComparable(previousText)

  if (info.isRelease) {
    return changed
      ? true
      : 'release-ветка должна изменять проверенный CHANGELOG.md'
  }

  if (!changed) {
    if (info.isExperiment || info.isOptionalService) return true
    return 'CHANGELOG.md не изменён: добавьте проверенный результат в «Невыпущено»'
  }

  // Эксперимент не объявляет поставленный результат; если журнал всё же изменён,
  // достаточно его структурной валидности.
  if (info.isExperiment) return true

  if (CHANGELOG_DIRECTIONS.indexOf(info.direction) < 0) {
    return 'невозможно определить направление по имени ветки «' + branch + '»'
  }

  var previousParsed = changelogParse(previousText)
  var additions = changelogNewEntries(parsed.entries, previousParsed.entries)
    .filter(function (entry) { return entry.h2 === '## Невыпущено' })
  if (!additions.length) {
    return 'CHANGELOG.md изменён, но новая запись результата в «Невыпущено» не найдена'
  }

  var expectedSection = CHANGELOG_DIRECTION_SECTIONS[info.direction]
  var expectedAdditions = additions.filter(function (entry) {
    return entry.section === expectedSection
  })
  if (!expectedAdditions.length) {
    return 'новая запись для направления «' + info.direction +
      '» должна находиться в разделе «' + expectedSection + '»'
  }

  if (info.reference) {
    var referenced = expectedAdditions.some(function (entry) {
      return changelogContainsReference(entry.text, info.reference)
    })
    if (!referenced) {
      return 'новая запись должна содержать каноническое основание ветки «' +
        info.reference + '»'
    }
  }

  return true
})()

changelogResult
