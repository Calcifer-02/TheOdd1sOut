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
- Аккаунт в Supabase
- API ключ Perplexity AI
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

# Supabase Database
POSTGRES_URL="your_postgres_url"
POSTGRES_PRISMA_URL="your_prisma_url"
POSTGRES_URL_NON_POOLING="your_non_pooling_url"
POSTGRES_USER="your_username"
POSTGRES_HOST="your_db_host"
POSTGRES_PASSWORD="your_password"
POSTGRES_DATABASE="postgres"

# Supabase API
SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
SUPABASE_JWT_SECRET="your_jwt_secret"

# AI Services
PERPLEXITY_API_KEY="your_perplexity_key"

# Security
CRON_SECRET="your_cron_secret"
NEXT_PUBLIC_MAX_API_TOKEN="your_max_token"

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

# Копирование примера переменных окружения
cp .env.example .env.local
# Отредактируйте .env.local с вашими значениями

# Запуск через Docker Compose
docker-compose up -d

Проверка работоспособности
После запуска откройте браузер и перейдите по адресу:

http://localhost:3000 - основное приложение
