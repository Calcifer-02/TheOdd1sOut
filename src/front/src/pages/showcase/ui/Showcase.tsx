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
 * Состояния наведения и фокуса воспроизводятся указателем и клавиатурой, а не
 * снимком: подделывать их разметкой значило бы показывать не то, что увидит
 * пользователь.
 *
 * @req: R-084
 * @adr: ADR-0008
 */
import { useState, type ReactNode } from 'react';
import { OptionCard, StatusBadge, type BadgeStatus } from '@/entities/landfill';
import { Field, Notice, RadioPills, Sheet, SuggestList } from '@/shared/ui';
import { SummaryBar } from '@/widgets/selection-summary';
import type { PlacementOption } from '@/shared/api/contracts';

/** Показательный полигон: числа примера договора, чтобы витрина не выдумывала. */
const SAMPLE_OPTION: PlacementOption = {
  landfillId: 'vostok-timohovo',
  landfillName: 'Восток-Тимохово',
  address: 'Московская обл, Ногинский р-н',
  distanceKm: 45,
  transportCost: { amount: '10800.00', currency: 'RUB' },
  disposalCost: { amount: '9000.00', currency: 'RUB' },
  totalCost: { amount: '19800.00', currency: 'RUB' },
  status: 'active',
  statusUpdatedAt: '2026-09-17',
};

const STATUSES: BadgeStatus[] = ['active', 'blocked', 'unconfirmed', 'stale'];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="imolt-card" aria-labelledby={`vitrina-${title}`}>
      <h2 className="imolt-section" id={`vitrina-${title}`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Showcase() {
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<'t' | 'm3'>('t');
  const [sheetOpen, setSheetOpen] = useState(false);

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

      <Section title="Кнопки">
        <div className="imolt-row">
          <button type="button" className="imolt-button">
            Главное действие
          </button>
          <button type="button" className="imolt-button" disabled>
            Недоступна
          </button>
        </div>
        <div className="imolt-row">
          <button type="button" className="imolt-button imolt-button--secondary">
            Второе действие
          </button>
          <button type="button" className="imolt-button imolt-button--tertiary">
            Третье действие
          </button>
        </div>
      </Section>

      <Section title="Поля ввода">
        <Field
          id="vitrina-pole"
          label="Обычное поле"
          value={text}
          placeholder="Наберите значение"
          onChange={setText}
        />
        <Field
          id="vitrina-pole-podskazka"
          label="Поле с пояснением"
          value="20"
          hint="≈ 40 т"
          inputMode="decimal"
          onChange={() => undefined}
        />
        <Field
          id="vitrina-pole-otkaz"
          label="Поле с отказом"
          value="Годовикова"
          error="Выберите адрес из подсказки"
          onChange={() => undefined}
        />
        <div className="imolt-row">
          <Field
            id="vitrina-pole-kolichestvo"
            className="imolt-field--amount"
            label="Объём"
            value="20"
            inputMode="decimal"
            onChange={() => undefined}
          />
          <RadioPills
            className="imolt-units"
            name="vitrina-mera"
            label="Мера объёма"
            value={unit}
            options={[
              { value: 't' as const, label: 'тонны' },
              { value: 'm3' as const, label: 'кубометры' },
            ]}
            onPick={setUnit}
          />
        </div>
      </Section>

      <Section title="Подсказки">
        <SuggestList
          label="Подсказки адреса"
          items={['г Москва, ул Годовикова, д 9', 'г Москва, ул Годовикова, д 9 стр 3']}
          render={(item) => item}
          onPick={() => undefined}
        />
      </Section>

      <Section title="Сообщения">
        <Notice kind="error">Отказ: расчёт не выполнен</Notice>
        <Notice kind="warning">Предупреждение: полигон заблокирован</Notice>
        <Notice kind="empty">Пусто: подходящих полигонов не нашлось</Notice>
        <Notice kind="done">Готово: заявка принята</Notice>
      </Section>

      <Section title="Состояния полигона">
        {STATUSES.map((status) => (
          <div className="imolt-split" key={status}>
            <StatusBadge status={status} statusUpdatedAt="2026-09-17" />
          </div>
        ))}
      </Section>

      <Section title="Карточка полигона">
        <ul className="imolt-options">
          <OptionCard
            option={SAMPLE_OPTION}
            status="active"
            selected={false}
            onToggle={() => undefined}
            onRoute={() => undefined}
          />
          <OptionCard
            option={SAMPLE_OPTION}
            status="active"
            selected
            onToggle={() => undefined}
            onRoute={() => undefined}
          />
          <OptionCard
            option={{ ...SAMPLE_OPTION, status: 'blocked', disposalCost: null }}
            status="blocked"
            selected={false}
            onToggle={() => undefined}
            onRoute={() => undefined}
          />
        </ul>
      </Section>

      <Section title="Лист">
        <button type="button" className="imolt-button--tertiary" onClick={() => setSheetOpen(true)}>
          Показать лист
        </button>
        {sheetOpen && (
          <Sheet title="Детали маршрута" onClose={() => setSheetOpen(false)}>
            <p className="imolt-lead">Содержимое листа.</p>
          </Sheet>
        )}
      </Section>

      <Section title="Сводка выбора">
        <SummaryBar
          selectedCount={2}
          total="19 800 ₽"
          downloadLabel="Скачать предложение"
          onDownload={() => undefined}
          onPickup={() => undefined}
        />
      </Section>
    </div>
  );
}
