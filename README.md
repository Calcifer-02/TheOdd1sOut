# MAX Productivity Bot - Приложение для управления продуктивностью

![MAX Mini App](https://img.shields.io/badge/MAX-Mini%20App-blue)
![Next.js](https://img.shields.io/badge/Next.js-14.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)

Многофункциональное мини-приложение для управления задачами и продуктивностью, интегрированное в мессенджер MAX.

## Возможности

- Умное управление задачами с Drag&Drop
- AI-анализ психоэмоционального состояния
- Таймеры Pomodoro для фокусировки
- Детальная аналитика и статистика
- Геймификация продуктивности

## 🛠️ Технологический стек

- **Frontend:** Next.js 14, React 18, TypeScript
- **UI:** MAX UI Components, TailwindCSS
- **State Management:** Redux Toolkit, Redux Persist
- **Database:** Supabase (PostgreSQL)
- **AI:** Perplexity AI API
- **Drag&Drop:** @dnd-kit

## Быстрый старт

### Предварительные требования
- Node.js 18+ и npm 9+
- Доступ к MAX API

### 1. Клонирование репозитория
```bash
git clone https://github.com/Calcifer-02/TheOdd1sOut.git
cd TheOdd1sOut
### 2. Установка зависимостей
```bash
npm install
### 3. Настройка переменных окружения
Создайте файл .env.local в корне проекта:

# Supabase PostgreSQL Database
POSTGRES_URL="postgres://postgres.nefhoavveazzidfpobey:WuQz2ebw7OMn5uOv@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x"
POSTGRES_PRISMA_URL="postgres://postgres.nefhoavveazzidfpobey:WuQz2ebw7OMn5uOv@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://postgres.nefhoavveazzidfpobey:WuQz2ebw7OMn5uOv@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
POSTGRES_USER="postgres"
POSTGRES_HOST="db.nefhoavveazzidfpobey.supabase.co"
POSTGRES_PASSWORD="WuQz2ebw7OMn5uOv"
POSTGRES_DATABASE="postgres"

# Supabase API
SUPABASE_URL="https://nefhoavveazzidfpobey.supabase.co"
NEXT_PUBLIC_SUPABASE_URL="https://nefhoavveazzidfpobey.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZmhvYXZ2ZWF6emlkZnBvYmV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1NjA4NjYsImV4cCI6MjA3ODEzNjg2Nn0.4l7j8meVALvDyZbSBGwp3jJxX3LlM1qFAUU-Vnrmw64"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZmhvYXZ2ZWF6emlkZnBvYmV5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjU2MDg2NiwiZXhwIjoyMDc4MTM2ODY2fQ.rslDHw3M6fnyirKg4n1QLNRLVLAhc6hxD8E8Xrc9s6w"
SUPABASE_JWT_SECRET="1ZGSnYvjC3IkXcaWSheP4xP4L8EyAjdEuQKoq1mTGNrI6PU7YQ4sfLMLiAkSUjd/umCwH9OsDMdwxoKLkVIXYA=="

# Perplexity AI (Server-side only, не доступен в браузере)
PERPLEXITY_API_KEY="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"

# Cron Job Secret (для защиты эндпоинта проверки уведомлений)
CRON_SECRET="dev-secret-123"

# MAX API Token (для работы с платформой MAX)
# Получите токен в настройках вашего бота на платформе MAX
NEXT_PUBLIC_MAX_API_TOKEN="your_max_api_token_here"

### 4. Запуск в режиме разработки
```bash
npm run dev
Приложение будет доступно по адресу: http://localhost:3000

🐳 Запуск через Docker
Сборка и запуск контейнера
```bash
# Сборка образа
docker build -t max-productivity-bot .

# Запуск контейнера
docker run -p 3000:3000 \
  --env-file .env.local \
  max-productivity-bot

Использование Docker Compose
```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f app

# Остановка
docker-compose down

Примеры использования
Через командную строку (разработка)
```bash
# Установка и запуск
git clone https://github.com/Calcifer-02/TheOdd1sOut.git
cd TheOdd1sOut
npm install
npm run dev

Через Docker (production)
```bash
# Клонирование и запуска
git clone https://github.com/Calcifer-02/TheOdd1sOut.git
cd TheOdd1sOut

# Запуск через Docker Compose
docker-compose up -d

Проверка работоспособности
После запуска откройте браузер и перейдите по адресу:

http://localhost:3000 - основное приложение


