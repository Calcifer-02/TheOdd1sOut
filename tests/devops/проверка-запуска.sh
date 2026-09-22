#!/bin/sh
# Проверка плацдарма развёртывания: решение поднимается одной командой,
# и все четыре службы отвечают, а связи между ними живы.
#
# Проверка фальсифицируема: она падает, если сломать compose.yaml, убрать
# службу, разорвать проксирование мини-приложения на расчётную часть,
# отобрать у расчётной части доступ к базе данных или перестать отдавать
# договор API и страницу Swagger UI, по которым работает интерфейсная часть.
#
# Запуск:  sh tests/devops/проверка-запуска.sh
# Условия трека, разд. 6.1 п. 3 (запуск одной командой) и п. 5 (состав
# конфигурации Docker).

set -u

REPO=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPO" || exit 1

OSHIBKI=0
VREMENNY_ENV=0

soobshchit() {
  printf '%-58s %s\n' "$1" "$2"
}

proverit() {
  # $1 — что проверяем, $2 — ожидаемый код ответа, $3 — адрес
  otvet=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$3" 2>/dev/null)
  if [ "$otvet" = "$2" ]; then
    soobshchit "$1" "ок ($otvet)"
  else
    soobshchit "$1" "ОТКАЗ (ожидался $2, получен ${otvet:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
  fi
}

# Без .env compose не подставит порты и пароль. Для проверки заводим
# временный файл из образца и убираем его за собой, чтобы не перетереть
# рабочие настройки участника.
if [ ! -f .env ]; then
  cp .env.example .env || exit 1
  VREMENNY_ENV=1
  echo "Создан временный .env из образца на время проверки."
fi

# shellcheck disable=SC1091
. ./.env

ubrat_za_soboy() {
  docker compose down --volumes --remove-orphans >/dev/null 2>&1
  if [ "$VREMENNY_ENV" = "1" ]; then
    rm -f .env
  fi
}
trap 'ubrat_za_soboy' EXIT INT TERM

echo "== 1. Разбор конфигурации"
if docker compose config --quiet; then
  soobshchit "compose.yaml разбирается" "ок"
else
  soobshchit "compose.yaml разбирается" "ОТКАЗ"
  exit 1
fi

echo
echo "== 2. Состав служб"
SLUZHBY=$(docker compose config --services | sort | tr '\n' ' ')
OZHIDAEMYE="api bot db miniapp "
if [ "$SLUZHBY" = "$OZHIDAEMYE" ]; then
  soobshchit "службы: $SLUZHBY" "ок"
else
  soobshchit "службы: $SLUZHBY" "ОТКАЗ (ожидались: $OZHIDAEMYE)"
  OSHIBKI=$((OSHIBKI + 1))
fi

echo
echo "== 3. Сборка и запуск одной командой"
NACHALO=$(date +%s)
if ! docker compose up --build --detach --wait --wait-timeout 300; then
  soobshchit "docker compose up" "ОТКАЗ"
  docker compose ps
  exit 1
fi
KONETS=$(date +%s)
soobshchit "docker compose up (сборка и запуск)" "ок, $((KONETS - NACHALO)) с"

echo
echo "== 4. Ответы служб"
proverit "расчётная часть: живость /health" 200 "http://localhost:${API_PORT}/health"
proverit "расчётная часть: готовность /ready (видит базу)" 200 "http://localhost:${API_PORT}/ready"
# Договор API и страница его просмотра — рабочий инструмент интерфейсной
# части: она разрабатывается по ним, не дожидаясь обработчиков (ADR-0003).
proverit "расчётная часть: договор /v1/openapi.yaml" 200 "http://localhost:${API_PORT}/v1/openapi.yaml"
proverit "расчётная часть: страница Swagger UI" 200 "http://localhost:${API_PORT}/swagger/index.html"
# Справочники: семь точек области отвечают на настоящих данных начального
# набора. Проверяется не «служба поднялась», а «справочник отдаёт записи».
proverit "справочники: группы отходов" 200 "http://localhost:${API_PORT}/v1/waste-groups"
proverit "справочники: карточка группы" 200 "http://localhost:${API_PORT}/v1/waste-groups/beton-lom"
proverit "справочники: реестр полигонов" 200 "http://localhost:${API_PORT}/v1/landfills"
proverit "справочники: карточка полигона" 200 "http://localhost:${API_PORT}/v1/landfills/vostok-timohovo"
proverit "справочники: отзывы полигона" 200 "http://localhost:${API_PORT}/v1/landfills/vostok-timohovo/reviews"
proverit "справочники: актуальность данных" 200 "http://localhost:${API_PORT}/v1/data-freshness"
proverit "справочники: подсказки адреса" 200 "http://localhost:${API_PORT}/v1/address-suggestions?query=%D0%93%D0%BE%D0%B4%D0%BE%D0%B2%D0%B8%D0%BA%D0%BE%D0%B2%D0%B0"
proverit "справочники: короткий запрос подсказок отвергается" 400 "http://localhost:${API_PORT}/v1/address-suggestions?query=%D0%93%D0%BE"
proverit "чат-бот: живость /health" 200 "http://localhost:${BOT_PORT}/health"
proverit "мини-приложение: страница" 200 "http://localhost:${MINIAPP_PORT}/"
proverit "мини-приложение → расчётная часть через /api" 200 "http://localhost:${MINIAPP_PORT}/api/health"

echo
echo "== 5. Схема базы данных"
# Схему накатывает расчётная часть при старте, когда включён признак
# IMOLT_APPLY_MIGRATIONS (ADR-0002). Проверяем не «база отвечает», а
# «схема на месте»: пустая база тоже отвечает, и отличить это иначе нельзя.
tablic=$(docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc   "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null | tr -d '[:space:]')
primeneno=$(docker compose exec -T db psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc   "select count(*) from schema_migration" 2>/dev/null | tr -d '[:space:]')
if [ "${tablic:-0}" -ge 22 ] && [ "${primeneno:-0}" -ge 1 ]; then
  soobshchit "схема применена (таблиц ${tablic}, миграций ${primeneno})" "ок"
else
  soobshchit "схема применена" "ОТКАЗ (таблиц ${tablic:-0}, миграций ${primeneno:-0})"
  OSHIBKI=$((OSHIBKI + 1))
fi

echo
echo "== 6. Приём обновления чат-ботом"
kod=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST -H 'Content-Type: application/json' -d '{"проверка":true}' \
  "http://localhost:${BOT_PORT}/max/webhook" 2>/dev/null)
if [ "$kod" = "200" ]; then
  soobshchit "чат-бот принимает вебхук" "ок (200)"
else
  soobshchit "чат-бот принимает вебхук" "ОТКАЗ (получен ${kod:-нет ответа})"
  OSHIBKI=$((OSHIBKI + 1))
fi

echo
if [ "$OSHIBKI" -eq 0 ]; then
  echo "Плацдарм развёртывания проверен: отказов нет."
  exit 0
fi

echo "Отказов: $OSHIBKI"
exit 1
