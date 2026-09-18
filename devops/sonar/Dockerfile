# Образ статического анализа. Сканер SonarQube для .NET работает поверх Java,
# поэтому среда анализа собрана отдельно: на машине разработчика Java может
# отсутствовать, а ставить её ради одной команды незачем.

FROM mcr.microsoft.com/dotnet/sdk:10.0

# Java нужна самому сканеру; node — анализатору JavaScript и TypeScript,
# который сканер запускает для мини-приложения.
RUN apt-get update \
 && apt-get install -y --no-install-recommends default-jre-headless nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN dotnet tool install --global dotnet-sonarscanner
ENV PATH="${PATH}:/root/.dotnet/tools"

# В репозитории есть файлы с кириллицей в именах. Без явной локали JVM внутри
# образа читает пути в ASCII и падает на первом же таком имени.
ENV LANG=C.UTF-8     LC_ALL=C.UTF-8     SONAR_SCANNER_OPTS="-Dfile.encoding=UTF-8"

WORKDIR /src
