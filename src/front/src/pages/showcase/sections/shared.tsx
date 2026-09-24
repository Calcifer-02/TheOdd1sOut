/**
 * Раздел витрины: примитивы общего слоя (R-084).
 *
 * Показываются те компоненты, которые объявляет `@/shared/ui`, — во всех
 * состояниях, названных дизайн-договором (разд. 4.4). Второй реализации здесь
 * нет: витрина собрана из тех же модулей, что и экраны.
 *
 * Числа и названия взяты из раздела 7 дизайн-договора: выдуманные величины
 * расчёта витрине запрещены так же, как экрану.
 *
 * @supports: R-084
 */
import { useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Chip,
  DataTable,
  DateStamp,
  EmptyState,
  Field,
  Notice,
  PhoneField,
  Pager,
  Popover,
  RadioPills,
  Modal,
  Select,
  Sheet,
  Skeleton,
  Stat,
  SuggestList,
  Tabs,
  Toolbar,
  type TableColumn,
  type TableSort,
} from '@/shared/ui';
import { Combobox } from '@/shared/ui/combobox';
import { Illustration } from '@/shared/ui/illustrations';
import { formatDistance, formatMoney } from '@/shared/lib/formatting';
import { Section } from '../ui/Section';

/** Строка сравнения полигонов из раздела 7 дизайн-договора. */
type ShowcaseRow = {
  id: string;
  name: string;
  distanceKm: number;
  transport: string;
  disposal: string;
  total: string;
};

const ROWS: ShowcaseRow[] = [
  {
    id: 'vostok',
    name: 'Комплекс переработки «Восток»',
    distanceKm: 45,
    transport: '10800.00',
    disposal: '9000.00',
    total: '19800.00',
  },
  {
    id: 'iksha',
    name: 'Площадка «Икша»',
    distanceKm: 52,
    transport: '12480.00',
    disposal: '7600.00',
    total: '20080.00',
  },
  {
    id: 'lesnaya',
    name: 'Полигон «Лесная»',
    distanceKm: 98,
    transport: '23520.00',
    disposal: '6400.00',
    total: '29920.00',
  },
];

const COLUMNS: TableColumn[] = [
  { key: 'name', title: 'Полигон', sortable: true },
  { key: 'distance', title: 'Расстояние', align: 'end', sortable: true, width: '140px' },
  { key: 'transport', title: 'Перевозка', align: 'end', sortable: true },
  { key: 'disposal', title: 'Утилизация', align: 'end', sortable: true },
  { key: 'total', title: 'Итого', align: 'end', sortable: true },
];

function showCell(row: ShowcaseRow, columnKey: string) {
  if (columnKey === 'name') {
    return row.name;
  }
  if (columnKey === 'distance') {
    return formatDistance(row.distanceKm);
  }
  if (columnKey === 'transport') {
    return formatMoney({ amount: row.transport, currency: 'RUB' });
  }
  if (columnKey === 'disposal') {
    return formatMoney({ amount: row.disposal, currency: 'RUB' });
  }

  return formatMoney({ amount: row.total, currency: 'RUB' });
}

/** Группы отходов раздела 7 дизайн-договора: выдуманных названий витрине нельзя. */
const WASTE_GROUP_NAMES = ['Лом бетона и железобетона', 'Древесина от разборки', 'Лом кирпичной кладки'];

