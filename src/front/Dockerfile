# Образ мини-приложения MAX: сборка статики и отдача её nginx.
# Контекст сборки — src/front.

FROM node:24-alpine AS build
WORKDIR /src

COPY package.json package-lock.json ./
# Установка строго по замку версий: состав обязан совпасть с package-lock.json.
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS final
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
