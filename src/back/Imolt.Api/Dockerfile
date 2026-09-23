# Образ расчётной части сервиса. Контекст сборки — src/back.
# Слои разделены так, чтобы восстановление зависимостей не повторялось при
# каждой правке кода: сначала копируются только описания проектов с замками
# версий, и лишь потом исходники.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Общие свойства сборок нужны ещё на восстановлении: без них у проектов нет
# целевой платформы, и restore падает.
COPY Directory.Build.props ./
COPY Imolt.Shared/Imolt.Shared.csproj Imolt.Shared/
COPY Imolt.Database/Imolt.Database.csproj Imolt.Database/packages.lock.json Imolt.Database/
COPY Imolt.References/Imolt.References.csproj Imolt.References/
COPY Imolt.Calculations/Imolt.Calculations.csproj Imolt.Calculations/
COPY Imolt.Deals/Imolt.Deals.csproj Imolt.Deals/
COPY Imolt.Api/Imolt.Api.csproj Imolt.Api/packages.lock.json Imolt.Api/
# Режим замка: состав и версии зависимостей обязаны совпасть с
# packages.lock.json, иначе сборка падает, а не тянет другие версии молча.
RUN dotnet restore Imolt.Api/Imolt.Api.csproj --locked-mode

COPY Imolt.Shared/ Imolt.Shared/
COPY Imolt.Database/ Imolt.Database/
COPY Imolt.References/ Imolt.References/
COPY Imolt.Calculations/ Imolt.Calculations/
COPY Imolt.Deals/ Imolt.Deals/
COPY Imolt.Api/ Imolt.Api/
RUN dotnet publish Imolt.Api/Imolt.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Шрифт с кириллицей для печати коммерческого предложения (R-061). Встроенные
# шрифты формата PDF кириллицы не несут, а в базовом образе шрифтов нет вовсе:
# без этого слоя документ вышел бы квадратами вместо букв. Слой ставится до
# смены пользователя — установка пакетов требует прав суперпользователя.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends fonts-dejavu-core \
    && apt-get clean \
    && find /var/lib/apt/lists -mindepth 1 -delete

COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Непривилегированный пользователь заранее заведён в базовом образе.
USER $APP_UID

ENTRYPOINT ["dotnet", "Imolt.Api.dll"]
