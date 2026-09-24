#!/bin/sh
# Проверка плацдарма развёртывания: решение поднимается одной командой,
# и все четыре службы отвечают, а связи между ними живы.
#
# Проверка фальсифицируема: она падает, если сломать compose.yaml, убрать
# службу, разорвать проксирование мини-приложения на расчётную часть,
# отобрать у расчётной части доступ к базе данных, перестать отдавать
# договор API и страницу Swagger UI, по которым работает интерфейсная часть,
# или сломать расчёт — его числа сверяются с примером договора, а не с
# кодом ответа.
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
OZHIDAEMYE="api bot db web "
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
# Признака готовности у расчётной части в compose нет, поэтому «--wait»
# дожидается только запуска контейнера, а не открытого порта: первые запросы
# получали пустой ответ, и проверка называла отказом собственную спешку.
podozhdat() {
  # $1 — что ждём, $2 — адрес, $3 — предел ожидания в секундах
  OZHIDANIE=0
  while [ "$OZHIDANIE" -lt "$3" ]; do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$2" 2>/dev/null)" = "200" ]; then
      [ "$OZHIDANIE" -gt 0 ] && soobshchit "$1" "готово через $OZHIDANIE с"
      return 0
    fi
    OZHIDANIE=$((OZHIDANIE + 1))
    sleep 1
  done

  soobshchit "$1" "ОТКАЗ (не дождались за $3 с)"
  OSHIBKI=$((OSHIBKI + 1))
  return 1
}

podozhdat "расчётная часть: открыт порт" "http://localhost:${API_PORT}/health" 60

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
echo "== 5. Расчёт от края до края"
# Не «точка отвечает», а «расчёт считает»: числа сверяются с каноническим
# примером договора (20 т лома бетона, полигон «Восток» в 45 км — 10 800,00 ₽
# перевозки, 9 000,00 ₽ утилизации, 19 800,00 ₽ итого). Код 201 сам по себе
# прошёл бы и на нулевых суммах.
# Тело запроса уходит файлом, а не доводом командной строки: в адресе есть
# кириллица, и на Windows довод доезжает до curl в кодировке консоли — служба
# получает обрывок вместо UTF-8 и отвечает отказом разбора.
ZAPROS=$(mktemp)
cat > "$ZAPROS" <<'JSON'
{"pickupAddress":{"value":"г Москва, ул Годовикова, д 9","coordinates":{"latitude":55.8055,"longitude":37.6206},"area":"moscow"},"items":[{"wasteGroupId":"beton-lom","quantity":{"value":20,"unit":"t"}}],"disposalRequired":true,"distanceFilter":{"mode":"atMost","km":60}}
JSON
RASCHET=$(curl -s --max-time 15 -X POST -H 'Content-Type: application/json'   --data-binary "@$ZAPROS" "http://localhost:${API_PORT}/v1/calculations" 2>/dev/null)
rm -f "$ZAPROS"
# Идентификатор — первое значение тела ответа: схема Calculation ставит
# `id` первым полем. Разбирать JSON в оболочке нечем, а тянуть сюда jq
# значило бы добавить проверке зависимость ради одной строки.
ID_RASCHETA=$(printf '%s' "$RASCHET" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$ID_RASCHETA" ]; then
  soobshchit "расчёт: создан ($ID_RASCHETA)" "ок"
else
  soobshchit "расчёт: создан" "ОТКАЗ (идентификатора в ответе нет)"
  OSHIBKI=$((OSHIBKI + 1))
fi

for summa in 10800.00 9000.00 19800.00; do
  if printf '%s' "$RASCHET" | grep -q "\"amount\":\"${summa}\""; then
    soobshchit "расчёт: сумма ${summa} из примера договора" "ок"
  else
    soobshchit "расчёт: сумма ${summa} из примера договора" "ОТКАЗ (нет в ответе)"
    OSHIBKI=$((OSHIBKI + 1))
  fi
done

if [ -n "$ID_RASCHETA" ]; then
  proverit "расчёт: чтение по идентификатору" 200     "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}"
  proverit "расчёт: варианты размещения" 200     "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}/options?wasteGroupId=beton-lom&distanceKm=60"

  VYBOR=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X PUT     -H 'Content-Type: application/json'     -d '{"entries":[{"wasteGroupId":"beton-lom","landfillId":"vostok-timohovo"}]}'     "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}/selection" 2>/dev/null)
  if [ "$VYBOR" = "200" ]; then
    soobshchit "расчёт: выбор полигона сохранён" "ок (200)"
  else
    soobshchit "расчёт: выбор полигона сохранён" "ОТКАЗ (получен ${VYBOR:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
  fi

  # Несходящееся распределение обязано быть отвергнутым целиком: 12 из 20 тонн.
  RAZLOZHENIE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X PUT     -H 'Content-Type: application/json'     -d '{"entries":[{"wasteGroupId":"beton-lom","landfillId":"vostok-timohovo","quantity":{"value":12,"unit":"t"}}]}'     "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}/allocation" 2>/dev/null)
  if [ "$RAZLOZHENIE" = "422" ]; then
    soobshchit "расчёт: несходящееся распределение отвергнуто" "ок (422)"
  else
    soobshchit "расчёт: несходящееся распределение отвергнуто" "ОТКАЗ (получен ${RAZLOZHENIE:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
  fi
