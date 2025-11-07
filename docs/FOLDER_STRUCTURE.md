# 📂 Визуализация структуры проекта

## Полная структура папок

```
C:\projects\TheOdd1sOut\
│
├── 📂 .git/                         # Git репозиторий
├── 📂 .idea/                        # IDE настройки
│
├── 📄 .gitignore                    # Игнорируемые файлы
├── 📄 README.md                     # Главная документация
├── 📄 package.json                  # Зависимости проекта (создать)
├── 📄 package-lock.json             # Lock-файл (авто-создается)
├── 📄 next.config.js                # Next.js конфиг (создать)
├── 📄 tailwind.config.js            # Tailwind конфиг (создать)
├── 📄 tsconfig.json                 # TypeScript конфиг (создать)
├── 📄 .eslintrc.json                # ESLint конфиг (создать)
├── 📄 .prettierrc                   # Prettier конфиг (создать)
├── 📄 .env.local                    # Переменные окружения (создать)
├── 📄 .env.example                  # Пример env файла (создать)
│
├── 📂 src/                          ▼ ОСНОВНОЙ КОД ПРИЛОЖЕНИЯ
│   │
│   ├── 📂 app/                      ▼ Next.js App Router
│   │   ├── 📂 api/                  # API routes
│   │   │   └── 📂 [endpoints]/      # Динамические роуты
│   │   │
│   │   ├── 📂 layouts/              # Layout компоненты
│   │   │   ├── 📂 MainLayout/       # Главный layout
│   │   │   ├── 📂 AuthLayout/       # Layout для авторизации
│   │   │   └── 📂 EmptyLayout/      # Пустой layout
│   │   │
│   │   ├── 📄 layout.tsx            # Корневой layout (создать)
│   │   ├── 📄 page.tsx              # Главная страница (создать)
│   │   ├── 📄 globals.css           # Глобальные стили (создать)
│   │   └── 📄 error.tsx             # Error boundary (создать)
│   │
│   ├── 📂 components/               ▼ REACT КОМПОНЕНТЫ
│   │   ├── 📂 ui/                   # UI компоненты
│   │   │   ├── 📂 Button/           # Кнопки
│   │   │   ├── 📂 Card/             # Карточки
│   │   │   ├── 📂 Modal/            # Модальные окна
│   │   │   ├── 📂 Input/            # Поля ввода
│   │   │   ├── 📂 Select/           # Селекты
│   │   │   ├── 📂 Tabs/             # Табы
│   │   │   ├── 📂 Badge/            # Бейджи
│   │   │   └── 📂 Avatar/           # Аватары
│   │   │
│   │   ├── 📂 layout/               # Layout компоненты
│   │   │   ├── 📂 Header/           # Шапка
│   │   │   ├── 📂 Footer/           # Подвал
│   │   │   ├── 📂 Sidebar/          # Боковая панель
│   │   │   └── 📂 Navigation/       # Навигация
│   │   │
│   │   └── 📂 forms/                # Компоненты форм
│   │       ├── 📂 LoginForm/        # Форма входа
│   │       ├── 📂 ProfileForm/      # Форма профиля
│   │       └── 📂 SearchForm/       # Форма поиска
│   │
│   ├── 📂 features/                 ▼ ФИЧИ (Feature-Sliced Design)
│   │   ├── 📂 auth/                 # Авторизация
│   │   │   ├── 📂 components/       # Компоненты фичи
│   │   │   ├── 📂 hooks/            # Хуки фичи
│   │   │   ├── 📂 services/         # Сервисы фичи
│   │   │   ├── 📂 types/            # Типы фичи
│   │   │   └── 📄 HomeIcon.tsx          # Публичный API
│   │   │
│   │   ├── 📂 accessibility/        # Функции доступности
│   │   │   ├── 📂 components/       # VoiceControl, TextSize, etc.
│   │   │   ├── 📂 hooks/            # useVoice, useAccessibility
│   │   │   └── 📄 HomeIcon.tsx
│   │   │
│   │   ├── 📂 profile/              # Профиль пользователя
│   │   │   ├── 📂 components/       # ProfileCard, EditProfile
│   │   │   ├── 📂 hooks/            # useProfile
│   │   │   └── 📄 HomeIcon.tsx
│   │   │
│   │   ├── 📂 chat/                 # Чат функционал
│   │   │   ├── 📂 components/       # ChatList, Message
│   │   │   ├── 📂 hooks/            # useChat
│   │   │   └── 📄 HomeIcon.tsx
│   │   │
│   │   └── 📂 notifications/        # Уведомления
│   │       ├── 📂 components/       # NotificationBell
│   │       ├── 📂 hooks/            # useNotifications
│   │       └── 📄 HomeIcon.tsx
│   │
│   ├── 📂 shared/                   ▼ ПЕРЕИСПОЛЬЗУЕМЫЕ РЕСУРСЫ
│   │   ├── 📂 ui/                   # Базовые UI компоненты
│   │   │   ├── 📄 Button.tsx        # Базовая кнопка
│   │   │   ├── 📄 Input.tsx         # Базовый input
│   │   │   └── 📄 Spinner.tsx       # Loader
│   │   │
│   │   ├── 📂 assets/               # Медиа файлы
│   │   │   ├── 📂 images/           # Изображения
│   │   │   │   ├── logo.svg
│   │   │   │   └── placeholder.png
│   │   │   │
│   │   │   ├── 📂 icons/            # SVG иконки
│   │   │   │   ├── heart.svg
│   │   │   │   └── star.svg
│   │   │   │
│   │   │   └── 📂 fonts/            # Шрифты
│   │   │       └── custom-font.woff2
│   │   │
│   │   └── 📂 constants/            # Константы
│   │       ├── 📄 routes.ts         # Роуты приложения
│   │       ├── 📄 config.ts         # Конфиги
│   │       └── 📄 messages.ts       # Текстовые константы
│   │
│   ├── 📂 lib/                      ▼ БИБЛИОТЕКИ И ИХ НАСТРОЙКА
│   │   ├── 📄 vkBridge.ts           # VK Bridge setup
│   │   ├── 📄 axios.ts              # Axios instance
│   │   ├── 📄 queryClient.ts        # React Query client
│   │   └── 📄 antdTheme.ts          # Ant Design theme
│   │
│   ├── 📂 hooks/                    ▼ CUSTOM HOOKS
│   │   ├── 📄 useAuth.ts            # Хук авторизации
│   │   ├── 📄 useVKBridge.ts        # Хук VK Bridge
│   │   ├── 📄 useAccessibility.ts   # Хук доступности
│   │   ├── 📄 useMediaQuery.ts      # Responsive hook
│   │   └── 📄 useLocalStorage.ts    # LocalStorage hook
│   │
│   ├── 📂 store/                    ▼ ZUSTAND STORES
│   │   ├── 📄 userStore.ts          # Store пользователя
│   │   ├── 📄 appStore.ts           # Store приложения
│   │   └── 📄 HomeIcon.tsx              # Экспорт всех stores
│   │
│   ├── 📂 types/                    ▼ TYPESCRIPT ТИПЫ
│   │   ├── 📄 global.d.ts           # Глобальные типы
│   │   ├── 📄 api.types.ts          # API типы
│   │   ├── 📄 user.types.ts         # Типы пользователя
│   │   └── 📄 vk.types.ts           # VK типы
│   │
│   ├── 📂 config/                   ▼ КОНФИГУРАЦИЯ
│   │   ├── 📄 env.ts                # Env переменные
│   │   ├── 📄 api.config.ts         # API конфиг
│   │   └── 📄 features.config.ts    # Feature flags
│   │
│   ├── 📂 styles/                   ▼ ГЛОБАЛЬНЫЕ СТИЛИ
│   │   ├── 📄 globals.css           # Глобальные стили
│   │   ├── 📄 variables.css         # CSS переменные
│   │   └── 📄 theme.css             # Тема приложения
│   │
│   ├── 📂 services/                 ▼ СЕРВИСЫ И API
│   │   ├── 📄 authService.ts        # Сервис авторизации
│   │   ├── 📄 apiService.ts         # Главный API сервис
│   │   ├── 📄 vkService.ts          # VK API сервис
│   │   └── 📄 storageService.ts     # VK Storage сервис
│   │
│   └── 📂 utils/                    ▼ УТИЛИТЫ
│       ├── 📄 formatters.ts         # Форматирование данных
│       ├── 📄 validators.ts         # Валидация
│       ├── 📄 helpers.ts            # Вспомогательные функции
│       └── 📄 constants.ts          # Утилитарные константы
│
├── 📂 public/                       ▼ СТАТИЧЕСКИЕ ФАЙЛЫ
│   ├── 📂 images/                   # Публичные изображения
│   │   ├── og-image.png             # Open Graph изображение
│   │   └── hero.jpg                 # Главное изображение
│   │
│   ├── 📂 icons/                    # Публичные иконки
│   │   ├── favicon.ico              # Фавикон
│   │   ├── icon-192.png             # PWA иконка 192
│   │   └── icon-512.png             # PWA иконка 512
│   │
│   ├── 📂 fonts/                    # Публичные шрифты
│   │   └── roboto.woff2
│   │
│   ├── 📂 locales/                  # i18n переводы
│   │   ├── 📄 ru.json               # Русский
│   │   └── 📄 en.json               # Английский
│   │
│   ├── 📄 manifest.json             # PWA manifest (опционально)
│   └── 📄 robots.txt                # SEO robots
│
├── 📂 docker/                       ▼ DOCKER КОНФИГУРАЦИЯ
│   ├── 📄 Dockerfile                # Docker образ (создать)
│   ├── 📄 docker-compose.yml        # Compose config (создать)
│   ├── 📄 .dockerignore             # Игнорируемые файлы (создать)
│   └── 📄 nginx.conf                # Nginx конфиг (создать)
│
├── 📂 docs/                         ▼ ДОКУМЕНТАЦИЯ
│   ├── 📄 PROJECT_STRUCTURE.md      # Структура проекта ✅
│   ├── 📄 TECH_STACK.md             # Технологический стек ✅
│   ├── 📄 GETTING_STARTED.md        # Быстрый старт ✅
│   ├── 📄 API.md                    # API документация (создать)
│   ├── 📄 DEPLOYMENT.md             # Деплой инструкции (создать)
│   └── 📄 CONTRIBUTING.md           # Гайд для контрибьюторов (создать)
│
├── 📂 scripts/                      ▼ СКРИПТЫ АВТОМАТИЗАЦИИ
│   ├── 📄 build.sh                  # Скрипт сборки
│   ├── 📄 deploy.sh                 # Скрипт деплоя
│   └── 📄 seed.ts                   # Заполнение тестовыми данными
│
└── 📂 tests/                        ▼ ТЕСТЫ
    ├── 📂 unit/                     # Unit тесты
    │   ├── 📂 components/           # Тесты компонентов
    │   ├── 📂 hooks/                # Тесты hooks
    │   └── 📂 utils/                # Тесты утилит
    │
    ├── 📂 integration/              # Integration тесты
    │   ├── 📂 api/                  # API тесты
    │   └── 📂 features/             # Тесты фич
    │
    └── 📂 e2e/                      # End-to-end тесты
        ├── 📄 auth.spec.ts          # E2E авторизации
        └── 📄 main-flow.spec.ts     # Главный флоу
```

