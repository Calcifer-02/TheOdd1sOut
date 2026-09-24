/**
 * Витрина компонентов (R-084).
 *
 * Показывает каждый компонент интерфейса во всех объявленных состояниях на
 * одной странице. Смысл витрины — не каталог ради каталога: замечание по
 * вёрстке снимается отсюда за минуту, а не вылавливается по экранам, и смена
 * семантического токена видна сразу на всех потребителях (карточка практики
 * PRACT-017).
 *
 * Витрина собрана из тех же модулей, что и экраны: второй реализации
 * компонента здесь нет и быть не должно, иначе она разойдётся с настоящей и
 * станет врать.
 *
 * Этот файл — только рамка. Образцы живут в разделах рядом, по одному на
 * область экранов: разделы пишутся разными руками, и общий файл витрины стал
 * бы местом, где правки сталкиваются.
 *
 * Состояния наведения и фокуса воспроизводятся указателем и клавиатурой, а не
 * снимком: подделывать их разметкой значило бы показывать не то, что увидит
 * пользователь.
 *
 * @req: R-084
 * @adr: ADR-0008
 */
import { CabinetSection } from '../sections/cabinet';
import { CalculatorSection } from '../sections/calculator';
import { LandfillsSection } from '../sections/landfills';
import { QuoteSection } from '../sections/quote';
import { ReferencesSection } from '../sections/references';
import { SharedSection } from '../sections/shared';

export function Showcase() {
  return (
    <div className="imolt-page">
      <header className="imolt-header">
        <span className="imolt-brand">ИМОЛТ</span>
        <span>Витрина компонентов</span>
      </header>

      <h1 className="imolt-title">Витрина компонентов</h1>
      <p className="imolt-lead">
        Каждый компонент интерфейса во всех объявленных состояниях. Наведение и фокус проверяются
        указателем и клавиатурой прямо здесь.
      </p>

      <SharedSection />
      <CalculatorSection />
      <LandfillsSection />
      <QuoteSection />
      <CabinetSection />
      <ReferencesSection />
    </div>
  );
}