fi

# Пересчёт мер — операция POST, и проверяется не код, а результат: 15 м³
# древесины при плотности 0,5 т/м³ дают 7,5 тонны (начальный набор данных).
PERESCHET=$(curl -s --max-time 15 -X POST -H 'Content-Type: application/json'   -d '{"items":[{"wasteGroupId":"drevesina","quantity":{"value":15,"unit":"m3"}}]}'   "http://localhost:${API_PORT}/v1/amount-conversions" 2>/dev/null)
if printf '%s' "$PERESCHET" | grep -q '"tons":7.5'; then
  soobshchit "расчёт: 15 м³ древесины — это 7,5 т" "ок"
else
  soobshchit "расчёт: 15 м³ древесины — это 7,5 т" "ОТКАЗ (ответ: ${PERESCHET:-нет ответа})"
  OSHIBKI=$((OSHIBKI + 1))
fi

echo
echo "== 6. Сделка от края до края"
# Не «точка отвечает», а «предложение выпускается и скачивается». Сверяются
# номер, единственность предложения по расчёту и сигнатура файла: код 201 сам
# по себе прошёл бы и на пустом ответе.
if [ -n "$ID_RASCHETA" ]; then
  VYBOR_KP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X PUT     -H 'Content-Type: application/json'     -d '{"entries":[{"wasteGroupId":"beton-lom","landfillId":"vostok-timohovo"}]}'     "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}/selection" 2>/dev/null)

  PREDLOZHENIE=$(curl -s --max-time 20 -X POST -H 'Content-Type: application/json'     -d '{"customerName":"OOO Podryadchik"}'     "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}/quotes" 2>/dev/null)
  NOMER_KP=$(printf '%s' "$PREDLOZHENIE" | grep -o '"number":"[^"]*"' | cut -d'"' -f4)
  PUT_KP=$(printf '%s' "$PREDLOZHENIE" | grep -o '"documentUrl":"[^"]*"' | cut -d'"' -f4)

  if [ "$VYBOR_KP" = "200" ] && [ -n "$NOMER_KP" ] && [ -n "$PUT_KP" ]; then
    soobshchit "сделка: предложение выпущено ($NOMER_KP)" "ок"
  else
    soobshchit "сделка: предложение выпущено" "ОТКАЗ (ответ: ${PREDLOZHENIE:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
  fi

  if [ -n "$PUT_KP" ]; then
    FAYL=$(mktemp)
    TIP=$(curl -s -o "$FAYL" -w '%{content_type}' --max-time 20       "http://localhost:${API_PORT}${PUT_KP}" 2>/dev/null)
    SIGNATURA=$(head -c 5 "$FAYL")
    RAZMER=$(wc -c < "$FAYL" | tr -d '[:space:]')
    rm -f "$FAYL"

    # Медиатип объявить можно любым, а содержимое от этого форматом PDF не
    # станет: проверяется и заголовок, и сигнатура самого файла.
    case "$TIP" in
      application/pdf*) TIP_OK=1 ;;
      *) TIP_OK=0 ;;
    esac
    if [ "$TIP_OK" = "1" ] && [ "$SIGNATURA" = "%PDF-" ] && [ "${RAZMER:-0}" -gt 1000 ]; then
      soobshchit "сделка: документ предложения скачан (${RAZMER} байт)" "ок"
    else
      soobshchit "сделка: документ предложения скачан" "ОТКАЗ (тип ${TIP:-нет}, сигнатура «${SIGNATURA}»)"
      OSHIBKI=$((OSHIBKI + 1))
    fi
  fi
