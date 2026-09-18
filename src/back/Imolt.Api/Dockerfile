# Образ расчётной части сервиса. Контекст сборки — src/back.
# Слои разделены так, чтобы восстановление зависимостей не повторялось при
# каждой правке кода: сначала копируется только описание проекта с замком
# версий, и лишь потом исходники.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Imolt.Api/Imolt.Api.csproj Imolt.Api/packages.lock.json Imolt.Api/
# Режим замка: состав и версии зависимостей обязаны совпасть с
# packages.lock.json, иначе сборка падает, а не тянет другие версии молча.
RUN dotnet restore Imolt.Api/Imolt.Api.csproj --locked-mode

COPY Imolt.Api/ Imolt.Api/
RUN dotnet publish Imolt.Api/Imolt.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

# Непривилегированный пользователь заранее заведён в базовом образе.
USER $APP_UID

ENTRYPOINT ["dotnet", "Imolt.Api.dll"]
