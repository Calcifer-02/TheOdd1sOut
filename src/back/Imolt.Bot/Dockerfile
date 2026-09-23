# Образ чат-бота MAX. Контекст сборки — src/back.
# Слои разделены так же, как у расчётной части: сначала описание проекта
# с замком версий, потом исходники.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Общие свойства сборок нужны ещё на восстановлении: без них у проекта нет
# целевой платформы, и restore падает.
COPY Directory.Build.props ./
COPY Imolt.Bot/Imolt.Bot.csproj Imolt.Bot/packages.lock.json Imolt.Bot/
# Режим замка: состав и версии зависимостей обязаны совпасть с
# packages.lock.json, иначе сборка падает, а не тянет другие версии молча.
RUN dotnet restore Imolt.Bot/Imolt.Bot.csproj --locked-mode

COPY Imolt.Bot/ Imolt.Bot/
RUN dotnet publish Imolt.Bot/Imolt.Bot.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Непривилегированный пользователь заранее заведён в базовом образе.
USER $APP_UID

ENTRYPOINT ["dotnet", "Imolt.Bot.dll"]