---

## 📊 Статистика структуры

### Созданные папки: 36
- ✅ **Корневые директории**: 6 (src, public, docker, docs, scripts, tests)
- ✅ **src/** поддиректории: 12
- ✅ **Вложенные папки**: 18

### Созданные файлы: 4
- ✅ **README.md** - Главная документация
- ✅ **docs/PROJECT_STRUCTURE.md** - Детальная структура
- ✅ **docs/TECH_STACK.md** - Технологический стек
- ✅ **docs/GETTING_STARTED.md** - Пошаговая инструкция
- ✅ **.gitignore** - Git ignore файл
- ✅ **docs/FOLDER_STRUCTURE.md** - Визуализация (этот файл)

---

## 🎯 Файлы для создания на следующем этапе

### Конфигурационные файлы (7 файлов):
1. `package.json` - Зависимости проекта
2. `next.config.js` - Next.js конфигурация
3. `tailwind.config.js` - Tailwind CSS конфигурация
4. `tsconfig.json` - TypeScript конфигурация
5. `.eslintrc.json` - ESLint правила
6. `.prettierrc` - Prettier настройки
7. `.env.local` - Переменные окружения

### Базовые файлы приложения (5 файлов):
8. `src/app/layout.tsx` - Корневой layout
9. `src/app/page.tsx` - Главная страница
10. `src/app/globals.css` - Глобальные стили
11. `src/lib/vkBridge.ts` - VK Bridge setup
12. `src/store/userStore.ts` - User store

### Docker (3 файла):
13. `docker/Dockerfile` - Docker образ
14. `docker/docker-compose.yml` - Docker Compose
15. `docker/.dockerignore` - Docker ignore

---

## 🚀 Готовность проекта

| Этап                          | Статус | Прогресс |
|-------------------------------|--------|----------|
| 📂 Структура папок            | ✅     | 100%     |
| 📄 Документация               | ✅     | 100%     |
| ⚙️ Конфигурация               | ⏳     | 0%       |
| 📦 Установка зависимостей     | ⏳     | 0%       |
| 💻 Базовый код                | ⏳     | 0%       |
| 🎨 UI компоненты              | ⏳     | 0%       |
| 🔗 VK интеграция              | ⏳     | 0%       |
| 🐳 Docker                     | ⏳     | 0%       |
| 🧪 Тесты                      | ⏳     | 0%       |

**Общий прогресс: 20%** ✅

---

## 📝 Примечания

### Преимущества выбранной структуры:

1. **Масштабируемость** - легко добавлять новые фичи
2. **Модульность** - каждая фича изолирована
3. **Переиспользование** - shared компоненты доступны везде
4. **Типобезопасность** - централизованные типы
5. **Тестируемость** - четкое разделение логики

### Feature-Sliced Design принципы:

```
features/
└── auth/
    ├── components/    # UI компоненты фичи
    ├── hooks/         # Хуки фичи
    ├── services/      # API сервисы фичи
    ├── types/         # Типы фичи
    └── HomeIcon.tsx       # Публичный API (что экспортируется)
```

Каждая фича - это **независимый модуль** с собственной логикой.

---

**Структура готова к разработке! 🎉**

_Дата создания: 5 ноября 2025_
_Следующий шаг: Инициализация Next.js и установка зависимостей_

