using Imolt.Calculations.Contracts;
using Imolt.Calculations.Domain;
using Imolt.Calculations.Ports;
using Imolt.Shared;

namespace Imolt.Calculations.Application;

/// Сценарии области «расчёт»: пересчёт мер, создание расчёта, подбор
/// полигонов, выбор и распределение объёма.
///
/// Варианты размещения не хранятся, а считаются при каждом чтении: цена
/// группы и тариф полигона — данные справочников, и снимок цен делается один
/// раз, при выпуске коммерческого предложения (R-036). Закрепляется в расчёте
/// другое — адрес, объёмы, предел расстояния и дата актуальности данных
/// (R-048).
///
/// @req: R-014, R-018, R-020, R-021, R-023, R-024, R-025, R-026, R-027, R-028, R-029, R-030, R-032, R-058, R-059, R-060
/// @adr: ADR-0001
public sealed class CalculationScenarios(
    IReferenceData references,
    IRoadDistances distances,
    ITransportCoefficients coefficients,
    ICalculationStore store,
    IClock clock)
{
  /// Первая страница вариантов размещения внутри расчёта (R-029, R-060).
  /// Остальные страницы берутся отдельной операцией.
  private const int FirstPageSize = 10;

  /// Пересчёт объёма между мерами. Обе меры возвращаются рядом: мера расчёта
  /// заказчиком не выбрана (Q-009), и решать за него сервер не будет.
  public async Task<AmountConversionResult> ConvertAsync(
      AmountConversionRequest? request,
      CancellationToken cancellationToken)
  {
    var items = new List<AmountConversionResultItem>();

    foreach (var item in Required(request?.Items, "items"))
    {
      // Здесь незаведённая группа — именно отсутствие записи (404), а не
      // ошибка запроса: операция только пересчитывает, и подставить вместо
      // коэффициента ноль значило бы сказать клиенту, что отходов нет.
      var group = await references.WasteGroupAsync(item.WasteGroupId, cancellationToken)
          ?? throw new ReferenceMissingException(
              $"Группа отходов {item.WasteGroupId} не заведена в справочнике");

      var unit = UnitOf(item.Quantity);
      var value = Amount(item.Quantity);

      items.Add(new AmountConversionResultItem(
          group.Id,
          item.Quantity,
          AmountConversion.ToTons(value, unit, group.DensityTonPerCubicMeter),
          AmountConversion.ToCubicMeters(value, unit, group.DensityTonPerCubicMeter),
          group.DensityTonPerCubicMeter));
    }

    return new AmountConversionResult(items);
  }

  /// Создание расчёта: главная операция сервиса (R-002, R-018).
  public async Task<Calculation> CreateAsync(
      CalculationRequest? request,
      string? subscriberId,
      CancellationToken cancellationToken)
  {
    var pickup = request?.PickupAddress
        ?? throw new ArgumentOutOfRangeException(nameof(request), "адрес вывоза обязателен");

    // Предел расстояния закрепляется в расчёте, а не подставляется заново при
    // каждом чтении: иначе смена значения по умолчанию молча изменила бы
    // смысл уже сохранённого расчёта (R-026).
    var distance = Checked(request.DistanceFilter)
        ?? new DistanceFilter(DistanceFilter.AtMost, DistanceFilter.DefaultKm);

    var freshness = await references.FreshnessAsync(cancellationToken);
    var stored = new List<StoredItem>();

    foreach (var item in Required(request.Items, "items"))
    {
      var group = await GroupAsync(item.WasteGroupId, cancellationToken);

      stored.Add(new StoredItem(
          group.Id,
          item.Quantity,
          AmountConversion.ToTons(
              Amount(item.Quantity), UnitOf(item.Quantity), group.DensityTonPerCubicMeter)));
    }

    var calculation = new StoredCalculation(
        Guid.NewGuid().ToString(),
        clock.Now,
        pickup,
        request.DisposalRequired,
        distance,
        freshness.PricesUpdatedAt,
        freshness.StatusesUpdatedAt,
        stored,
        [],
        [],
        // Владелец необязателен: расчёт доступен гостю (R-050), и кабинет
        // показывает только расчёты участника (R-008).
        subscriberId);

    // Подбор идёт до записи: если плеча перевозки нет, расчёт отказывает
    // целиком, и сохранённая наполовину заготовка осталась бы мусором.
    var results = await ResultsAsync(calculation, cancellationToken);

    await store.SaveAsync(calculation, cancellationToken);

    return await AssembleAsync(calculation, results, cancellationToken);
  }

  public async Task<Calculation?> FindAsync(string id, CancellationToken cancellationToken)
  {
    var calculation = await store.FindAsync(id, cancellationToken);

    return calculation is null
        ? null
        : await AssembleAsync(
            calculation, await ResultsAsync(calculation, cancellationToken), cancellationToken);
  }

  /// Сохранённые расчёты кабинета (R-049). Гостевые расчёты сюда не
  /// попадают: у них нет владельца.
  public async Task<Page<CalculationSummary>> ListAsync(
      string subscriberId,
      PageRequest page,
      CancellationToken cancellationToken)
  {
    var ids = await store.ListAsync(subscriberId, page, cancellationToken);
    var items = new List<CalculationSummary>();

    foreach (var id in ids.Items)
    {
      var calculation = await store.FindAsync(id, cancellationToken);

      if (calculation is null)
      {
        continue;
      }

      var selection = await SavedSelectionAsync(calculation, cancellationToken);

      items.Add(new CalculationSummary(
          calculation.Id,
          calculation.CreatedAt,
          calculation.PickupAddress.Value,
          selection?.Total ?? Money.Rubles(0)));
    }

    return Pages.Of(items, ids.Total, page);
  }

  /// Страница вариантов размещения одной вкладки: своя сортировка, свой
  /// предел расстояния и своё постраничное чтение (R-024, R-025, R-060).
  public async Task<PlacementOptionPage?> OptionsAsync(
      string calculationId,
      PlacementQuery query,
      PageRequest page,
      CancellationToken cancellationToken)
  {
    var calculation = await store.FindAsync(calculationId, cancellationToken);
    var item = calculation?.Items.FirstOrDefault(stored => stored.WasteGroupId == query.WasteGroupId);

    if (calculation is null || item is null)
    {
      return null;
    }

    var (options, emptyReason) = await OptionsAsync(calculation, item, query.Distance, cancellationToken);

    return Paged(Sorted(options, query), emptyReason, page.Limit, page.Offset);
  }

  /// Выбор полигонов целиком: пустой набор снимает выбор (R-027).
  public async Task<SelectionState?> SelectAsync(
      string calculationId,
      IReadOnlyList<SelectionEntry>? entries,
      CancellationToken cancellationToken)
  {
    var calculation = await store.FindAsync(calculationId, cancellationToken);

    if (calculation is null)
    {
      return null;
    }

    var chosen = entries ?? [];
    var total = Money.Rubles(0);
    var warnings = new List<SelectionWarning>();

    foreach (var entry in chosen)
    {
      var (offer, cost) = await PricedAsync(
          calculation, entry.WasteGroupId, entry.LandfillId, null, cancellationToken);

      total += cost.TotalCost;
      Warn(warnings, offer, calculation.StatusesUpdatedAt);
    }

    await store.SaveSelectionAsync(calculationId, chosen, cancellationToken);

    // Сколько полигонов отмечено: строка выбора — это пара «группа отходов и
    // полигон», и один и тот же полигон по двум группам отмечается дважды.
    return new SelectionState(chosen, chosen.Count, total, warnings);
  }

  /// Распределение объёма группы между полигонами (R-030). Сумма частей
  /// обязана совпасть с объёмом группы, иначе не применяется ничего.
  public async Task<AllocationState?> AllocateAsync(
      string calculationId,
      IReadOnlyList<AllocationEntry>? entries,
      CancellationToken cancellationToken)
  {
    var calculation = await store.FindAsync(calculationId, cancellationToken);

    if (calculation is null)
    {
      return null;
    }

    var parts = entries ?? [];

    // Сходимость проверяется до первой записи: отказ обязан оставить прежнее
    // распределение нетронутым, а не переписать его наполовину (R-030).
    await EnsureAddsUpAsync(calculation, parts, cancellationToken);

    var state = await PricedAllocationAsync(calculation, parts, cancellationToken);
    await store.SaveAllocationAsync(calculationId, parts, cancellationToken);

    return state;
  }

  /// Сводка маршрута по выбранным полигонам (R-032, R-050).
  ///
  /// Детали закрыты: личности пользователя у службы пока нет, а что именно
  /// открывает подписка, заказчиком не установлено (Q-011). Отказать кодом
  /// было бы неверно — итог гостю виден и сейчас, закрыты только участки
  /// маршрута. Поэтому ответ несёт признак доступа, а не код отказа.
  public async Task<RouteSummary?> RouteAsync(string calculationId, CancellationToken cancellationToken)
  {
    var calculation = await store.FindAsync(calculationId, cancellationToken);

    if (calculation is null)
    {
      return null;
    }

    var selection = await SavedSelectionAsync(calculation, cancellationToken);
    var access = new RouteAccess(false, RouteAccess.SubscriptionRequired);

    // Участки собираются только при выданном доступе: подменять закрытое
    // содержимое нечем, а заполнить его «на всякий случай» значит выдать то,
    // что объявлено закрытым.
    return new RouteSummary(access, [], selection?.Total ?? Money.Rubles(0));
  }

  /// Строки выбранных полигонов с закреплёнными ценами — то, что коммерческое
  /// предложение переносит в снимок (R-036). Область «сделка» получает их
  /// портом: две области напрямую друг на друга не ссылаются (ADR-0001).
  public async Task<IReadOnlyList<PricedSelection>> PricedSelectionAsync(
      string calculationId,
      CancellationToken cancellationToken)
  {
    var calculation = await store.FindAsync(calculationId, cancellationToken);

    if (calculation is null)
    {
      return [];
    }

    var lines = new List<PricedSelection>();

    foreach (var entry in calculation.Selection)
    {
      var group = await GroupAsync(entry.WasteGroupId, cancellationToken);
      var item = calculation.Items.First(stored => stored.WasteGroupId == entry.WasteGroupId);
      var (offer, cost) = await PricedAsync(
          calculation, entry.WasteGroupId, entry.LandfillId, null, cancellationToken);

      lines.Add(new PricedSelection(
          entry.LandfillId,
          offer.Name,
          entry.WasteGroupId,
          group.Name,
          item.Tons,
          item.Input,
          cost.TransportCost,
          cost.DisposalCost,
          cost.TotalCost));
    }

    return lines;
  }

  // Сходимость частей с объёмом группы. Сверяются тонны, а не введённые
  // величины: часть можно задать в кубометрах, а группу — в тоннах.
  private async Task EnsureAddsUpAsync(
      StoredCalculation calculation,
      IReadOnlyList<AllocationEntry> entries,
      CancellationToken cancellationToken)
  {
    foreach (var group in entries.GroupBy(entry => entry.WasteGroupId))
    {
      var item = calculation.Items.FirstOrDefault(stored => stored.WasteGroupId == group.Key)
          ?? throw new AllocationMismatchException(
              $"Группы отходов {group.Key} в расчёте нет: распределять нечего");

      var pricing = await GroupAsync(group.Key, cancellationToken);
      var allocated = group.Sum(entry => AmountConversion.ToTons(
          Amount(entry.Quantity), UnitOf(entry.Quantity), pricing.DensityTonPerCubicMeter));

      // Сравнение по килограмму: доли килограмма пользователь не вводит, а
      // накопленная разница округлений не должна выглядеть расхождением.
      if (decimal.Round(allocated, 3) != decimal.Round(item.Tons, 3))
      {
        throw new AllocationMismatchException(
            $"По группе {group.Key} разложено {allocated:0.###} т из {item.Tons:0.###} т");
      }
    }
  }

  private async Task<AllocationState> PricedAllocationAsync(
      StoredCalculation calculation,
      IReadOnlyList<AllocationEntry> entries,
      CancellationToken cancellationToken)
  {
    var priced = new List<AllocationPricedEntry>();
    var total = Money.Rubles(0);

    foreach (var entry in entries)
    {
      var group = await GroupAsync(entry.WasteGroupId, cancellationToken);
      var tons = AmountConversion.ToTons(
          Amount(entry.Quantity), UnitOf(entry.Quantity), group.DensityTonPerCubicMeter);

      var (_, cost) = await PricedAsync(
          calculation, entry.WasteGroupId, entry.LandfillId, tons, cancellationToken);

      priced.Add(new AllocationPricedEntry(
          entry.WasteGroupId,
          entry.LandfillId,
          entry.Quantity,
          cost.TransportCost,
          cost.DisposalCost,
          cost.TotalCost));

      total += cost.TotalCost;
    }

    return new AllocationState(priced, total);
  }

  // Цена одной строки: либо на весь объём группы (выбор), либо на заданную
  // часть (распределение). Обе величины считаются одной формулой — второе
  // место расчёта разошлось бы с первым (R-018).
  private async Task<(LandfillOffer Offer, PlacementCost Cost)> PricedAsync(
      StoredCalculation calculation,
      string wasteGroupId,
      string landfillId,
      decimal? tons,
      CancellationToken cancellationToken)
  {
    var item = calculation.Items.FirstOrDefault(stored => stored.WasteGroupId == wasteGroupId)
        ?? throw new PlacementUnavailableException(
            $"Группы отходов {wasteGroupId} в этом расчёте нет");

    var group = await GroupAsync(wasteGroupId, cancellationToken);
    var offers = await references.OffersAsync(wasteGroupId, cancellationToken);
    var offer = offers.FirstOrDefault(candidate => candidate.Id == landfillId)
        ?? throw new PlacementUnavailableException(
            $"Полигон {landfillId} не принимает группу отходов {wasteGroupId}");

    var legs = await distances.FromAsync(calculation.PickupAddress.Coordinates, cancellationToken);

    if (!legs.TryGetValue(landfillId, out var distanceKm))
    {
      throw new PlacementUnavailableException(
          $"До полигона «{offer.Name}» не сохранено расстояние по дорожной сети от адреса вывоза");
    }

    var cost = PlacementCost.Of(
        tons ?? item.Tons,
        group.TransportPricePerTonKm,
        (decimal)distanceKm,
        calculation.DisposalRequired ? offer.DisposalPricePerTon : null,
        await coefficients.EffectiveAsync(cancellationToken));

    return (offer, cost);
  }

  // Вкладки результата: по одной на группу отходов расчёта.
  private async Task<IReadOnlyList<WasteGroupResult>> ResultsAsync(
      StoredCalculation calculation,
      CancellationToken cancellationToken)
  {
    var results = new List<WasteGroupResult>();

    foreach (var item in calculation.Items)
    {
      var (options, emptyReason) =
          await OptionsAsync(calculation, item, calculation.DistanceFilter, cancellationToken);

      results.Add(new WasteGroupResult(
          item.WasteGroupId,
          Paged(ByTotalCost(options), emptyReason, FirstPageSize, 0)));
    }

    return results;
  }

  // Подбор полигонов под одну группу отходов. Возвращает и причину пустоты:
  // по ней интерфейс выбирает подсказку — снять фильтр или сменить тип
  // отходов (R-029, Э-12).
  private async Task<(IReadOnlyList<PlacementOption> Options, string? EmptyReason)> OptionsAsync(
      StoredCalculation calculation,
      StoredItem item,
      DistanceFilter distance,
      CancellationToken cancellationToken)
  {
    var offers = await references.OffersAsync(item.WasteGroupId, cancellationToken);

    if (offers.Count == 0)
    {
      return ([], PlacementOptionPage.NoLandfillsForWasteGroup);
    }

    var legs = await distances.FromAsync(calculation.PickupAddress.Coordinates, cancellationToken);
    var known = offers.Where(offer => legs.ContainsKey(offer.Id)).ToList();

    // Полигоны есть, а плеч перевозки нет ни одного: считать по прямой нельзя
    // — заниженная цена хуже отказа, по ней заключают сделку (R-020).
    if (known.Count == 0)
    {
      throw new RoadDistanceUnavailableException(
          $"Для адреса «{calculation.PickupAddress.Value}» не сохранено ни одного расстояния "
          + "по дорожной сети: расчёт по прямой занизил бы стоимость перевозки");
    }

    var group = await GroupAsync(item.WasteGroupId, cancellationToken);
    var coefficient = await coefficients.EffectiveAsync(cancellationToken);

    var options = known
        .Where(offer => Fits(legs[offer.Id], distance))
        .Select(offer => Option(offer, legs[offer.Id], item.Tons, group, calculation.DisposalRequired, coefficient))
        .ToList();

    return (options, options.Count == 0 ? PlacementOptionPage.FilteredOutByDistance : null);
  }

  private static PlacementOption Option(
      LandfillOffer offer,
      double distanceKm,
      decimal tons,
      WasteGroupPricing group,
      bool disposalRequired,
      decimal coefficient)
  {
    var cost = PlacementCost.Of(
        tons,
        group.TransportPricePerTonKm,
        (decimal)distanceKm,
        disposalRequired ? offer.DisposalPricePerTon : null,
        coefficient);

    return new PlacementOption(
        offer.Id,
        offer.Name,
        offer.Address,
        distanceKm,
        cost.TransportCost,
        cost.DisposalCost,
        cost.TotalCost,
        offer.Status,
        offer.StatusUpdatedAt);
  }

  private async Task<Calculation> AssembleAsync(
      StoredCalculation calculation,
      IReadOnlyList<WasteGroupResult> results,
      CancellationToken cancellationToken)
  {
    var items = new List<CalculationItem>();

    foreach (var item in calculation.Items)
    {
      var group = await GroupAsync(item.WasteGroupId, cancellationToken);
      items.Add(new CalculationItem(group.Id, group.Name, item.Input, item.Tons));
    }

    return new Calculation(
        calculation.Id,
        calculation.CreatedAt,
        // Признак предварительности истинен всегда: допустимое отклонение
        // финальной цены заказчиком не названо (R-059, Q-010).
        true,
        calculation.PickupAddress,
        calculation.DisposalRequired,
        calculation.DistanceFilter,
        items,
        results,
        await SavedSelectionAsync(calculation, cancellationToken),
        calculation.Allocation.Count == 0
            ? null
            : await PricedAllocationAsync(calculation, calculation.Allocation, cancellationToken),
        await FreshnessAsync(calculation, cancellationToken));
  }

  // Даты берутся из расчёта — те, на которых он посчитан (R-048). Число
  // полигонов с устаревшими данными описывает не расчёт, а состояние
  // справочника сегодня, поэтому читается заново.
  private async Task<DataFreshness> FreshnessAsync(
      StoredCalculation calculation,
      CancellationToken cancellationToken)
  {
    var current = await references.FreshnessAsync(cancellationToken);

    return new DataFreshness(
        calculation.PricesUpdatedAt,
        calculation.StatusesUpdatedAt,
        current.LandfillsWithStaleData);
  }

  private async Task<SelectionState?> SavedSelectionAsync(
      StoredCalculation calculation,
      CancellationToken cancellationToken)
  {
    if (calculation.Selection.Count == 0)
    {
      return null;
    }

    var total = Money.Rubles(0);
    var warnings = new List<SelectionWarning>();

    foreach (var entry in calculation.Selection)
    {
      var (offer, cost) = await PricedAsync(
          calculation, entry.WasteGroupId, entry.LandfillId, null, cancellationToken);

      total += cost.TotalCost;
      Warn(warnings, offer, calculation.StatusesUpdatedAt);
    }

    return new SelectionState(calculation.Selection, calculation.Selection.Count, total, warnings);
  }

  // Предупреждение не отменяет выбор: решение остаётся за пользователем
  // (R-028). Поэтому здесь нет отказа — есть названная причина сомнения.
  private static void Warn(List<SelectionWarning> warnings, LandfillOffer offer, DateOnly statusesUpdatedAt)
  {
    if (offer.Status == "blocked")
    {
      warnings.Add(new SelectionWarning(
          SelectionWarning.LandfillBlocked,
          offer.Id,
          $"Полигон «{offer.Name}» не принимает отходы: статус обновлён {offer.StatusUpdatedAt:dd.MM.yyyy}"));
    }
    else if (offer.StatusUpdatedAt < statusesUpdatedAt)
    {
      warnings.Add(new SelectionWarning(
          SelectionWarning.LandfillDataStale,
          offer.Id,
          $"Сведения о полигоне «{offer.Name}» старше последнего обновления справочника"));
    }
  }

  // Неизвестная группа отходов внутри расчёта — ошибка запроса, а не
  // отсутствие записи: договор createCalculation объявляет 400, но не 404.
  private async Task<WasteGroupPricing> GroupAsync(string wasteGroupId, CancellationToken cancellationToken)
      => await references.WasteGroupAsync(wasteGroupId, cancellationToken)
          ?? throw new ArgumentOutOfRangeException(
              nameof(wasteGroupId), wasteGroupId, "такой группы отходов нет в справочнике");

  private static bool Fits(double distanceKm, DistanceFilter filter)
      => filter.Mode == DistanceFilter.AtLeast ? distanceKm >= filter.Km : distanceKm <= filter.Km;

  // Порядок по умолчанию — по возрастанию совокупной цены (R-024).
  // Идентификатор полигона вторым ключом делает порядок устойчивым: при
  // равных ценах ответ иначе менялся бы от запуска к запуску.
  private static IReadOnlyList<PlacementOption> ByTotalCost(IReadOnlyList<PlacementOption> options) =>
      [.. options
          .OrderBy(option => option.TotalCost.Amount)
          .ThenBy(option => option.LandfillId, StringComparer.Ordinal)];

  private static IReadOnlyList<PlacementOption> Sorted(
      IReadOnlyList<PlacementOption> options,
      PlacementQuery query)
  {
    var ordered = query.Sort switch
    {
      PlacementQuery.ByTransport => options.OrderBy(option => option.TransportCost.Amount),
      // Полигон без стоимости утилизации идёт как нулевой: сортировать по
      // величине, которой нет, нечем, а выбрасывать строку нельзя.
      PlacementQuery.ByDisposal => options.OrderBy(option => option.DisposalCost?.Amount ?? 0m),
      PlacementQuery.ByDistance => options.OrderBy(option => option.DistanceKm),
      _ => options.OrderBy(option => option.TotalCost.Amount),
    };

    var stable = ordered.ThenBy(option => option.LandfillId, StringComparer.Ordinal);

    return [.. query.Order == PlacementQuery.Descending ? stable.Reverse() : stable];
  }

  private static PlacementOptionPage Paged(
      IReadOnlyList<PlacementOption> options,
      string? emptyReason,
      int limit,
      int offset)
      => new(options.Count, limit, offset, [.. options.Skip(offset).Take(limit)], emptyReason);

  private static IReadOnlyList<T> Required<T>(IReadOnlyList<T>? items, string name)
      => items is { Count: > 0 }
          ? items
          : throw new ArgumentOutOfRangeException(name, "список не может быть пустым");

  private static decimal Amount(Quantity? quantity)
      => quantity?.Value ?? throw new ArgumentOutOfRangeException(nameof(quantity), "объём обязателен");

  private static AmountUnit UnitOf(Quantity quantity) => quantity.Unit switch
  {
    "t" => AmountUnit.Ton,
    "m3" => AmountUnit.CubicMeter,
    _ => throw new ArgumentOutOfRangeException(nameof(quantity), quantity.Unit, "мера объёма — t либо m3"),
  };

  private static DistanceFilter? Checked(DistanceFilter? filter)
  {
    if (filter is null)
    {
      return null;
    }

    if (filter.Mode is not (DistanceFilter.AtMost or DistanceFilter.AtLeast))
    {
      throw new ArgumentOutOfRangeException(
          nameof(filter), filter.Mode, "сторона фильтра расстояния — atMost либо atLeast");
    }

    return filter.Km is < 0 or > 1000
        ? throw new ArgumentOutOfRangeException(nameof(filter), filter.Km, "предел расстояния — от 0 до 1000 км")
        : filter;
  }
}
