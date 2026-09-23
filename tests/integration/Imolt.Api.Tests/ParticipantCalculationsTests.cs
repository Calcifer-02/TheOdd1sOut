using Xunit;

namespace Imolt.Api.Tests;

/// Раздел «Расчёты» личного кабинета (R-008, R-049). Расчёт доступен гостю —
/// это решение принято и закреплено схемой хранилища: владелец расчёта
/// необязателен. Отсюда и проверяемое свойство: сохранённым считается расчёт,
/// сделанный с маркером, а гостевой не принадлежит никому и в кабинете не
/// показывается.
///
/// Проверяются обе стороны. Без гостевого расчёта проверка прошла бы и на
/// службе, которая отдаёт кабинету всё подряд: список, где есть свой расчёт,
/// ничего не говорит о чужих.
///
/// Разграничение здесь — принадлежность записи, а не политика подписки: что
/// именно закрыто подпиской, заказчиком не установлено (Q-011), и проверка не
/// решает это за него.
///
/// Проверка фальсифицируема: она падает, если кабинет перестанет отдавать
/// расчёт участника и если покажет в его списке расчёт, сделанный без маркера.
///
///   dotnet test tests/integration/Imolt.Api.Tests
///
/// @ac: AC-008a
[Collection(ImoltAccessCollection.Name)]
public sealed class ParticipantCalculationsTests(ImoltAccessStand stand)
{
  [Fact(DisplayName = "кабинет показывает расчёты участника и не показывает чужие")]
  public async Task CabinetListsOwnCalculationsAndOmitsGuestOnes()
  {
    const long maxUserId = 880801;
    var token = await AccessChecks.TokenAsync(stand.Client, maxUserId);

    // Два одинаковых по данным расчёта, различающиеся только маркером:
    // различить их по содержанию нельзя, и в списке они могут разойтись
    // только по принадлежности.
    var ownCalculationId = await AccessChecks.CreateCalculationAsync(stand.Client, token);
    var guestCalculationId = await AccessChecks.CreateCalculationAsync(stand.Client, token: null);

    var response = await AccessChecks.GetAsync(stand.Client, AccessChecks.CalculationsPath, token);
    using var page = await ReferenceChecks.OkAsync(response, "listCalculations");

    var listed = ReferenceChecks.Ids(page.RootElement);

    Assert.Contains(ownCalculationId, listed);
    Assert.DoesNotContain(guestCalculationId, listed);
  }
}
