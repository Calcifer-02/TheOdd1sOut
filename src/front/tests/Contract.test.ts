// Договор API — источник форм для интерфейса (ADR-0008). Проверка держит
// связь в одну сторону: операции, на которые опирается главный путь,
// обязаны быть в договоре и обязаны быть объявлены реализованными.
//
// Проверка фальсифицируема: переименуйте операцию в договоре или верните ей
// состояние «объявлено» — она упадёт.
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { contractPath } from './repository';

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
