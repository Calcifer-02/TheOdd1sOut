using System.Text.RegularExpressions;
using Xunit;

namespace Imolt.Contracts.Tests;

/// Проверка связки «сценарий использования — документ-владелец». Реестр
/// требований, приёмочные тесты и договор ссылаются на `UC-id`; единственный
/// источник карточек — СЦЕНАРИИ_ИСПОЛЬЗОВАНИЯ.md. До этой проверки ссылка на
/// несуществующий сценарий ничем не ловилась: документ полгода оставался
/// шаблоном, а ссылки на него были во всех трёх местах.
///
/// Проверка фальсифицируема: она падает, если удалить карточку, сослаться на
/// незаведённый номер сценария или завести две карточки под одним номером.
///
///   dotnet test tests/contracts/Imolt.Contracts.Tests
///
public sealed class UseCaseRegistryTests
{
  private static readonly string RepositoryRoot = FindRepositoryRoot();

  private static readonly string UseCasesPath = Path.Combine(
      RepositoryRoot, "docs", "ПАКЕТ_АНАЛИТИКИ", "СЦЕНАРИИ_ИСПОЛЬЗОВАНИЯ.md");

  private static readonly string RequirementsPath = Path.Combine(
      RepositoryRoot, "docs", "ПАКЕТ_АНАЛИТИКИ", "РЕЕСТР_ТРЕБОВАНИЙ.md");

  private static readonly string AcceptancePath = Path.Combine(
      RepositoryRoot, "docs", "ПАКЕТ_АНАЛИТИКИ", "ПРИЁМОЧНЫЕ_ТЕСТЫ.md");

  [Fact(DisplayName = "у каждого сценария из реестра требований есть карточка")]
  public void RequirementsReferenceOnlyDeclaredUseCases()
  {
    var declared = DeclaredUseCases();
    var referenced = Referenced(RequirementsPath);

    Assert.NotEmpty(referenced);
    Assert.Empty(referenced.Except(declared).OrderBy(id => id, StringComparer.Ordinal));
  }

  [Fact(DisplayName = "у каждого сценария из приёмочных тестов есть карточка")]
  public void AcceptanceCriteriaReferenceOnlyDeclaredUseCases()
  {
    var declared = DeclaredUseCases();
    var referenced = Referenced(AcceptancePath);

    Assert.NotEmpty(referenced);
    Assert.Empty(referenced.Except(declared).OrderBy(id => id, StringComparer.Ordinal));
  }

  [Fact(DisplayName = "две карточки под одним номером сценария не заводятся")]
  public void EveryUseCaseHasExactlyOneCard()
  {
    var duplicates = CardHeadings()
        .GroupBy(id => id, StringComparer.Ordinal)
        .Where(group => group.Count() > 1)
        .Select(group => group.Key)
        .ToList();

    Assert.Empty(duplicates);
  }

  // Карточка объявляется заголовком третьего уровня: параллельного сводного
  // реестра сценариев вид не предусматривает, и второго места объявления нет.
  private static HashSet<string> DeclaredUseCases()
      => CardHeadings().ToHashSet(StringComparer.Ordinal);

  private static List<string> CardHeadings()
      => Regex.Matches(File.ReadAllText(UseCasesPath), @"^###\s+(UC-\d{3})\s+—", RegexOptions.Multiline)
          .Select(match => match.Groups[1].Value)
          .ToList();

  private static HashSet<string> Referenced(string path)
      => Regex.Matches(File.ReadAllText(path), @"UC-\d{3}")
          .Select(match => match.Value)
          .ToHashSet(StringComparer.Ordinal);

  private static string FindRepositoryRoot()
  {
    var directory = new DirectoryInfo(AppContext.BaseDirectory);

    while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "trip.json")))
    {
      directory = directory.Parent;
    }

    return directory?.FullName
        ?? throw new InvalidOperationException("Корень репозитория не найден: рядом нет trip.json");
  }
}
