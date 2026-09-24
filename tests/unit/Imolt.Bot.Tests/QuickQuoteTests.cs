using System.Globalization;
using Imolt.Bot.Domain;
using Imolt.Bot.Ports;
using Xunit;

namespace Imolt.Bot.Tests;

/// Короткое действие в переписке: разбор запроса и ответ предварительной
/// совокупной ценой (R-072, критерии AC-072a и AC-072b).
///
/// Цену считает расчётная часть; здесь проверяется то, что делает чат-бот, —
/// разбор сообщения участника и состав ответа.
///
///   dotnet test tests/unit/Imolt.Bot.Tests
public sealed class QuickQuoteTests
{
  private static readonly CultureInfo Russian = CultureInfo.GetCultureInfo("ru-RU");

  /// Проверка падает, если разбор потеряет адрес, группу отходов, объём или
  /// меру, а также если мера уедет в расчётную часть не кодом договора.
  ///
  /// @ac: AC-072a
  [Theory(DisplayName = "сообщение с адресом, группой отходов и объёмом разбирается в запрос расчёта")]
  [InlineData("г Москва, ул Годовикова, д 9; лом бетона; 20 т", 20, "t")]
  [InlineData("г Москва, ул Годовикова, д 9; лом бетона; 15 м3", 15, "m3")]
  [InlineData("г Москва, ул Годовикова, д 9; лом бетона; 12,5 тонн", 12.5, "t")]
  public void QuickQuoteMessageIsSplitIntoAddressWasteGroupAndAmount(
      string message,
      double amount,
      string unit)
  {
    var request = QuickQuotes.Parse(message);

    Assert.NotNull(request);
    Assert.Equal("г Москва, ул Годовикова, д 9", request.Address);
    Assert.Equal("лом бетона", request.WasteGroup);
    Assert.Equal((decimal)amount, request.Amount);
    Assert.Equal(unit, request.Unit);
  }

  /// Проверка падает, если разбор примет сообщение, в котором не названы все
  /// три части или мера непонятна: принятый наполовину запрос уйдёт в
  /// расчётную часть и вернётся отказом, которого участник не поймёт.
  ///
  /// @ac: AC-072a
  [Theory(DisplayName = "сообщение без меры или без части запроса расчётом не считается")]
  [InlineData("г Москва, ул Годовикова, д 9; лом бетона")]
  [InlineData("г Москва, ул Годовикова, д 9; лом бетона; 20")]
  [InlineData("г Москва, ул Годовикова, д 9; лом бетона; много вагонов")]
  [InlineData("здравствуйте")]
  public void IncompleteMessageIsNotTakenForACalculationRequest(string message) =>
      Assert.Null(QuickQuotes.Parse(message));

  /// Проверка падает, если ответ не назовёт совокупную цену, полигон или
  /// дату актуальности цен, а также если число уйдёт не в русской локали.
  ///
  /// @ac: AC-072a
  [Fact(DisplayName = "ответ на короткий расчёт называет предварительную совокупную цену расчётной части")]
  public void QuickQuoteAnswerNamesThePreliminaryTotalFromTheService()
  {
    const decimal Total = 19800.00m;

    var text = QuickQuotes.Text(new PreliminaryPrice(
        "calc-01",
        "Лом бетона и железобетона",
        "Комплекс переработки «Восток»",
        Total,
        "RUB",
        new DateOnly(2026, 9, 17)));

    Assert.Contains(Total.ToString("C2", Russian), text, StringComparison.Ordinal);
    Assert.Contains("Комплекс переработки «Восток»", text, StringComparison.Ordinal);
    Assert.Contains("Лом бетона и железобетона", text, StringComparison.Ordinal);
    Assert.Contains("17.09.2026", text, StringComparison.Ordinal);
  }

  /// Проверка падает, если ответ перестанет называть себя предварительным:
  /// без пометки участник прочитает цену как окончательную (R-059).
  ///
  /// @ac: AC-072b
  [Fact(DisplayName = "ответ на короткий расчёт помечен как предварительный")]
  public void QuickQuoteAnswerIsMarkedAsPreliminary()
  {
    var text = QuickQuotes.Text(new PreliminaryPrice(
        "calc-01",
        "Лом бетона и железобетона",
        "Комплекс переработки «Восток»",
        19800.00m,
        "RUB",
        new DateOnly(2026, 9, 17)));

    Assert.Contains(QuickQuotes.PreliminaryMark, text, StringComparison.Ordinal);
    Assert.Contains("мини-приложении", text, StringComparison.Ordinal);
  }
}
