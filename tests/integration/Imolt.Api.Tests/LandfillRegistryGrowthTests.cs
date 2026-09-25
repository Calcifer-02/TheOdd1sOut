using System.Globalization;
using System.Net;
using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Пополнение реестра полигонов книгой (R-046). Обмен с АИС ОССиГ в версию 1
/// не входит — решение по Q-017 от 25.09.2026, — и реестр пополняет менеджер
/// данных тем же двухшаговым импортом, которым ведёт цены.
///
/// Заведённая запись получает статус «не подтверждён» и источник «реестр»:
/// перечень говорит, что объект существует, а не что он принимает отходы
/// сегодня. Статус наружу отдаётся договором, источник — нет (R-058),
/// поэтому источник наблюдается в хранилище.
///
/// Проверки фальсифицируемы: они падают, если книга перестанет заводить
/// запись или заведёт её мимо предпросмотра, если новая запись появится без
/// обязательных столбцов, если заведённый полигон окажется активным и если
/// подтверждение перепишет запись, заведённую между разбором и применением.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-046a, AC-046b, AC-046c
[Collection(ImoltReferenceEditorCollection.Name)]
public sealed class LandfillRegistryGrowthTests(ImoltReferenceEditorStand stand)
{
  private const string LandfillsKind = "landfills";

  private const string StalePreview = "urn:imolt:problem:stale-preview";

  [Fact(DisplayName = "книга заводит полигон, которого в реестре не было")]
  public async Task WorkbookAddsALandfillThatTheRegistryDidNotHave()
  {
    var token = await stand.DataManagerTokenAsync();

    var book = Book(
        ImoltReferenceEditorStand.NewLandfillId,
        ImoltReferenceEditorStand.NewLandfillName,
        ImoltReferenceEditorStand.NewLandfillAddress,
        ImoltReferenceEditorStand.NewLandfillLatitude,
        ImoltReferenceEditorStand.NewLandfillLongitude);

    using var preview = await UploadAsync(book, "poligony-iz-perechnya.xlsx", token);

    // AC-046a: заводимая запись названа отдельно от правок. «Поля ещё нет» и
    // «записи ещё нет» — разное, и решать по одним пустым текущим значениям
    // менеджеру данных было бы не по чему.
    Assert.Equal(
        new[] { ImoltReferenceEditorStand.NewLandfillId },
        Additions(preview.RootElement));

    var confirmation = await stand.ConfirmReferenceImportAsync(IdOf(preview.RootElement), token);
    using var result = await ReferenceChecks.OkAsync(confirmation, "confirmReferenceImport");

    Assert.Equal(1, result.RootElement.GetProperty("addedEntities").GetInt32());

    var card = await stand.GetAsync(
        $"{ImoltReferenceEditorStand.LandfillsPath}/{ImoltReferenceEditorStand.NewLandfillId}");
    using var landfill = await ReferenceChecks.OkAsync(card, "getLandfill");

    Assert.Equal(ImoltReferenceEditorStand.NewLandfillName, landfill.RootElement.GetProperty("name").GetString());

    // Активным заведённый полигон не становится: подставить его в подбор без
    // единого подтверждения значило бы предложить вывоз на объект, о котором
    // известно лишь то, что он есть в перечне.
    Assert.Equal("unconfirmed", landfill.RootElement.GetProperty("status").GetString());

    Assert.Equal(
        1,
        await stand.CountAsync(
            "select count(*) from landfill where id = @id and status_source = 'registry'",
            ("id", ImoltReferenceEditorStand.NewLandfillId)));
  }

