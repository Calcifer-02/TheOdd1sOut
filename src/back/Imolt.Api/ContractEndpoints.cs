namespace Imolt.Api;

/// Отдача договора API и страницы его просмотра. Договор — источник, а не
/// производная кода: описание не порождается из обработчиков (ADR-0003).
///
/// Требования эта единица не реализует: отдача договора — способ работы над
/// решением, а не свойство продукта (ADR-0003). Общий код помечается
/// компонентом и решением, а не зонтичным требованием уровня L1.
///
/// @shared: imolt-api
/// @adr: ADR-0003
public static class ContractEndpoints
{
  public static void MapContractEndpoints(this WebApplication app)
  {
    // Файл едет рядом со сборкой: и при локальном запуске, и в образе он
    // лежит в подкаталоге contracts каталога приложения.
    var contractPath = Path.Combine(AppContext.BaseDirectory, "contracts", "openapi.yaml");

    app.MapGet("/v1/openapi.yaml", () =>
        File.Exists(contractPath)
            ? Results.File(contractPath, "application/yaml; charset=utf-8")
            : Results.Problem(
                title: "Договор API не найден",
                detail: $"Ожидался файл {contractPath}",
                statusCode: StatusCodes.Status500InternalServerError));

    app.UseSwaggerUI(options =>
    {
      // Адрес договора задан относительно страницы, а не от корня узла.
      // Снаружи служба стоит за префиксом /api, который внешний узел
      // срезает: абсолютный путь ушёл бы мимо службы, на страницу
      // мини-приложения, и Swagger UI получил бы разметку вместо договора.
      options.SwaggerEndpoint("../v1/openapi.yaml", "ИМОЛТ — расчётная часть, версия 1");
      options.RoutePrefix = "swagger";
      options.DocumentTitle = "Договор API ИМОЛТ";
    });
  }
}
