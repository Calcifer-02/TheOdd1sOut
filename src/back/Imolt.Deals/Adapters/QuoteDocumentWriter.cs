using System.Globalization;
using Imolt.Deals.Contracts;
using Imolt.Deals.Ports;
using PdfSharp.Drawing;
using PdfSharp.Fonts;
using PdfSharp.Pdf;

namespace Imolt.Deals.Adapters;

/// Печать коммерческого предложения на одном листе A4 (R-036, R-037).
///
/// Документ читает человек, поэтому суммы и даты печатаются русской локалью
/// (R-061), а на границе службы та же сумма остаётся строкой с точкой по
/// схеме Money. Два представления одной величины — разные слои, и смешивать
/// их нельзя.
///
/// Документ собирается из снимка цен, а не из справочников: пересчитанный при
/// скачивании, он разошёлся бы с тем, что клиент уже видел.
///
/// @req: R-036, R-037, R-038, R-059, R-061
/// @adr: ADR-0005
public sealed class QuoteDocumentWriter : IQuoteDocumentWriter
{
  private const double Margin = 48;

  private const double LineHeight = 16;

  private static readonly CultureInfo Russian = new("ru-RU");

  static QuoteDocumentWriter()
  {
    // Распознаватель шрифтов глобален на процесс: второе место его задания
    // разошлось бы с первым, и документ печатался бы разными шрифтами в
    // зависимости от того, кто успел раньше.
    GlobalFontSettings.FontResolver = new CyrillicFontResolver();
  }

  public byte[] Render(QuoteDocumentModel model)
  {
    using var document = new PdfDocument();
    var page = document.AddPage();
    page.Size = PdfSharp.PageSize.A4;

    using var canvas = XGraphics.FromPdfPage(page);
    var regular = new XFont(CyrillicFontResolver.FamilyName, 10);
    var bold = new XFont(CyrillicFontResolver.FamilyName, 12, XFontStyleEx.Bold);

    var y = Margin;

    void Write(string text, XFont font)
    {
      canvas.DrawString(
          text,
          font,
          XBrushes.Black,
          new XRect(Margin, y, page.Width.Point - (2 * Margin), LineHeight),
          XStringFormats.TopLeft);
      y += LineHeight;
    }

    Write($"Коммерческое предложение {model.Number}", bold);
    y += LineHeight / 2;

    Write($"Дата выпуска: {Date(model.IssuedAt)}", regular);
    Write($"Дата расчёта: {Date(model.CalculatedAt)}", regular);
    Write($"Цена действует до: {model.ValidUntil.ToString("dd.MM.yyyy", Russian)}", regular);

    if (!string.IsNullOrWhiteSpace(model.CustomerName))
    {
      Write($"Получатель: {model.CustomerName}", regular);
    }

    Write($"Адрес вывоза: {model.PickupAddress}", regular);
    y += LineHeight / 2;

    Write("Состав расчёта", bold);

    foreach (var line in model.Lines)
    {
      Write($"{line.WasteGroupName} — {Amount(line.InputValue)} {Unit(line.Unit)}, полигон «{line.LandfillName}»", regular);
      Write($"    перевозка: {Rubles(line.TransportCost.Amount)}", regular);

      // Ноль означал бы бесплатный приём, а утилизация может быть выключена
      // вовсе (R-021): тогда строки о ней в документе нет.
      if (line.DisposalCost is { } disposal)
      {
        Write($"    утилизация: {Rubles(disposal.Amount)}", regular);
      }

      Write($"    совокупная цена: {Rubles(line.TotalCost.Amount)}", regular);
    }

    y += LineHeight / 2;
    Write($"Итого: {Rubles(model.Total.Amount)}", bold);
    y += LineHeight / 2;

    // Отметка о предварительности обязательна: молчание о ней в документе с
    // ценами читается как окончательная смета (R-059).
    Write("Цена предварительная. Окончательная стоимость уточняется при согласовании вывоза.", regular);

    using var stream = new MemoryStream();
    document.Save(stream);

    return stream.ToArray();
  }

  private static string Date(DateTimeOffset moment) => moment.ToString("dd.MM.yyyy", Russian);

  private static string Amount(decimal value) => value.ToString("0.###", Russian);

  private static string Rubles(decimal value) => value.ToString("N2", Russian) + " ₽";

  private static string Unit(string unit) => unit == "m3" ? "м³" : "т";
}

/// Распознаватель шрифта с кириллицей. Встроенные шрифты формата PDF
/// кириллицы не несут, а системный набор различается: в образе службы
/// установлен DejaVu, на машине разработчика — шрифты Windows. Отсутствие
/// шрифта называется прямо: документ с квадратами вместо букв хуже отказа.
internal sealed class CyrillicFontResolver : IFontResolver
{
  public const string FamilyName = "Imolt";

  private const string Regular = "imolt#regular";

  private const string Bold = "imolt#bold";

  private static readonly string[] RegularCandidates =
  [
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      @"C:\Windows\Fonts\arial.ttf",
  ];

  private static readonly string[] BoldCandidates =
  [
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
      @"C:\Windows\Fonts\arialbd.ttf",
  ];

  public byte[]? GetFont(string faceName)
  {
    var candidates = faceName == Bold ? BoldCandidates : RegularCandidates;
    var path = candidates.FirstOrDefault(File.Exists)
        // Начертание без жирного — не повод отказывать: обычное подойдёт.
        ?? RegularCandidates.FirstOrDefault(File.Exists);

    return path is null
        ? throw new InvalidOperationException(
            "Шрифт с кириллицей не найден. Ожидались: " + string.Join(", ", RegularCandidates))
        : File.ReadAllBytes(path);
  }

  public FontResolverInfo? ResolveTypeface(string familyName, bool isBold, bool isItalic)
      => new(isBold ? Bold : Regular);
}
