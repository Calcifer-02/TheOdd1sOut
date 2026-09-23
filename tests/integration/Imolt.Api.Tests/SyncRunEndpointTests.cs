using System.Globalization;
using System.Net;
using Xunit;

namespace Imolt.Api.Tests;

/// Итог последнего обновления справочников. Служба сбора в состав версии 1 не
/// входит (ADR-0002), и обновлением справочника в версии 1 является
/// подтверждённый импорт из файла: договор допускает такой источник прогона
/// значением `file` в перечне источников.
///
/// Отсутствие прогонов — не отказ обслуживания, а отсутствие записи: панель
/// показывает «обновлений не было» и предлагает ручной ввод, а не ошибку.
/// Поэтому пустая таблица прогонов отвечает 404, а не выдуманной записью с
/// нулями.
///
/// Проверка фальсифицируема: она падает, если подтверждённый импорт не
/// оставляет следа в итоге обновления, если источник или исход прогона
/// названы не тем значением, если время окончания остаётся незаполненным,
/// если при пустой таблице прогонов служба выдумывает запись и если чтение
/// итога перестаёт требовать входа.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-044d, AC-044e
[Collection(ImoltReferenceEditorCollection.Name)]
public sealed class SyncRunEndpointTests(ImoltReferenceEditorStand stand)
{
  private const string WasteGroupsKind = "wasteGroups";

  private const string NotFound = "urn:imolt:problem:not-found";

  private const string AuthenticationRequired = "urn:imolt:problem:authentication-required";

  [Fact(DisplayName = "подтверждённый импорт записывает прогон обновления справочников")]
  public async Task ConfirmedImportRecordsTheUpdateRun()
  {
    var token = await stand.DataManagerTokenAsync();

    // Две группы отходов — ровно два изменения предусловия критерия. Группы
    // свои: на общих с проверками импорта число изменений зависело бы от
    // того, какой класс отработал раньше.
    var book = WorkbookBuilder
        .WithHeaders(WorkbookBuilder.IdentifierColumn, WorkbookBuilder.TransportPriceColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.SyncRunFirstGroupId),
            WorkbookCell.Number(44.00m))
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.SyncRunSecondGroupId),
            WorkbookCell.Number(45.00m))
        .Build();

    var upload = await stand.UploadReferenceAsync(book, "gruppy-othodov-progon.xlsx", WasteGroupsKind, token);
    using var preview = await ReferenceChecks.SuccessAsync(
        upload, "startReferenceImport", HttpStatusCode.Created);

    var importId = preview.RootElement.GetProperty("id").GetString();
    Assert.False(string.IsNullOrWhiteSpace(importId), "предпросмотр импорта пришёл без идентификатора");

    var confirmation = await stand.ConfirmReferenceImportAsync(importId!, token);
    using var result = await ReferenceChecks.OkAsync(confirmation, "confirmReferenceImport");
    Assert.Equal(2, result.RootElement.GetProperty("appliedChanges").GetInt32());

    var latest = await stand.GetAsync(ImoltReferenceEditorStand.SyncRunsLatestPath, token);
    using var run = await ReferenceChecks.OkAsync(latest, "getLatestSyncRun");
    var body = run.RootElement;

    // Источник «file» отличает подтверждённый импорт от сообщения канала:
    // по нему панель объясняет, откуда взялось обновление.
    Assert.Equal("file", body.GetProperty("source").GetString());
    Assert.Equal("succeeded", body.GetProperty("outcome").GetString());

    // Время окончания заполнено: незаполненное означает прогон, который ещё
    // идёт, а подтверждение уже вернуло итог.
    var finishedAt = body.GetProperty("finishedAt");
    Assert.True(
        DateTimeOffset.TryParse(
            finishedAt.GetString(),
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out _),
        $"время окончания прогона пришло значением «{finishedAt}»: завершённым его назвать нельзя");
  }

  [Fact(DisplayName = "без записанных прогонов итог обновления не выдумывается")]
  public async Task WithoutRecordedRunsTheLatestIsNotInvented()
  {
    // Предусловие критерия: прогонов обновления не записано. Операции
    // удаления прогона договор не объявляет, а подтверждённый импорт
    // соседнего класса прогон записывает — поэтому предусловие ставится
    // прямо в хранилище.
    await stand.ClearSyncRunsAsync();
    Assert.Equal(0L, await stand.CountAsync("select count(*) from sync_run"));

    // Читает участник с маркером. Взят маркер менеджера данных: ADR-0007
    // требует права ведения справочников у всех шести операций, а критерий
    // говорит об «участнике с сессией» — расхождение названо в отчёте среза
    // и не решается здесь выбором за человека.
    var token = await stand.DataManagerTokenAsync();

    var response = await stand.GetAsync(ImoltReferenceEditorStand.SyncRunsLatestPath, token);
    using var problem = await ReferenceChecks.ProblemAsync(response, HttpStatusCode.NotFound, NotFound);
    Assert.Equal(404, problem.RootElement.GetProperty("status").GetInt32());

    // Тот же запрос без маркера отвечает иначе: «записи нет» и «вход нужен» —
    // разные причины, и гость не должен узнавать одну вместо другой.
    var guest = await stand.GetAsync(ImoltReferenceEditorStand.SyncRunsLatestPath);
    using var guestProblem = await ReferenceChecks.ProblemAsync(
        guest, HttpStatusCode.Unauthorized, AuthenticationRequired);
    Assert.Equal(401, guestProblem.RootElement.GetProperty("status").GetInt32());
  }
}