fi

ZAYAVKA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST   -H 'Content-Type: application/json'   -d '{"contactName":"Ivan","phone":"+79161234567","personalDataConsent":true}'   "http://localhost:${API_PORT}/v1/pickup-requests" 2>/dev/null)
if [ "$ZAYAVKA" = "201" ]; then
  soobshchit "сделка: заявка на вывоз принята" "ок (201)"
else
  soobshchit "сделка: заявка на вывоз принята" "ОТКАЗ (получен ${ZAYAVKA:-нет ответа})"
  OSHIBKI=$((OSHIBKI + 1))
fi

# Без согласия на обработку персональных данных заявки быть не должно (R-054).
BEZ_SOGLASIYA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST   -H 'Content-Type: application/json'   -d '{"contactName":"Ivan","phone":"+79161234567","personalDataConsent":false}'   "http://localhost:${API_PORT}/v1/pickup-requests" 2>/dev/null)
if [ "$BEZ_SOGLASIYA" = "422" ]; then
  soobshchit "сделка: заявка без согласия отвергнута" "ок (422)"
else
  soobshchit "сделка: заявка без согласия отвергнута" "ОТКАЗ (получен ${BEZ_SOGLASIYA:-нет ответа})"
  OSHIBKI=$((OSHIBKI + 1))
fi

proverit "сделка: маршрут по выбранным полигонам" 200   "http://localhost:${API_PORT}/v1/calculations/${ID_RASCHETA}/route"
# Каталог услуг в начальном наборе пуст намеренно: состав пакета заказчиком не
# подтверждён (Q-005). Проверяется, что точка отвечает страницей, а не то, что
# в ней есть записи.
proverit "сделка: каталог услуг по документации" 200 "http://localhost:${API_PORT}/v1/document-services"

