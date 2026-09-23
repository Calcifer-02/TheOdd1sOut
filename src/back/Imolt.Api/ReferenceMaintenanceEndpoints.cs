using Imolt.References.Application;
using Imolt.References.Contracts;
using Imolt.References.Ports;
using Imolt.Deals.Ports;
using Microsoft.AspNetCore.Mvc;

namespace Imolt.Api;

/// Точки ведения справочников: редактор цен и тарифов, ручной статус
/// полигона, двухшаговый импорт из книги и итог последнего обновления
/// (R-042, R-044, R-045, R-048).
///
/// Право проверяется здесь, а не в области: область «справочники» знает,
/// что такое тариф, и не знает, что такое участник. Связывание права с
/// операцией — работа входа, как и связывание HTTP с портом (ADR-0001).
///
/// @req: R-042, R-043, R-044, R-045, R-048
/// @adr: ADR-0003
public static class ReferenceMaintenanceEndpoints
{
  /// Статусы полигона, объявленные договором. Промах мимо перечня — ошибка
  /// запроса, а не молчаливое сохранение неизвестного состояния.
  private static readonly string[] Statuses = ["active", "blocked", "unconfirmed"];

  public static void MapReferenceMaintenanceEndpoints(this WebApplication app)
  {
    app.MapPatch("/v1/waste-groups/{wasteGroupId}", async (
        HttpContext context,
        [FromRoute] string wasteGroupId,
        [FromBody] WasteGroupUpdate? update,
        [FromServices] IReferenceEditor editor,
        [FromServices] IAccessTokens tokens,
        [FromServices] IParticipantPermissions permissions,
        CancellationToken cancellationToken) =>
    {
      await AccessEndpoints.DataManagerAsync(context, tokens, permissions, cancellationToken);

      var requested = update
          ?? throw new ArgumentOutOfRangeException(nameof(update), "тело правки обязательно");

      // Договор объявляет minProperties: 1. Пустая правка двигала бы дату
      // актуальности, ничего не изменив, — а дата обещает свежесть данных.
      if (requested is { Name: null, FkkoCodes: null, TransportPricePerTonKm: null, DensityTonPerCubicMeter: null })
      {
        throw new ArgumentOutOfRangeException(nameof(update), "правка не называет ни одного поля");
      }

      if (requested.DensityTonPerCubicMeter is <= 0)
      {
        throw new ArgumentOutOfRangeException(
            nameof(update), requested.DensityTonPerCubicMeter, "плотность больше нуля");
      }

      var group = await editor.UpdateWasteGroupAsync(wasteGroupId, requested, cancellationToken);

      return group is null
          ? ProblemResponses.NotFound($"Группа отходов {wasteGroupId} не найдена")
          : Results.Ok(group);
    });

    app.MapPut("/v1/landfills/{landfillId}/tariffs/{wasteGroupId}", async (
        HttpContext context,
        [FromRoute] string landfillId,
        [FromRoute] string wasteGroupId,
        [FromBody] LandfillTariffUpdate? update,
        [FromServices] IReferenceEditor editor,
        [FromServices] IAccessTokens tokens,
        [FromServices] IParticipantPermissions permissions,
        CancellationToken cancellationToken) =>
    {
      await AccessEndpoints.DataManagerAsync(context, tokens, permissions, cancellationToken);

      var price = update?.DisposalPricePerTon
          ?? throw new ArgumentOutOfRangeException(nameof(update), "цена утилизации обязательна");

      if (price.Amount < 0)
      {
        throw new ArgumentOutOfRangeException(
            nameof(update), price.Amount, "цена утилизации не может быть отрицательной");
      }

      var tariff = await editor.SetTariffAsync(landfillId, wasteGroupId, price, cancellationToken);

      return tariff is null
          ? ProblemResponses.NotFound($"Полигон {landfillId} либо группа отходов {wasteGroupId} не найдены")
          : Results.Ok(tariff);
    });

    app.MapPut("/v1/landfills/{landfillId}/status", async (
        HttpContext context,
        [FromRoute] string landfillId,
        [FromBody] LandfillStatusUpdate? update,
        [FromServices] IReferenceEditor editor,
        [FromServices] IAccessTokens tokens,
        [FromServices] IParticipantPermissions permissions,
        CancellationToken cancellationToken) =>
    {
      await AccessEndpoints.DataManagerAsync(context, tokens, permissions, cancellationToken);

      var status = update?.Status
          ?? throw new ArgumentOutOfRangeException(nameof(update), "статус обязателен");

      if (!Statuses.Contains(status, StringComparer.Ordinal))
      {
        throw new ArgumentOutOfRangeException(
            nameof(update), status, "статус полигона — active, blocked либо unconfirmed");
      }

      var state = await editor.SetStatusAsync(landfillId, status, update!.Reason, cancellationToken);

      return state is null
          ? ProblemResponses.NotFound($"Полигон {landfillId} не найден")
          : Results.Ok(state);
    });

    // Итог обновления доступен всякому участнику с сессией: договор объявляет
    // здесь 401 и 404, но не 403 — читать, когда обновились данные, вправе
    // и тот, кто их не правит.
    app.MapGet("/v1/sync-runs/latest", async (
        HttpContext context,
        [FromServices] ISyncRuns runs,
        [FromServices] IAccessTokens tokens,
        CancellationToken cancellationToken) =>
    {
      AccessEndpoints.Participant(context, tokens);

      var latest = await runs.LatestAsync(cancellationToken);

      // Отсутствие прогонов — не отказ обслуживания, а отсутствие записи:
      // выдумывать пустой прогон значило бы сообщить о сборе, которого не было.
      return latest is null
          ? ProblemResponses.NotFound("Прогонов обновления справочников ещё не было")
          : Results.Ok(latest);
    });

    app.MapPost("/v1/reference-imports", async (
        HttpContext context,
        [FromForm] string? kind,
        IFormFile? file,
        [FromServices] ReferenceImportScenarios imports,
        [FromServices] IAccessTokens tokens,
        [FromServices] IParticipantPermissions permissions,
        CancellationToken cancellationToken) =>
    {
      await AccessEndpoints.DataManagerAsync(context, tokens, permissions, cancellationToken);

      var uploaded = file
          ?? throw new ArgumentOutOfRangeException(nameof(file), "файл книги обязателен");

      await using var content = uploaded.OpenReadStream();
      var preview = await imports.StartAsync(kind, content, cancellationToken);

      return Results.Created($"/v1/reference-imports/{preview.Id}", preview);
    }).DisableAntiforgery();

    app.MapPost("/v1/reference-imports/{importId}/confirmation", async (
        HttpContext context,
        [FromRoute] string importId,
        [FromServices] ReferenceImportScenarios imports,
        [FromServices] IAccessTokens tokens,
        [FromServices] IParticipantPermissions permissions,
        CancellationToken cancellationToken) =>
    {
      await AccessEndpoints.DataManagerAsync(context, tokens, permissions, cancellationToken);

      var result = await imports.ConfirmAsync(importId, cancellationToken);

      return result is null
          ? ProblemResponses.NotFound($"Предпросмотр импорта {importId} не найден")
          : Results.Ok(result);
    });
  }
}
