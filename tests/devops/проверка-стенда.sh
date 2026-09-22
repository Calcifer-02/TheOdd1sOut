#!/bin/sh
# Проверка стенда triadmind.ru: публичный адрес отвечает тем, что обещано
# договором и конфигурацией сдачи.
#
# Проверка фальсифицируема: она падает, если стенд недоступен, просрочен
# сертификат, служба выложена без договора или страницы его просмотра, а также
# если пути договора вне префикса /api начнут возвращать страницу
# мини-приложения вместо честного отказа.
#
# Запуск:  sh tests/devops/проверка-стенда.sh
# Условия трека, разд. 6.2 п. 1 (полный адрес по HTTPS) и п. 5 (DATA-API.yaml).
# Размещение: docs/architecture/ЗАПИСЬ_АРХИТЕКТУРНОГО_РЕШЕНИЯ_ADR-0004.md

set -u

REPO=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPO" || exit 1

# Адрес не зашит в проверку: он берётся из конфигурации сдачи, и разойтись
# с тем, что отдано организаторам, не может.
ADRES=$(sed -n 's/^baseUrl: *//p' DATA-API.yaml | head -1)
if [ -z "$ADRES" ]; then
  echo "В DATA-API.yaml не найден baseUrl — проверять нечего."
  exit 1
fi
UZEL=$(echo "$ADRES" | sed 's|\(https\{0,1\}://[^/]*\).*|\1|')

OSHIBKI=0

soobshchit() {
  printf '%-58s %s\n' "$1" "$2"
}

proverit() {
  # $1 — что проверяем, $2 — ожидаемый код, $3 — ожидаемый тип содержимого
  # (пустая строка — не проверять), $4 — адрес
  otvet=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 20 "$4" 2>/dev/null)
  kod=$(echo "$otvet" | cut -d' ' -f1)
  tip=$(echo "$otvet" | cut -d' ' -f2- | cut -d';' -f1)

  if [ "$kod" != "$2" ]; then
    soobshchit "$1" "ОТКАЗ (ожидался код $2, получен ${kod:-нет ответа})"
    OSHIBKI=$((OSHIBKI + 1))
    return
  fi
  if [ -n "$3" ] && [ "$tip" != "$3" ]; then
    soobshchit "$1" "ОТКАЗ (ожидался тип $3, получен ${tip:-нет})"
    OSHIBKI=$((OSHIBKI + 1))
    return
  fi
  soobshchit "$1" "ок ($kod${3:+, $tip})"
}

echo "Стенд: $ADRES"
echo

echo "== 1. Узел и сертификат"
# Без ключа -k: просроченный или чужой сертификат роняет проверку здесь,
# а не на первом запросе пользователя из платформы MAX.
if curl -s -o /dev/null --max-time 20 "$UZEL/"; then
  soobshchit "сертификат принимается без послаблений" "ок"
else
  soobshchit "сертификат принимается без послаблений" "ОТКАЗ"
  OSHIBKI=$((OSHIBKI + 1))
fi
proverit "мини-приложение отдаётся по корню" 200 "text/html" "$UZEL/"

echo
echo "== 2. Расчётная часть под префиксом /api"
proverit "живость /health" 200 "application/json" "$ADRES/health"
proverit "готовность /ready (видит базу)" 200 "application/json" "$ADRES/ready"
proverit "договор /v1/openapi.yaml" 200 "application/yaml" "$ADRES/v1/openapi.yaml"
proverit "страница Swagger UI" 200 "text/html" "$ADRES/swagger/index.html"

echo
echo "== 3. Ловушка базового адреса закрыта"
# Путь договора без префикса /api обязан отвечать отказом, а не страницей
# мини-приложения с кодом 200: успех с чужим телом — худший вид ошибки.
proverit "путь договора без /api даёт отказ" 404 "application/problem+json" "$UZEL/v1/openapi.yaml"

echo
if [ "$OSHIBKI" -eq 0 ]; then
  echo "Стенд проверен: отказов нет."
  exit 0
fi

echo "Отказов: $OSHIBKI"
exit 1