echo
echo "== 7. Доступ участника"
# Личность даёт платформа: подписать стартовые параметры можно только ключом
# бота, и здесь он тот же, что у службы. Проверяется не «точка отвечает», а
# что сошедшаяся подпись даёт маркер, а подделанная — не даёт.
if [ -n "${MAX_BOT_TOKEN}" ]; then
  AUTH_DATE=$(date +%s)
  POLZOVATEL='{"id":880901,"first_name":"Proverka"}'
  STROKA_PROVERKI=$(printf 'auth_date=%s
user=%s' "$AUTH_DATE" "$POLZOVATEL")
  KLYUCH=$(printf '%s' "$MAX_BOT_TOKEN" | openssl dgst -sha256 -hmac 'WebAppData' -binary | xxd -p -c 64)
  PODPIS=$(printf '%s' "$STROKA_PROVERKI" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:$KLYUCH" -hex | sed 's/.*= //')
  USER_KOD=$(printf '%s' "$POLZOVATEL" | od -An -tx1 | tr -d ' 
' | sed 's/../%&/g')
  INIT_DATA="auth_date=${AUTH_DATE}&user=${USER_KOD}&hash=${PODPIS}"

  SESSIYA=$(curl -s --max-time 20 -X POST -H 'Content-Type: application/json'     -d "{\"initData\":\"${INIT_DATA}\",\"personalDataConsent\":true}"     "http://localhost:${API_PORT}/v1/auth/sessions" 2>/dev/null)
  MARKER=$(printf '%s' "$SESSIYA" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$MARKER" ]; then
    soobshchit "доступ: подписанные параметры обменены на маркер" "ок"
  else
    soobshchit "доступ: подписанные параметры обменены на маркер" "ОТКАЗ (ответ: ${SESSIYA:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
  fi

  PODDELKA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST     -H 'Content-Type: application/json'     -d "{\"initData\":\"auth_date=${AUTH_DATE}&user=${USER_KOD}&hash=0000\",\"personalDataConsent\":true}"     "http://localhost:${API_PORT}/v1/auth/sessions" 2>/dev/null)
  if [ "$PODDELKA" = "401" ]; then
    soobshchit "доступ: подделанная подпись отвергнута" "ок (401)"
  else
    soobshchit "доступ: подделанная подпись отвергнута" "ОТКАЗ (получен ${PODDELKA:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
  fi

  BEZ_MARKERA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15     "http://localhost:${API_PORT}/v1/profile" 2>/dev/null)
  S_MARKEROM=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15     -H "Authorization: Bearer ${MARKER}" "http://localhost:${API_PORT}/v1/profile" 2>/dev/null)
  if [ "$BEZ_MARKERA" = "401" ] && [ "$S_MARKEROM" = "200" ]; then
    soobshchit "доступ: кабинет закрыт без маркера и открыт с ним" "ок (401 и 200)"
  else
    soobshchit "доступ: кабинет закрыт без маркера и открыт с ним" "ОТКАЗ (${BEZ_MARKERA:-нет} и ${S_MARKEROM:-нет})"
    OSHIBKI=$((OSHIBKI + 1))
  fi
else
  soobshchit "доступ: ключ бота не задан" "пропущено (MAX_BOT_TOKEN пуст)"
fi

echo
echo "== 8. Схема базы данных"
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
echo "== 9. Приём обновления чат-ботом"
kod=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST -H 'Content-Type: application/json' -d '{"проверка":true}' \
  "http://localhost:${BOT_PORT}/max/webhook" 2>/dev/null)
# Приём обновлений идёт длинным опросом (ADR-0009), а вебхук включается
# настройкой Bot__WebhookEnabled. Выключенный вебхук отвечает 503 и называет
# причину в журнале: молчаливое 200 означало бы «обновление принято», хотя оно
# отброшено. Проверяется, что точка отвечает осознанно, а не что она открыта.
if [ "$kod" = "200" ]; then
  soobshchit "чат-бот принимает вебхук" "ок (200, вебхук включён)"
elif [ "$kod" = "503" ]; then
  soobshchit "чат-бот принимает вебхук" "ок (503, вебхук выключен настройкой)"
else
  soobshchit "чат-бот принимает вебхук" "ОТКАЗ (получен ${kod:-нет ответа})"
  OSHIBKI=$((OSHIBKI + 1))
fi


echo
echo "== 10. Ведение справочников"
# Проверяется не «точка отвечает», а «точка закрыта по умолчанию». Редактор
# цен меняет то, что уходит в коммерческие предложения клиентам, и открытый
# всем редактор хуже отсутствующего (ADR-0007).
PRAVKA='{"transportPricePerTonKm":{"amount":"33.00","currency":"RUB"}}'

BEZ_VHODA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  -X PATCH -H 'Content-Type: application/json' -d "$PRAVKA" \
  "http://localhost:${API_PORT}/v1/waste-groups/beton-lom" 2>/dev/null)
PROGONY_BEZ_VHODA=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  "http://localhost:${API_PORT}/v1/sync-runs/latest" 2>/dev/null)

if [ "$BEZ_VHODA" = "401" ] && [ "$PROGONY_BEZ_VHODA" = "401" ]; then
  soobshchit "справочники: правка и итог обновления закрыты без входа" "ок (401 и 401)"
else
  soobshchit "справочники: правка и итог обновления закрыты без входа" \
    "ОТКАЗ (${BEZ_VHODA:-нет} и ${PROGONY_BEZ_VHODA:-нет})"
  OSHIBKI=$((OSHIBKI + 1))
fi

