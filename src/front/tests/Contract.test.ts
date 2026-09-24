// Договор API — источник форм для интерфейса (ADR-0008). Проверка держит
// связь в одну сторону: операции, на которые опирается главный путь,
// обязаны быть в договоре и обязаны быть объявлены реализованными.
//
// Проверка фальсифицируема: переименуйте операцию в договоре или верните ей
// состояние «объявлено» — она упадёт.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { contractPath, miniappSource, sourceFiles } from './repository';

/** Операции, без которых путь UC-001 не проходится. */
const MAIN_PATH_OPERATIONS = [
  'listWasteGroups',
  'suggestAddresses',
  'createCalculation',
  'listPlacementOptions',
  'setCalculationSelection',
  'setCalculationAllocation',
  'getCalculationRoute',
  'createQuote',
  'downloadQuoteDocument',
  'createPickupRequest',
  'getDataFreshness',
];

type Operation = Record<string, unknown>;

function operations(): Map<string, Operation> {
  const contract = load(readFileSync(contractPath, 'utf8')) as {
    paths: Record<string, Record<string, Operation>>;
  };
  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  const found = new Map<string, Operation>();

  for (const item of Object.values(contract.paths)) {
    for (const [method, body] of Object.entries(item)) {
      if (methods.includes(method)) {
        found.set(String(body['operationId']), body);
      }
    }
  }

  return found;
}

describe('договор API', () => {
  it('объявляет все операции главного пути расчёта', () => {
    const declared = operations();
    const missing = MAIN_PATH_OPERATIONS.filter(id => !declared.has(id));

    expect(missing, 'интерфейс опирается на операции, объявленные договором').toEqual([]);
  });

  it('называет операции главного пути реализованными', () => {
    const declared = operations();
    const notServed = MAIN_PATH_OPERATIONS.filter(id => declared.get(id)?.['x-состояние'] !== 'реализовано');

    expect(notServed, 'интерфейс не строится поверх объявленной, но не работающей операции').toEqual([]);
  });
});
describe('единственный читатель точки договора', () => {
  /** Точки справочников, которые читают сразу несколько экранов. */
  const ТОЧКИ = ['/v1/waste-groups', '/v1/landfills', '/v1/address-suggestions'];

  /** Функции модуля обращений: текст каждой отдельно. */
  function функции(текст: string): string[] {
    return текст.split('export function').slice(1);
  }

  // Две функции чтения к одной точке службы — второй источник тех же правил:
  // у них разойдутся предел выборки, разбор ответа и обработка отказа, и
  // разойдутся молча. Так уже было: справочник групп отходов читали
  // «searchWasteGroups» в модуле расчёта и «listWasteGroups» в модуле
  // справочников, и экраны брали группы из разных мест.
  //
  // Правка той же точки живёт в модуле ведения справочников намеренно: это
  // другая область, у неё свои права и свой отказ. Поэтому считаются только
  // обращения без объявленного способа, то есть чтения.
  it.each(ТОЧКИ)('точку «%s» читает один модуль обращений', точка => {
    // Перечень и одна запись — разные операции договора, и функций чтения у
    // точки законно несколько. Расходиться им нельзя, только если они живут в
    // одном модуле: предел выборки, разбор ответа и обработка отказа тогда
    // объявлены рядом.
    const модули = sourceFiles(join(miniappSource, 'shared', 'api'))
      .filter(файл => функции(файл.text).some(тело => тело.includes(точка) && !тело.includes('method:')))
      .map(файл => файл.path);

    expect(модули, 'точку читают разные модули обращений').toHaveLength(1);
  });
});
