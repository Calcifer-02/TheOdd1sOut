/**
 * Опознание участника, пришедшего из переписки, — одно на всё приложение
 * (R-071).
 *
 * Приложение открывается кнопкой из переписки, и платформа передаёт стартовые
 * параметры вместе с запуском. Отдельного согласия на обработку персональных
 * данных вход не спрашивает: основанием служит соглашение платформы MAX,
 * принятое до запуска, — решение заказчика от 28.09.2026. Отправка заявки и
 * заказ услуги согласие требуют, и оно спрашивается в их собственных формах
 * (R-054).
 *
 * Обмен идёт один раз за жизнь вкладки. Карточка опознания стоит над каждым
 * экраном, а кабинет читает исход опознания же: два обмена по одной строке
 * параметров завели бы вторую сессию на ровном месте.
 *
 * Состояние живёт в памяти модуля, а не в состоянии React: обмен начинается
 * раньше, чем кабинет успевает отрисоваться, и переживает переход между
 * экранами.
 *
 * @req: R-071
 * @adr: ADR-0009
 */
import { useSyncExternalStore } from 'react';
import { signIn } from '@/entities/participant';
import { ApiProblem } from '@/shared/api/http';
import { openedFromChat } from '@/shared/lib/platform';

/** Этап опознания: от «ещё не начинали» до исхода. */
export type IdentificationStage = 'idle' | 'running' | 'done' | 'refused';

export type Identification = {
  stage: IdentificationStage;
  /** Заголовок отказа службы или `null`, если отказа не было. */
  refusal: string | null;
};

const IDLE: Identification = { stage: 'idle', refusal: null };

let current: Identification = IDLE;

let started = false;

const listeners = new Set<() => void>();

function announce(next: Identification): void {
  current = next;

  for (const listener of [...listeners]) {
    listener();
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  return () => {
    listeners.delete(onChange);
  };
}

function snapshot(): Identification {
  return current;
}

/** Исход опознания с подпиской на его смену. */
export function useIdentification(): Identification {
  return useSyncExternalStore(subscribe, snapshot, () => IDLE);
}

/**
 * Опознать участника, если приложение открыто из переписки. Повторный вызов
 * ничего не делает: обмен идёт один раз за жизнь вкладки.
 */
export async function identifyAsync(): Promise<void> {
  if (started || !openedFromChat()) {
    return;
  }

  started = true;
  announce({ stage: 'running', refusal: null });

  try {
    await signIn();
    announce({ stage: 'done', refusal: null });
  } catch (error) {
    // Показывается заголовок отказа, а не код причины: код — внутреннее имя
    // (ADR-0008, инвариант 4).
    announce({
      stage: 'refused',
      refusal: error instanceof ApiProblem ? error.title : 'Опознать участника не удалось',
    });
  }
}

/** Забыть исход опознания. Нужно проверкам: состояние живёт в памяти модуля. */
export function forgetIdentification(): void {
  started = false;
  announce(IDLE);
}