export function SharedSection() {
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<'t' | 'm3'>('t');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [detachedOpen, setDetachedOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [limitOpen, setLimitOpen] = useState(false);
  const [tab, setTab] = useState<'concrete' | 'wood'>('concrete');
  const [near, setNear] = useState(false);
  const [group, setGroup] = useState<'concrete' | 'wood' | 'soil'>('concrete');
  const [agreed, setAgreed] = useState(true);
  const [sort, setSort] = useState<TableSort>({ key: 'total', direction: 'asc' });
  const [picked, setPicked] = useState<string[]>(['vostok']);
  // Закрытый список с поиском: строка поиска и выбранная запись справочника —
  // разные состояния, и витрина обязана показывать их порознь (R-013).
  const [groupQuery, setGroupQuery] = useState('');
  const [groupChoice, setGroupChoice] = useState<string | null>(null);

  const sorted = [...ROWS].sort((left, right) => {
    const order = sort.direction === 'asc' ? 1 : -1;

    if (sort.key === 'name') {
      return left.name.localeCompare(right.name, 'ru') * order;
    }
    if (sort.key === 'distance') {
      return (left.distanceKm - right.distanceKm) * order;
    }

    const field = sort.key === 'transport' ? 'transport' : sort.key === 'disposal' ? 'disposal' : 'total';
    return (Number(left[field]) - Number(right[field])) * order;
  });

  return (
    <>
      <Section title="Кнопки">
        <div className="imolt-row">
          <Button onClick={() => undefined}>Рассчитать</Button>
          <Button kind="secondary" onClick={() => undefined}>
            Получить маршрут
          </Button>
          <Button kind="tertiary" onClick={() => undefined}>
            Открыть в Яндекс.Картах
          </Button>
          <Button kind="danger" onClick={() => undefined}>
            Убрать полигон из выбора
          </Button>
        </div>
        <div className="imolt-row">
          <Button disabled>Недоступна</Button>
          <Button loading>Рассчитать</Button>
          <Button size="s" kind="secondary" onClick={() => undefined}>
            Малая кнопка
          </Button>
          <Button size="s" kind="tertiary" ariaLabel="Показать детали маршрута" onClick={() => undefined}>
            Детали
          </Button>
        </div>
        <p className="imolt-lead">
          Наведение, нажатие и видимый фокус проверяются указателем и клавишей Tab прямо здесь.
        </p>
      </Section>

      <Section title="Полоса управлений">
        <Toolbar ariaLabel="Действия над выбором">
          <Button size="s" kind="secondary" onClick={() => undefined}>
            Скачать предложение
          </Button>
          <Button size="s" kind="tertiary" onClick={() => undefined}>
            Снять выбор
          </Button>
          <Button size="s" kind="tertiary" disabled>
            Недоступное действие
          </Button>
        </Toolbar>
        <p className="imolt-lead">Между кнопками полосы ходят стрелками влево и вправо.</p>
      </Section>

      <Section title="Поля ввода">
        <Field id="vitrina-pole" label="Обычное поле" value={text} placeholder="Наберите значение" onChange={setText} />
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

      <Section title="Выбор из списка">
        <Select
          id="vitrina-vybor"
          label="Группа отходов"
          value={group}
          options={[
            { value: 'concrete' as const, label: 'Лом бетона и железобетона' },
            { value: 'wood' as const, label: 'Древесина от разборки' },
            { value: 'soil' as const, label: 'Грунт от земляных работ' },
          ]}
          onPick={setGroup}
          hint="Цена перевозки и плотность приходят из справочника"
        />
        <Select
          id="vitrina-vybor-otkaz"
          label="Группа отходов с отказом"
          value={group}
          options={[{ value: 'concrete' as const, label: 'Лом бетона и железобетона' }]}
          onPick={() => undefined}
          error="Группа отходов не выбрана"
        />
        <Select
          id="vitrina-vybor-nedostupen"
          label="Недоступный выбор"
          value={group}
          options={[{ value: 'concrete' as const, label: 'Лом бетона и железобетона' }]}
          onPick={() => undefined}
          disabled
        />
      </Section>

      <Section title="Флажки">
        <Checkbox id="vitrina-flazhok" label="Нужна утилизация на полигоне" checked={agreed} onChange={setAgreed} />
        <Checkbox id="vitrina-flazhok-snyat" label="Снятый флажок" checked={false} onChange={() => undefined} />
        <Checkbox
          id="vitrina-flazhok-nedostupen"
          label="Недоступный флажок"
          checked={false}
          onChange={() => undefined}
          disabled
        />
      </Section>

      <Section title="Вкладки и чипы">
        <Tabs
          label="Типы отходов расчёта"
          value={tab}
          options={[
            { value: 'concrete' as const, label: 'Лом бетона', badge: '10' },
            { value: 'wood' as const, label: 'Древесина', badge: '8' },
          ]}
          onPick={setTab}
        />
        <div className="imolt-sorts-line">
          <Chip label="до 50 км" pressed={near} onToggle={() => setNear(!near)} />
          <Chip label="только активные" pressed onToggle={() => undefined} />
          <Chip label="недоступный чип" pressed={false} onToggle={() => undefined} disabled />
          <span className="imolt-anchor">
            <Chip
              label="не менее 60 км"
              pressed={limitOpen}
              expanded={limitOpen}
              onToggle={() => setLimitOpen(!limitOpen)}
            />
            <Popover title="Предел расстояния" open={limitOpen} onClose={() => setLimitOpen(false)}>
              <Field
                id="vitrina-predel"
                label="Не менее, км"
                value="60"
                inputMode="decimal"
                onChange={() => undefined}
              />
              <Button size="s" onClick={() => setLimitOpen(false)}>
                Применить
              </Button>
            </Popover>
          </span>
        </div>
      </Section>

      <Section title="Всплывающее окно">
        <p className="imolt-lead">
          Окно закрывается клавишей Escape и щелчком вне; фокус возвращается на кнопку, которая его открыла. Модальным
          оно не является: страница за ним остаётся доступной.
        </p>
        <div className="imolt-sorts-line">
          <span className="imolt-anchor">
            <Button size="s" kind="secondary" onClick={() => setPopoverOpen(true)}>
              Показать детали маршрута
            </Button>
            <Popover title="Детали маршрута" open={popoverOpen} onClose={() => setPopoverOpen(false)}>
              <p className="imolt-lead">{formatDistance(45)} до площадки «Восток», примерно 1 ч 10 мин.</p>
            </Popover>
          </span>
        </div>

        {/* Вынесенное окно: внутри области с обрезкой — ячейки таблицы —
            окно в потоке разметки режется её краями, поэтому оно уходит в
            корень страницы и считает место от окна браузера. */}
        <p className="imolt-lead">
          Вынесенное окно: то же поведение, но узел лежит в корне страницы и обрезкой предка не режется.
        </p>
        <div className="imolt-sorts-line">
          <span className="imolt-anchor">
            <Button size="s" kind="tertiary" onClick={() => setDetachedOpen(true)}>
              Показать вынесенное окно
            </Button>
            <Popover title="Детали маршрута" detached open={detachedOpen} onClose={() => setDetachedOpen(false)}>
              <p className="imolt-lead">{formatDistance(45)} до площадки «Восток».</p>
            </Popover>
          </span>
        </div>
      </Section>

      <Section title="Карточка, число с подписью и актуальность">
        <Card
          title="Сводка выбора"
          actions={
            <Button size="s" kind="tertiary" onClick={() => undefined}>
              Снять выбор
            </Button>
          }
        >
          <Stat label="Перевозка" value={formatMoney({ amount: '19920.00', currency: 'RUB' })} />
          <Stat label="Утилизация" value={formatMoney({ amount: '19400.00', currency: 'RUB' })} />
          <Stat
            label="Итого"
            value={formatMoney({ amount: '39320.00', currency: 'RUB' })}
            hint="Цена предварительная"
          />
        </Card>
        <Card>Карточка без заголовка: поверхность без доступного имени.</Card>
        <div className="imolt-split">
          <DateStamp iso="2026-09-17" kind="prices" />
          <DateStamp iso="2026-09-17" kind="statuses" now="2026-09-24" />
          <DateStamp iso="2026-09-23" kind="updated" now="2026-09-24" />
          <DateStamp iso="2026-09-17T12:04:00+03:00" kind="issued" now="2026-09-17" />
          <DateStamp iso={null} kind="updated" />
        </div>
      </Section>

      <Section title="Таблица сравнения">
        <DataTable
          caption="Полигоны для лома бетона, 20 т"
          columns={COLUMNS}
          rows={sorted}
          rowKey={row => row.id}
          rowLabel={row => row.name}
          cell={showCell}
          sort={sort}
          onSort={key =>
            setSort(was => ({
              key,
              direction: was.key === key && was.direction === 'asc' ? 'desc' : 'asc',
            }))
          }
          selectedKeys={picked}
          onToggleRow={(key, selected) =>
            setPicked(was => (selected ? [...was, key] : was.filter(item => item !== key)))
          }
        />
        <Pager total={10} shown={sorted.length} onMore={() => undefined} />
        <Pager total={3} shown={3} onMore={() => undefined} />
      </Section>

      <Section title="Таблица в состоянии загрузки">
        <DataTable
          caption="Полигоны, идёт загрузка"
          columns={COLUMNS}
          rows={[]}
          rowKey={(row: ShowcaseRow) => row.id}
          cell={showCell}
          loading
          loadingRows={3}
        />
      </Section>

      <Section title="Таблица с пустым результатом">
        <DataTable
          caption="Полигоны, подходящих нет"
          columns={COLUMNS}
          rows={[]}
          rowKey={(row: ShowcaseRow) => row.id}
          cell={showCell}
          empty={
            <EmptyState
              title="Нет полигонов, принимающих этот тип отходов ближе 50 км"
              hint="Снимите фильтр расстояния или выберите другой тип отходов"
              action={
                <Button size="s" kind="secondary" onClick={() => undefined}>
                  Снять фильтр
                </Button>
              }
            />
          }
        />
      </Section>

      <Section title="Загрузка и пустой результат">
        <Skeleton rows={3} label="Идёт загрузка полигонов" />
        <EmptyState title="Пока ничего не выбрано" hint="Отметьте полигон в таблице сравнения" />
      </Section>

      <Section title="Закрытый список с поиском">
        <Combobox
          id="showcase-waste"
          label="Тип отходов"
          listLabel="Подсказки типа отходов"
          placeholder="Название или код"
          items={WASTE_GROUP_NAMES.filter(name => name.toLowerCase().includes(groupQuery.trim().toLowerCase()))}
          query={groupQuery}
          selected={groupChoice}
          render={item => item}
          onQuery={setGroupQuery}
          onOpen={() => setGroupQuery('')}
          onPick={item => {
            setGroupChoice(item);
            setGroupQuery(item);
          }}
          onDismiss={() => setGroupQuery(groupChoice ?? '')}
        />
      </Section>

      <Section title="Телефон">
        <PhoneField id="showcase-phone" label="Телефон" value={phone} onChange={setPhone} />
      </Section>

      <Section title="Модальное окно">
        {/* Окно уходит порталом в корень страницы: внутри обрезающей области
            оно резалось бы её краями. В витрине образец не рисуется на месте,
            а открывается поверх неё. */}
        <p className="imolt-lead">
          Запирает фокус, блокирует прокрутку страницы под собой и закрывается крестиком, нажатием вне окна и клавишей
          Escape. Фокус возвращается на кнопку, которая окно открыла.
        </p>
        <Button size="s" kind="secondary" onClick={() => setModalOpen(true)}>
          Показать модальное окно
        </Button>
        {modalOpen && (
          <Modal title="Заголовок окна" onClose={() => setModalOpen(false)}>
            <p className="imolt-lead">Содержимое окна: страница за ним остаётся на месте.</p>
          </Modal>
        )}
      </Section>

      <Section title="Рисунки объяснений">
        <Illustration kind="transport" />
        <Illustration kind="route" />
        <Illustration kind="statuses" />
      </Section>

      <Section title="Подсказки">
        <SuggestList
          label="Подсказки адреса"
          items={['г Москва, ул Годовикова, д 9', 'г Москва, ул Годовикова, д 9 стр 3']}
          render={item => item}
          onPick={() => undefined}
        />
      </Section>

      <Section title="Сообщения">
        <Notice kind="error">Отказ: расчёт не выполнен</Notice>
        <Notice kind="warning">Предупреждение: полигон заблокирован</Notice>
        <Notice kind="empty">Пусто: подходящих полигонов не нашлось</Notice>
        <Notice kind="done">Готово: заявка принята</Notice>
      </Section>

      <Section title="Лист">
        <Button size="s" kind="tertiary" onClick={() => setSheetOpen(true)}>
          Показать лист
        </Button>
        {sheetOpen && (
          <Sheet title="Детали маршрута" onClose={() => setSheetOpen(false)}>
            <p className="imolt-lead">Содержимое листа.</p>
          </Sheet>
        )}
      </Section>
    </>
  );
}
