#!/bin/sh
# Статический анализ решения в SonarQube.
#
# Запуск:
#     SONAR_TOKEN=<токен> sh devops/sonar/анализ.sh
#
# Токен в репозиторий не попадает и в команду не вписывается: он приходит
# переменной окружения (условия направления, разд. 4 п. 9). Анализ идёт
# внутри контейнера, поэтому на машине нужен только Docker: сканер для .NET
# работает поверх Java, и ставить её отдельно не требуется.
#
# Анализируются обе части решения: C# собирается сканером через сборку
# решения, JavaScript и TypeScript мини-приложения разбираются попутно.

set -u

# Адрес сервера, ключ проекта и токен приходят из окружения: сервер анализа
# принадлежит организации, и его адрес в публичном репозитории не хранится.
# Значения лежат в локальном .env, который не версионируется.
OBRAZ=imolt-sonar

REPO=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPO" || exit 1

# Настройки берутся из локального .env, если он есть: там же живут остальные
# переменные окружения решения.
if [ -f .env ]; then
  . ./.env
fi

for peremennaya in SONAR_HOST SONAR_PROJECT SONAR_TOKEN; do
  eval "znachenie=\${$peremennaya:-}"
  if [ -z "$znachenie" ]; then
    echo "Отмена: не задана переменная $peremennaya."
    echo "Задайте SONAR_HOST, SONAR_PROJECT и SONAR_TOKEN в локальном .env."
    exit 1
  fi
done

# Образ среды анализа собирается один раз и переиспользуется.
if ! docker image inspect "$OBRAZ" >/dev/null 2>&1; then
  echo "Собираю образ среды анализа $OBRAZ…"
  docker build -q -t "$OBRAZ" devops/sonar || exit 1
fi

# Ветки в анализ не передаются: разбор веток есть только в изданиях выше
# Community, а сервер проекта развёрнут в Community-сборке.
# Из анализа исключается то, что не является исходным кодом решения:
# зависимости, результаты сборки, макеты интерфейса, документы и обвязка
# разработки. Валидаторы trip/ приходят с установкой инструментария и под
# действующей политикой неизменяемы: их находки команда закрыть не может,
# а в метриках проекта они выглядели бы как собственный долг.
ISKLYUCHENIYA="**/node_modules/**,**/bin/**,**/obj/**,**/dist/**,ux/**,docs/**,client/**,МЕТОДОЛОГИЯ/**,ИНСТРУМЕНТЫ/**,.trip/**,trip/**"

# Git Bash на Windows переписывает пути вида /src в C:/Program Files/Git/src;
# переменные ниже это отключают и на других системах ничего не меняют.
MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' docker run --rm \
  -v "$REPO":/src \
  -e SONAR_TOKEN="$SONAR_TOKEN" \
  -w /src \
  "$OBRAZ" \
  sh -c "
    set -e
    dotnet sonarscanner begin \
      /k:'$SONAR_PROJECT' \
      /d:sonar.host.url='$SONAR_HOST' \
      /d:sonar.token=\"\$SONAR_TOKEN\" \
      /d:sonar.exclusions='$ISKLYUCHENIYA' \
      /d:sonar.scanner.scanAll=true
    dotnet build src/back/Imolt.slnx -c Release
    dotnet sonarscanner end /d:sonar.token=\"\$SONAR_TOKEN\"
  "

KOD=$?
if [ "$KOD" -eq 0 ]; then
  echo
  echo "Анализ отправлен: $SONAR_HOST/dashboard?id=$SONAR_PROJECT"
fi
exit "$KOD"
