// Общие шаги экрана расчёта: заполнение формы, запуск расчёта и поиск
// карточек полигонов. Вынесены сюда, чтобы каждая проверка осталась одним
// действием и одним исходом, а не переписыванием формы заново.
//
// Элементы ищутся по роли и доступному имени — это часть проверки: поле без
// подписи и кнопка без доступного имени роняют её, а не обходятся селектором
// по классу или `data-testid` (дизайн-договор, разд. 4.5; ADR-0008,
// инвариант 4).
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.
import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { CONCRETE_GROUP, PICKUP_ADDRESS } from './apiStub';

/** Раздел результатов: секция, подписанная заголовком «Результаты». */
export function resultsRegion(): HTMLElement {
  return screen.getByRole('region', { name: 'Результаты' });
}

/** Флажки карточек полигонов — по одному на карточку, в порядке показа. */
export function landfillCheckboxes(): HTMLInputElement[] {
  return within(resultsRegion()).getAllByRole('checkbox') as HTMLInputElement[];
}

/**
 * Флажок карточки по названию полигона. Именно по названию, а не по позиции
 * строки: перестановка списка не должна переносить выбор на соседа
 * (карточка практики PRACT-021, ADR-0008).
 */
export function landfillCheckbox(landfillName: string): HTMLInputElement {
  return within(resultsRegion()).getByRole('checkbox', {
    name: (accessibleName: string) => accessibleName.includes(landfillName),
  }) as HTMLInputElement;
}

/**
 * Полигон целиком: карточка на телефоне или строка таблицы на рабочем месте.
 * Оправа у двух представлений разная, предмет — один, поэтому шаг общий.
 */
export function landfillCard(landfillName: string): HTMLElement {
  const card = landfillCheckbox(landfillName).closest('li, article, tr');

  if (card === null) {
    throw new Error(`Полигон «${landfillName}» не оформлен строкой списка, карточкой или строкой таблицы`);
  }

  return card as HTMLElement;
}

/** Идёт ли первый элемент в разметке раньше второго. */
export function precedes(first: Element, second: Element): boolean {
  return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** Выбирает адрес вывоза из подсказок: набирает начало и щёлкает подсказку. */
export async function chooseAddress(user: UserEvent, value: string = PICKUP_ADDRESS): Promise<void> {
  await user.type(screen.getByLabelText('Адрес вывоза'), 'Годовикова');
  await user.click(await screen.findByRole('option', { name: value }));
}

/** Выбирает группу отходов поиском по названию. */
export async function chooseWasteGroup(
  user: UserEvent,
  groupName: string = CONCRETE_GROUP.name,
  search = 'лом',
): Promise<void> {
  await user.type(screen.getByLabelText('Тип отходов'), search);
  await user.click(await screen.findByRole('option', { name: groupName }));
}

/** Вводит объём и, если мера названа, переключает её. */
export async function enterQuantity(user: UserEvent, value: string, unit: 'т' | 'м³' = 'т'): Promise<void> {
  const field = screen.getByLabelText('Объём');

  await user.clear(field);
  await user.type(field, value);

  if (unit === 'м³') {
    await user.click(screen.getByRole('radio', { name: 'м³' }));
  }
}

/**
 * Ждёт результат расчёта: на экране появился раздел результатов.
 *
 * Признак выбран общий для обоих представлений: подпись свежести данных на
 * телефоне и на рабочем месте набрана разными словами, а раздел результатов
 * один и тот же и появляется ровно тогда, когда расчёт получен.
 */
export async function waitForResults(): Promise<void> {
  await screen.findByRole('region', { name: 'Результаты' });
}

/**
 * Канонический путь UC-001 до результата: адрес из подсказки, «Лом бетона и
 * железобетона», 20 тонн, «Рассчитать».
 */
export async function calculateConcrete(user: UserEvent): Promise<void> {
  await chooseAddress(user);
  await chooseWasteGroup(user);
  await enterQuantity(user, '20');
  await user.click(screen.getByRole('button', { name: 'Рассчитать' }));
  await waitForResults();
}