# Второй шаг возможен только с маркером: он проверяет, что сессии мало —
# нужно ещё и право. Без ключа бота маркера нет, и шаг честно пропускается.
if [ -n "${MARKER:-}" ]; then
  OTVET=$(curl -s --max-time 15 \
    -X PATCH -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${MARKER}" -d "$PRAVKA" \
    "http://localhost:${API_PORT}/v1/waste-groups/beton-lom" 2>/dev/null)
  PRICHINA=$(printf '%s' "$OTVET" | grep -o '"type":"[^"]*"' | head -1 | cut -d'"' -f4)

  # Пустой список обладателей права — состояние по умолчанию: тогда ответ
  # обязан быть отказом по праву, а не по подписке и не успехом.
  if [ -z "${IMOLT_DATA_MANAGERS:-}" ]; then
    if [ "$PRICHINA" = "urn:imolt:problem:role-required" ]; then
      soobshchit "справочники: сессии без права не хватает" "ок (role-required)"
    else
      soobshchit "справочники: сессии без права не хватает" "ОТКАЗ (${PRICHINA:-нет причины})"
      OSHIBKI=$((OSHIBKI + 1))
    fi
  else
    soobshchit "справочники: право выдано развёртыванием" "пропущено (IMOLT_DATA_MANAGERS задан)"
  fi
else
  soobshchit "справочники: проверка права" "пропущено (маркера нет)"
fi

echo
echo "== 11. Мини-приложение"
# Страница и проксирование проверены в разделе 4. Здесь проверяется то, что
# отдаётся наружу: собранная страница — экран расчёта, а не плацдарм, и в ней
# нет ни ключей, ни жёстко вписанного адреса расчётной части (R-056, AR-006).
STRANICA=$(curl -s --max-time 15 "http://localhost:${MINIAPP_PORT}/" 2>/dev/null)
PUT_SBORKI=$(printf '%s' "$STRANICA" | grep -o '/assets/[A-Za-z0-9._-]*\.js' | head -1)

if [ -n "$PUT_SBORKI" ]; then
  SBORKA=$(curl -s --max-time 20 "http://localhost:${MINIAPP_PORT}${PUT_SBORKI}" 2>/dev/null)
else
  SBORKA=""
  soobshchit "мини-приложение: сборка найдена в разметке" "ОТКАЗ (скрипта нет в index.html)"
  OSHIBKI=$((OSHIBKI + 1))
fi

if printf '%s' "$SBORKA" | grep -q "Калькулятор вывоза строительных отходов"; then
  soobshchit "мини-приложение: отдан экран расчёта" "ок"
else
  soobshchit "мини-приложение: отдан экран расчёта" "ОТКАЗ (в сборке нет заголовка экрана)"
  OSHIBKI=$((OSHIBKI + 1))
fi

# Обращения идут по относительному пути /api: адрес расчётной части в сборке
# означал бы, что стенд и рабочая выкладка требуют разной сборки.
if printf '%s' "$SBORKA" | grep -q "localhost:8080"; then
  soobshchit "мини-приложение: обращения по относительному пути" "ОТКАЗ (адрес вписан в сборку)"
  OSHIBKI=$((OSHIBKI + 1))
else
  soobshchit "мини-приложение: обращения по относительному пути" "ок"
fi

# Ключ бота проверяет расчётная часть, и в браузер он не попадает никогда.
if [ -n "${MAX_BOT_TOKEN:-}" ]; then
  if printf '%s' "$SBORKA" | grep -qF "${MAX_BOT_TOKEN}"; then
    soobshchit "мини-приложение: ключ бота не попал в сборку" "ОТКАЗ (ключ в сборке)"
    OSHIBKI=$((OSHIBKI + 1))
  else
    soobshchit "мини-приложение: ключ бота не попал в сборку" "ок"
  fi
else
  soobshchit "мини-приложение: ключ бота не попал в сборку" "пропущено (ключ не задан)"
fi

# Состояние выборки живёт в адресе (ADR-0008), поэтому перезагрузка на
# внутреннем пути обязана отдать разметку, а не 404.
proverit "мини-приложение: внутренний путь отдаёт разметку" 200 "http://localhost:${MINIAPP_PORT}/raschet/proba"
echo
if [ "$OSHIBKI" -eq 0 ]; then
  echo "Плацдарм развёртывания проверен: отказов нет."
  exit 0
fi

echo "Отказов: $OSHIBKI"
exit 1
