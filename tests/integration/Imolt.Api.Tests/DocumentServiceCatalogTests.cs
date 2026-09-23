using System.Text.Json;
using Xunit;

namespace Imolt.Api.Tests;

/// Каталог услуг по документации (R-052). Состав пакета и логика выборочного
/// заказа заказчиком не подтверждены (Q-005), поэтому каталог отдаётся
/// данными: зашитый в интерфейс перечень пришлось бы переписывать в коде на
/// каждое уточнение заказчика.
///
/// Цена указывается как «от» либо отсутствует вовсе — тогда услуга считается
/// по запросу. Эти два состояния взаимно исключают друг друга: карточка,
/// где названа и цена, и «по запросу», не говорит клиенту ничего.
///
/// Предусловие — две записи каталога — заводится стендом области, а не
/// начальным набором данных: состав не подтверждён, и класть его в набор,
/// который уходит в развёртывание, рано.
///
/// Проверка фальсифицируема: она падает, если каталог перестанет отдаваться
/// страницей по договору, если из него исчезнет услуга с ценой «от» или
/// услуга по запросу и если у какой-нибудь услуги цена и признак «по запросу»
/// окажутся заданными вместе.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-052a
[Collection(ImoltDealsCollection.Name)]
public sealed class DocumentServiceCatalogTests(ImoltDealsStand stand)
{
  [Fact(DisplayName = "каталог отдаёт услуги с ценой «от» либо с признаком «по запросу»")]
  public async Task CatalogOffersServicesEitherPricedFromOrOnRequest()
  {
    var response = await stand.Client.GetAsync(DealChecks.DocumentServicesPath);
    using var catalog = await ReferenceChecks.OkAsync(response, "listDocumentServices");

    var items = catalog.RootElement.GetProperty("items").EnumerateArray().ToList();

    // AC-052a: услуга с названной ценой «от». Признак «по запросу» при ней
    // ложен — иначе цена в карточке стоит рядом с «уточняйте».
    var priced = Single(items, ImoltDealsStand.PricedServiceId);
    Assert.False(
        priced.GetProperty("priceOnRequest").GetBoolean(),
        "у услуги с названной ценой взведён признак «по запросу»");
    Assert.NotEqual(JsonValueKind.Null, priced.GetProperty("priceFrom").ValueKind);

    // Услуга без цены: признак «по запросу» истинен, цена отсутствует вовсе.
    // Ноль означал бы бесплатную услугу, а цена просто не названа.
    var onRequest = Single(items, ImoltDealsStand.OnRequestServiceId);
    Assert.True(
        onRequest.GetProperty("priceOnRequest").GetBoolean(),
        "услуга без цены не помечена как считаемая по запросу");
    Assert.Equal(JsonValueKind.Null, onRequest.GetProperty("priceFrom").ValueKind);

    // Правило распространяется на весь каталог, а не на две проверенные
    // записи: расходится обычно та строка, которую заводили позже.
    foreach (var service in items)
    {
      var hasPrice = service.GetProperty("priceFrom").ValueKind is not JsonValueKind.Null;
      Assert.False(
          hasPrice && service.GetProperty("priceOnRequest").GetBoolean(),
          $"у услуги {service.GetProperty("id").GetString()} цена и признак «по запросу» заданы вместе");
    }
  }

  private static JsonElement Single(IReadOnlyList<JsonElement> items, string serviceId)
  {
    foreach (var service in items)
    {
      if (service.GetProperty("id").GetString() == serviceId)
      {
        return service;
      }
    }

    Assert.Fail(
        $"в каталоге нет услуги {serviceId}: "
            + string.Join(", ", items.Select(item => item.GetProperty("id").GetString())));
    return default;
  }
}