  [Fact(DisplayName = "новая запись без обязательных столбцов не заводится")]
  public async Task ANewEntityWithoutRequiredColumnsIsNotAdded()
  {
    var token = await stand.DataManagerTokenAsync();

    // Книга без столбцов координат: для правки существующей записи их и не
    // нужно, а для новой без них считать плечо перевозки нечем (AC-046b).
    var book = WorkbookBuilder
        .WithHeaders(
            WorkbookBuilder.IdentifierColumn,
            WorkbookBuilder.NameColumn,
            WorkbookBuilder.AddressColumn)
        .Row(
            WorkbookCell.Text(ImoltReferenceEditorStand.IncompleteLandfillId),
            WorkbookCell.Text("Объект без координат"),
            WorkbookCell.Text("Московская обл., адрес без координат"))
        .Build();

    using var preview = await UploadAsync(book, "poligony-bez-koordinat.xlsx", token);

    Assert.Empty(Additions(preview.RootElement));

    var rejected = preview.RootElement.GetProperty("rejectedRows").EnumerateArray().ToList();
    var row = Assert.Single(rejected);

    Assert.Equal(2, row.GetProperty("row").GetInt32());

    // Причина называет недостающие столбцы поимённо: менеджер данных правит
    // по ней файл, а «строка не разобрана» не говорит, что именно дописать.
    var reason = row.GetProperty("reason").GetString() ?? string.Empty;
    Assert.Contains("latitude", reason, StringComparison.Ordinal);
    Assert.Contains("longitude", reason, StringComparison.Ordinal);

    var confirmation = await stand.ConfirmReferenceImportAsync(IdOf(preview.RootElement), token);
    using var result = await ReferenceChecks.OkAsync(confirmation, "confirmReferenceImport");

    Assert.Equal(0, result.RootElement.GetProperty("addedEntities").GetInt32());
    Assert.Equal(
        0,
        await stand.CountAsync(
            "select count(*) from landfill where id = @id",
            ("id", ImoltReferenceEditorStand.IncompleteLandfillId)));
  }

  [Fact(DisplayName = "запись, заведённая между разбором и подтверждением, не переписывается")]
  public async Task AnEntityCreatedBetweenPreviewAndConfirmationIsNotOverwritten()
  {
    var token = await stand.DataManagerTokenAsync();

    var book = Book(
        ImoltReferenceEditorStand.RaceLandfillId,
        "Объект из книги",
        "Московская обл., адрес из книги",
        55.4321,
        38.7654);

    using var preview = await UploadAsync(book, "poligony-gonka.xlsx", token);
    Assert.Equal(
        new[] { ImoltReferenceEditorStand.RaceLandfillId },
        Additions(preview.RootElement));

    // AC-046c: запись завели другим способом, пока предпросмотр ждал.
    const string ownName = "Объект, заведённый в обход импорта";
    await stand.AddLandfillAsync(ImoltReferenceEditorStand.RaceLandfillId, ownName);

    var confirmation = await stand.ConfirmReferenceImportAsync(IdOf(preview.RootElement), token);
    using var problem = await ReferenceChecks.ProblemAsync(
        confirmation, HttpStatusCode.Conflict, StalePreview);
    Assert.Equal(409, problem.RootElement.GetProperty("status").GetInt32());

    // Причина названа своя, а не общая «справочник изменился»: менеджеру
    // данных здесь нужно выяснить, кто завёл запись, а не просто разобрать
    // файл заново.
    var detail = problem.RootElement.GetProperty("detail").GetString() ?? string.Empty;
    Assert.Contains("уже есть в справочнике", detail, StringComparison.Ordinal);

    // Чужая запись осталась своей: молча переписать её значило бы потерять
    // то, чего импорт не видел.
    Assert.Equal(
        1,
        await stand.CountAsync(
            "select count(*) from landfill where id = @id and name = @name",
            ("id", ImoltReferenceEditorStand.RaceLandfillId),
            ("name", ownName)));
  }

  /// Книга полигонов с полным составом столбцов новой записи.
  private static byte[] Book(string id, string name, string address, double latitude, double longitude)
      => WorkbookBuilder
          .WithHeaders(
              WorkbookBuilder.IdentifierColumn,
              WorkbookBuilder.NameColumn,
              WorkbookBuilder.AddressColumn,
              WorkbookBuilder.LatitudeColumn,
              WorkbookBuilder.LongitudeColumn)
          .Row(
              WorkbookCell.Text(id),
              WorkbookCell.Text(name),
              WorkbookCell.Text(address),
              WorkbookCell.Number((decimal)latitude),
              WorkbookCell.Number((decimal)longitude))
          .Build();

  private static IReadOnlyList<string> Additions(JsonElement preview)
  {
    Assert.True(
        preview.TryGetProperty("additions", out var additions),
        "предпросмотр не назвал заводимых записей: поля additions в ответе нет");

    return [.. additions.EnumerateArray().Select(entry => entry.GetString() ?? string.Empty)];
  }

  private static string IdOf(JsonElement preview)
  {
    var id = preview.GetProperty("id").GetString();
    Assert.False(string.IsNullOrWhiteSpace(id), "предпросмотр импорта пришёл без идентификатора");

    return id!;
  }

  private async Task<JsonDocument> UploadAsync(byte[] book, string fileName, string token)
  {
    var response = await stand.UploadReferenceAsync(book, fileName, LandfillsKind, token);

    return await ReferenceChecks.SuccessAsync(response, "startReferenceImport", HttpStatusCode.Created);
  }
}
