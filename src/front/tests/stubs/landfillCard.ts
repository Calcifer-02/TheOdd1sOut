// Карточка полигона для окна маршрута.
//
// Заглушка расчётной части знает точки расчёта, а реестр полигонов в её
// перечне не объявлен — окну же он нужен: координаты метки, статус приёма и
// тарифы отдаёт `getLandfill` (схема `Landfill` договора расчётной части).
// Координаты намеренно не совпадают с адресом вывоза: по совпавшим точкам не
// видно, что меток две.
//
// Файл без «.test.» в имени в прогон не попадает: это общая оснастка.
import type { ApiStub } from '../apiStub';
import { FRESHNESS_DATE, VOSTOK } from '../apiStub';

/** Карточка полигона «Восток»: та же запись, что и в вариантах размещения. */
export const VOSTOK_CARD = {
  id: VOSTOK.landfillId,
  name: VOSTOK.landfillName,
  legalEntity: 'ООО «Восток-Ресурс»',
  address: VOSTOK.address,
  coordinates: { latitude: 55.7286, longitude: 38.2153 },
  status: VOSTOK.status,
  statusUpdatedAt: FRESHNESS_DATE,
  tariffs: [
    {
      wasteGroupId: 'beton-lom',
      disposalPricePerTon: { amount: '450.00', currency: 'RUB' },
      updatedAt: FRESHNESS_DATE,
    },
  ],
};

/** Ключ точки реестра: заглушка сопоставляет ответы по методу и пути. */
function cardKey(landfillId: string): Parameters<ApiStub['answerWith']>[0] {
  return `GET /v1/landfills/${landfillId}` as Parameters<ApiStub['answerWith']>[0];
}

/** Карточка полигона в ответ на обращение к реестру. */
export function answerLandfillCard(stub: ApiStub, card: Record<string, unknown> = VOSTOK_CARD): void {
  stub.answerWith(cardKey(String(card['id'])), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    body: card,
  });
}

/** Отказ реестра: сведений о полигоне нет, и карте рисовать нечего. */
export function failLandfillCard(stub: ApiStub, landfillId: string = VOSTOK.landfillId): void {
  stub.answerWith(cardKey(landfillId), {
    status: 503,
    headers: { 'content-type': 'application/problem+json' },
    body: { type: 'urn:imolt:problem:unavailable', title: 'Реестр полигонов недоступен', status: 503 },
  });
}
