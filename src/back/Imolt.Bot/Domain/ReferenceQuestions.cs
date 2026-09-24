namespace Imolt.Bot.Domain;

/// О чём участник спросил в переписке. Различаются только те вопросы, на
/// которые у сервиса есть хранимый ответ: остальное чат-бот не разбирает
/// впрок и не угадывает (R-075).
///
/// @supports: R-073
public enum ReferenceTopic
{
  /// Вопрос не о справочнике сервиса либо признак вопроса не распознан.
  Unknown,

  /// Тариф утилизации полигона (R-073).
  LandfillTariff,

  /// Коэффициент плотности группы отходов (R-073).
  WasteGroupDensity,
}

/// Разобранный вопрос: о чём спрашивают и о каком предмете справочника.
///
/// `Subject` — то, по чему справочник ищет запись: название полигона или
/// группы отходов. Пустой предмет — рабочее состояние: участник назвал
/// признак вопроса, но не назвал, о чём именно спрашивает.
///
/// @supports: R-073
public sealed record ReferenceQuestion(ReferenceTopic Topic, string Subject);

/// Разбор вопроса участника (R-073).
///
/// Разбор нарочно грубый: чат-бот определяет только признак вопроса и
/// вычленяет название, а искать запись по названию — дело справочника
/// сервиса. Своего словаря полигонов и групп отходов у бота нет и быть не
/// может (ADR-0009, инвариант 4).
///
/// @req: R-073
/// @adr: ADR-0009
public static class ReferenceQuestions
{
  /// Признаки вопроса о тарифе утилизации. Спрашивают по-разному: о тарифе,
  /// о цене приёма, о стоимости утилизации.
  private static readonly string[] TariffMarkers =
  [
    "тариф",
    "приём",
    "прием",
    "утилизац",
  ];

  /// Признаки вопроса о коэффициенте плотности.
  private static readonly string[] DensityMarkers =
  [
    "плотност",
    "тонн в куб",
  ];

  /// Слова, с которых начинается уточнение, а не название. Отбрасываются с
  /// начала хвоста: «на полигоне Восток» — это «Восток».
  private static readonly string[] LeadingWords =
  [
    "на", "в", "у", "по", "для", "с", "со", "о", "об", "про", "за",
    "полигон", "полигона", "полигоне",
    "группа", "группы", "группе",
    "отход", "отхода", "отходы", "отходов",
    "мусор", "мусора",
    "этого", "этой", "того", "той",
  ];

  /// Пары кавычек, которыми участник выделяет название. Внутри кавычек —
  /// точный предмет вопроса, и отбрасывать из него ничего не нужно.
  private static readonly (char Open, char Close)[] Quotes =
  [
    ('«', '»'),
    ('"', '"'),
  ];

  public static ReferenceQuestion Parse(string? text)
  {
    if (string.IsNullOrWhiteSpace(text))
    {
      return new ReferenceQuestion(ReferenceTopic.Unknown, string.Empty);
    }

    var lowered = text.ToLowerInvariant();

    var tariff = FirstMarker(lowered, TariffMarkers);
    var density = FirstMarker(lowered, DensityMarkers);

    // Признаков может оказаться два сразу («сколько стоит приём тонны при
    // плотности…»). Выигрывает названный раньше: участник начинает с того,
    // что спрашивает.
    var (topic, marker) = (tariff, density) switch
    {
      ( < 0, < 0) => (ReferenceTopic.Unknown, -1),
      ( < 0, var d) => (ReferenceTopic.WasteGroupDensity, d),
      (var t, < 0) => (ReferenceTopic.LandfillTariff, t),
      var (t, d) when d < t => (ReferenceTopic.WasteGroupDensity, d),
      var (t, _) => (ReferenceTopic.LandfillTariff, t),
    };

    if (topic == ReferenceTopic.Unknown)
    {
      return new ReferenceQuestion(ReferenceTopic.Unknown, string.Empty);
    }

    return new ReferenceQuestion(topic, Subject(text, marker));
  }

  /// Положение самого раннего признака из набора; -1, если ни одного нет.
  private static int FirstMarker(string lowered, string[] markers)
  {
    var found = -1;

    foreach (var marker in markers)
    {
      var at = lowered.IndexOf(marker, StringComparison.Ordinal);

      if (at >= 0 && (found < 0 || at < found))
      {
        found = at;
      }
    }

    return found;
  }

  /// Название предмета вопроса: взятое в кавычки — как есть, иначе хвост
  /// после признака вопроса без ведущих уточнений и конечных знаков.
  private static string Subject(string text, int marker)
  {
    var quoted = Quoted(text);

    if (quoted is not null)
    {
      return quoted;
    }

    var tail = text[marker..];

    // Само слово-признак в название не входит: «плотность лома бетона» — это
    // «лома бетона».
    var space = tail.IndexOf(' ');
    tail = space < 0 ? string.Empty : tail[(space + 1)..];

    return Trim(tail);
  }

  private static string? Quoted(string text)
  {
    foreach (var (open, close) in Quotes)
    {
      var from = text.IndexOf(open);

      if (from < 0)
      {
        continue;
      }

      var to = text.IndexOf(close, from + 1);

      if (to > from + 1)
      {
        return text[(from + 1)..to].Trim();
      }
    }

    return null;
  }

  private static string Trim(string tail)
  {
    var words = tail.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    var from = 0;

    while (from < words.Length
        && LeadingWords.Contains(Clean(words[from]).ToLowerInvariant(), StringComparer.Ordinal))
    {
      from++;
    }

    var kept = words[from..].Select(Clean).Where(word => word.Length > 0);

    return string.Join(' ', kept);
  }

  /// Слово без знаков препинания по краям: вопросительный знак и запятая —
  /// часть фразы, а не названия. Регистр сохраняется: название уходит в
  /// справочник поисковым запросом, и приводить его к нижнему регистру —
  /// решать за справочник, как он ищет.
  private static string Clean(string word) =>
      word.Trim('?', '!', '.', ',', ':', ';', '(', ')');
}
