# 🚀 Пошаговая инструкция для запуска проекта

## ✅ Что уже сделано

1. ✅ Создана структура папок проекта (36 директорий)
2. ✅ Подготовлена документация:
   - README.md - обзор проекта
   - PROJECT_STRUCTURE.md - детальное описание структуры
   - TECH_STACK.md - технологии и зависимости

## 📋 Следующие шаги (в порядке выполнения)

### Шаг 1: Инициализация Next.js проекта

```bash
# Перейти в директорию проекта
cd C:\projects\TheOdd1sOut

# Установить Next.js (выбрать опции как ниже)
npx create-next-app@latest . --typescript --tailwind --app

# При установке выбрать:
# ✔ Would you like to use TypeScript? … Yes
# ✔ Would you like to use ESLint? … Yes
# ✔ Would you like to use Tailwind CSS? … Yes
# ✔ Would you like to use `src/` directory? … Yes (но мы уже создали)
# ✔ Would you like to use App Router? … Yes
# ✔ Would you like to customize the default import alias? … No
```

**Важно:** Если спросит про перезапись существующих папок - согласитесь, наша структура уже готова.

---

### Шаг 2: Установка основных зависимостей

```bash
# UI библиотеки
npm install antd @ant-design/icons
npm install @vkontakte/vk-bridge @vkontakte/vkui @vkontakte/icons

# State management и data fetching
npm install zustand @tanstack/react-query axios

# Forms и validation
npm install react-hook-form zod @hookform/resolvers

# Утилиты
npm install clsx dayjs lodash nanoid

# Type definitions
npm install -D @types/lodash
```

---

### Шаг 3: Установка dev зависимостей

```bash
# Тестирование
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D @playwright/test

# Code quality
npm install -D prettier prettier-plugin-tailwindcss eslint-config-prettier
```

---

### Шаг 4: Создание конфигурационных файлов

#### 4.1 Создать `.env.local`

```env
# VK App Configuration
NEXT_PUBLIC_VK_APP_ID=your_vk_app_id_here

# API URLs
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Environment
NODE_ENV=development
```

#### 4.2 Обновить `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['antd', '@vkontakte/vkui'],
  images: {
    domains: ['vk.com', 'sun9-*.userapi.com'],
  },
}

module.exports = nextConfig
```

#### 4.3 Обновить `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vk: {
          blue: '#0077FF',
          lightBlue: '#4986CC',
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Для совместимости с Ant Design
  },
}
```

#### 4.4 Обновить `tsconfig.json` - добавить path aliases

```json
{
  "compilerOptions": {
    // ...существующие настройки...
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/store/*": ["./src/store/*"],
      "@/types/*": ["./src/types/*"],
      "@/utils/*": ["./src/utils/*"],
      "@/services/*": ["./src/services/*"]
    }
  }
}
```

#### 4.5 Создать `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

---

### Шаг 5: Создание базовой структуры кода

#### 5.1 Настройка VK Bridge (`src/lib/vkBridge.ts`)

```typescript
import bridge from '@vkontakte/vk-bridge';

export const initVKBridge = async () => {
  try {
    await bridge.send('VKWebAppInit');
    console.log('VK Bridge initialized');
  } catch (error) {
    console.error('VK Bridge init error:', error);
  }
};

export default bridge;
```

#### 5.2 Создание Zustand store (`src/store/userStore.ts`)

```typescript
import { create } from 'zustand';

interface UserState {
  user: any | null;
  setUser: (user: any) => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

#### 5.3 Настройка React Query (`src/lib/queryClient.ts`)

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

#### 5.4 Создание главного layout (`src/app/layout.tsx`)

```typescript
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
```

---

### Шаг 6: Создание первого компонента

#### 6.1 Создать базовую кнопку (`src/components/ui/Button.tsx`)

```typescript
import { Button as AntButton, ButtonProps } from 'antd';
import clsx from 'clsx';

export const Button = ({ className, ...props }: ButtonProps) => {
  return <AntButton className={clsx('shadow-sm', className)} {...props} />;
};
```

---

### Шаг 7: Docker настройка

#### 7.1 Создать `docker/Dockerfile`

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "server.js"]
```

#### 7.2 Создать `docker-compose.yml`

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

---

### Шаг 8: Запуск проекта

```bash
# Запустить dev сервер
npm run dev

# Открыть браузер
# http://localhost:3000
```

---

## 🎯 Чек-лист для хакатона

### До 15 ноября (конец онлайн-тура):
- [ ] Базовая настройка проекта
- [ ] Интеграция с VK Bridge
- [ ] Авторизация через VK
- [ ] Основная фича приложения (социальная направленность)
- [ ] UI/UX дизайн
- [ ] Адаптивная верстка
- [ ] Docker образ готов
- [ ] Деплой (Vercel/VK Hosting)

### До 24 ноября (подготовка к финалу):
- [ ] Рефакторинг кода
- [ ] Оптимизация производительности
- [ ] Тестирование
- [ ] Документация API
- [ ] Презентация (слайды)
- [ ] Видео-демо (опционально)

### 30 ноября (финал):
- [ ] Питч-презентация (3-5 минут)
- [ ] Демо приложения
- [ ] Ответы на вопросы жюри

---

