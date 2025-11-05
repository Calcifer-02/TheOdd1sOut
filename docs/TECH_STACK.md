# Технологический стек мини-приложения для MAX

## 🔧 Core Dependencies

### Framework & Runtime
```json
"dependencies": {
  "next": "^14.0.4",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.3.3"
}
```

### UI Libraries
```json
"dependencies": {
  "antd": "^5.12.0",
  "tailwindcss": "^3.3.6",
  "@vkontakte/vkui": "^5.8.0",
  "@vkontakte/icons": "^2.54.0",
  "@ant-design/icons": "^5.2.6"
}
```

### VK Integration
```json
"dependencies": {
  "@vkontakte/vk-bridge": "^2.12.0",
  "@vkontakte/vk-mini-apps-api": "^1.1.0",
  "@vkontakte/vkui": "^5.8.0"
}
```

### State Management
```json
"dependencies": {
  "zustand": "^4.4.7",
  "@tanstack/react-query": "^5.14.2",
  "axios": "^1.6.2"
}
```

### Forms & Validation
```json
"dependencies": {
  "react-hook-form": "^7.49.2",
  "zod": "^3.22.4",
  "@hookform/resolvers": "^3.3.3"
}
```

### Utilities
```json
"dependencies": {
  "clsx": "^2.0.0",
  "dayjs": "^1.11.10",
  "lodash": "^4.17.21",
  "nanoid": "^5.0.4"
}
```

## 🛠 Dev Dependencies

### Build Tools
```json
"devDependencies": {
  "vite": "^5.0.8",
  "@vitejs/plugin-react": "^4.2.1",
  "postcss": "^8.4.32",
  "autoprefixer": "^10.4.16"
}
```

### Code Quality
```json
"devDependencies": {
  "eslint": "^8.56.0",
  "eslint-config-next": "^14.0.4",
  "eslint-config-prettier": "^9.1.0",
  "prettier": "^3.1.1",
  "prettier-plugin-tailwindcss": "^0.5.9"
}
```

### Testing
```json
"devDependencies": {
  "vitest": "^1.0.4",
  "@testing-library/react": "^14.1.2",
  "@testing-library/jest-dom": "^6.1.5",
  "@testing-library/user-event": "^14.5.1",
  "@playwright/test": "^1.40.1"
}
```

### Type Definitions
```json
"devDependencies": {
  "@types/react": "^18.2.45",
  "@types/react-dom": "^18.2.18",
  "@types/node": "^20.10.6",
  "@types/lodash": "^4.14.202"
}
```

---

## 📦 Полный package.json (рекомендуемый)

```json
{
  "name": "max-mini-app",
  "version": "1.0.0",
  "description": "Социальное мини-приложение для мессенджера MAX",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "type-check": "tsc --noEmit",
    "docker:build": "docker build -t max-mini-app .",
    "docker:run": "docker-compose up"
  },
  "dependencies": {
    "next": "^14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.3",
    
    "antd": "^5.12.0",
    "tailwindcss": "^3.3.6",
    
    "@vkontakte/vk-bridge": "^2.12.0",
    "@vkontakte/vkui": "^5.8.0",
    "@vkontakte/icons": "^2.54.0",
    "@ant-design/icons": "^5.2.6",
    
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.14.2",
    "axios": "^1.6.2",
    
    "react-hook-form": "^7.49.2",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.3",
    
    "clsx": "^2.0.0",
    "dayjs": "^1.11.10",
    "lodash": "^4.17.21",
    "nanoid": "^5.0.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@types/lodash": "^4.14.202",
    
    "vite": "^5.0.8",
    "@vitejs/plugin-react": "^4.2.1",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16",
    
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.0.4",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.1.1",
    "prettier-plugin-tailwindcss": "^0.5.9",
    
    "vitest": "^1.0.4",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@testing-library/user-event": "^14.5.1",
    "@playwright/test": "^1.40.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## 🐳 Docker Setup

### Dockerfile (Multi-stage build)
```dockerfile
# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Runner
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

### docker-compose.yml
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
      - NEXT_PUBLIC_VK_APP_ID=${VK_APP_ID}
    restart: unless-stopped
    volumes:
      - ./public:/app/public:ro
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

---

## ⚙️ Конфигурационные файлы

### tailwind.config.js
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
    preflight: false, // Отключаем для совместимости с Ant Design
  },
}
```

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['antd', '@vkontakte/vkui'],
  images: {
    domains: ['vk.com', 'sun9-*.userapi.com'],
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
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
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### .eslintrc.json
```json
{
  "extends": [
    "next/core-web-vitals",
    "prettier"
  ],
  "rules": {
    "react/no-unescaped-entities": "off",
    "@next/next/no-page-custom-font": "off"
  }
}
```

### .prettierrc
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

## 🎨 Дополнительные библиотеки для социального трека

### Доступность
```bash
npm install react-speech-recognition
npm install @speechly/react-client
npm install react-accessible-accordion
```

### Графики и визуализация
```bash
npm install recharts
npm install @ant-design/charts
```

### Геолокация и карты
```bash
npm install leaflet react-leaflet
npm install @types/leaflet
```

### Анимации
```bash
npm install framer-motion
npm install react-spring
```

### i18n (мультиязычность)
```bash
npm install next-i18next
npm install i18next react-i18next
```

---

## 📊 Рекомендации по оптимизации

1. **Code Splitting** - Next.js автоматически
2. **Image Optimization** - next/image
3. **Lazy Loading** - React.lazy() + Suspense
4. **Bundle Analysis** - @next/bundle-analyzer
5. **PWA Support** - next-pwa (опционально)

---

## 🚀 Быстрый старт

```bash
# Клонировать структуру (уже создано)
cd C:\projects\TheOdd1sOut

# Инициализировать Next.js (следующий шаг)
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir

# Установить зависимости
npm install antd zustand @tanstack/react-query axios
npm install @vkontakte/vk-bridge @vkontakte/vkui
npm install react-hook-form zod @hookform/resolvers
npm install clsx dayjs lodash nanoid

# Установить dev зависимости
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D prettier prettier-plugin-tailwindcss eslint-config-prettier

# Запустить dev сервер
npm run dev
```

Готово! 🎉

