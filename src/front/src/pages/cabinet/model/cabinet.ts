/**
 * Предметная логика кабинета: открытый раздел, профиль, расчёты, услуги.
 *
 * Логика общая для обоих представлений. Мобильное и десктопное различаются
 * разметкой — таблица против карточек, боковое меню против вкладок, — а
 * правила загрузки, разбора отказа и накопления страниц у них одни. Копия
 * этих правил в двух файлах разошлась бы уже на втором изменении.
 *
 * Отказ показывается заголовком, а не кодом: код — внутреннее имя (ADR-0008,
 * инвариант 4).
 *
 * @supports: R-008, R-049, R-050, R-051, R-052
 * @adr: ADR-0008
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiProblem } from '@/shared/api/http';
import {
  getProfile,
  listCalculations,
  listDocumentServices,
  orderDocumentService,
  type CalculationSummary,
  type DocumentService,
  type DocumentServiceOrderInput,
  type ParticipantProfile,
  type SubscriptionStanding,
} from '@/shared/api/cabinet';
import { CALCULATOR_PATH, hashOf, useRoute, navigate } from '@/shared/lib/routing';
import { DEFAULT_CABINET_SECTION, SECTION_QUERY_KEY, sectionOf, type CabinetSection } from '@/widgets/cabinet-nav';

/** Адрес экрана кабинета. Отсюда же берётся ссылка возврата в раздел. */
export const CABINET_PATH = '/cabinet';

/** Сколько сохранённых расчётов приходит одной страницей. */
export const CALCULATIONS_PAGE = 10;

/** Заголовок отказа службы; своего текста он не получает, если служба назвала свой. */
function titleOf(error: unknown, fallback: string): string {
  return error instanceof ApiProblem ? error.title : fallback;
}

/**
 * Ссылка на экран расчёта с открытым расчётом: кабинет возвращает в расчёт,
 * а не показывает его копию у себя. Имя параметра `calc` объявлено разбором
 * состояния выборки (`@/shared/lib/viewState`) и здесь не изобретается.
 */
export function calculationHref(id: string): string {
  return hashOf(CALCULATOR_PATH, new URLSearchParams({ calc: id }));
}

/**
 * Открытый раздел кабинета живёт в адресе: ссылка на раздел возвращает в тот
 * же раздел. Переход между разделами — новая запись истории: «назад» обязано
 * возвращать в предыдущий раздел, а не выбрасывать из кабинета.
 */
export function useCabinetSection(): {
  section: CabinetSection;
  openSection: (next: CabinetSection) => void;
} {
  const route = useRoute();
  const section = sectionOf(route.query.get(SECTION_QUERY_KEY));

  const openSection = useCallback((next: CabinetSection) => {
    const query = new URLSearchParams();

    // Раздел по умолчанию в адрес не пишется: ссылка не обрастает шумом.
    if (next !== DEFAULT_CABINET_SECTION) {
      query.set(SECTION_QUERY_KEY, next);
    }

    navigate(CABINET_PATH, query);
  }, []);

  return { section, openSection };
}

export type ProfileState = {
  profile: ParticipantProfile | null;
  failure: string | null;
  loading: boolean;
  /** Принять новое состояние подписки после заявки, не перечитывая профиль. */
  applySubscription: (subscription: SubscriptionStanding) => void;
};

/** Профиль участника. Без сессии не запрашивается: операция её требует. */
export function useProfile(identified: boolean): ProfileState {
  const [profile, setProfile] = useState<ParticipantProfile | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!identified) {
      setProfile(null);
      setFailure(null);
      return;
    }

    // Ответ, пришедший после ухода с экрана, состояние уже не меняет: иначе
    // кабинет закрытого участника дорисовался бы поверх пустого.
    let alive = true;
    setLoading(true);

    getProfile()
      .then(next => {
        if (alive) {
          setProfile(next);
          setFailure(null);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(titleOf(error, 'Профиль не загрузился'));
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [identified]);

  const applySubscription = useCallback((subscription: SubscriptionStanding) => {
    setProfile(current => (current === null ? current : { ...current, subscription }));
  }, []);

  return { profile, failure, loading, applySubscription };
}

export type CalculationsState = {
  items: CalculationSummary[];
  total: number;
  loading: boolean;
  failure: string | null;
  showMore: () => void;
};

/**
 * Сохранённые расчёты участника, постранично. Страницы держатся по смещению,
 * а не дописываются в общий список: повторный проход того же действия не
 * должен удваивать строки.
 */
export function useCalculations(enabled: boolean): CalculationsState {
  const [pages, setPages] = useState<Record<number, CalculationSummary[]>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let alive = true;
    setLoading(true);

    listCalculations(CALCULATIONS_PAGE, offset)
      .then(page => {
        if (alive) {
          setPages(current => ({ ...current, [page.offset]: page.items }));
          setTotal(page.total);
          setFailure(null);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(titleOf(error, 'Расчёты не загрузились'));
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [enabled, offset]);

  const items = useMemo(
    () =>
      Object.keys(pages)
        .map(Number)
        .sort((left, right) => left - right)
        .flatMap(key => pages[key]),
    [pages],
  );

  const showMore = useCallback(() => setOffset(current => current + CALCULATIONS_PAGE), []);

  return { items, total, loading, failure, showMore };
}

export type ServicesState = {
  services: DocumentService[];
  loading: boolean;
  failure: string | null;
};

/** Каталог услуг по документации. Состав каталога — данные службы (R-052). */
export function useDocumentServices(enabled: boolean): ServicesState {
  const [services, setServices] = useState<DocumentService[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let alive = true;
    setLoading(true);

    listDocumentServices()
      .then(page => {
        if (alive) {
          setServices(page.items);
          setFailure(null);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(titleOf(error, 'Каталог услуг не загрузился'));
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [enabled]);

  return { services, loading, failure };
}

export type ServiceOrderState = {
  /** Услуга, форма заказа которой раскрыта; `null` — все свёрнуты. */
  openFor: string | null;
  open: (serviceId: string | null) => void;
  sending: boolean;
  failure: string | null;
  /** Услуга, заказ которой принят, и слово службы о принятом заказе. */
  acceptedFor: string | null;
  acceptedMessage: string | null;
  send: (input: DocumentServiceOrderInput) => Promise<void>;
};

/** Заказ услуги по документации (R-009, R-052, R-054). */
export function useServiceOrder(): ServiceOrderState {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null);
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);

  const open = useCallback((serviceId: string | null) => {
    setOpenFor(serviceId);
    setFailure(null);
    setAcceptedFor(null);
    setAcceptedMessage(null);
  }, []);

  const send = useCallback(async (input: DocumentServiceOrderInput) => {
    setFailure(null);
    setSending(true);

    try {
      const accepted = await orderDocumentService(input);
      setAcceptedFor(accepted.serviceId);
      setAcceptedMessage(accepted.message ?? null);
      setOpenFor(null);
    } catch (error: unknown) {
      setFailure(titleOf(error, 'Заказ отправить не удалось'));
    } finally {
      setSending(false);
    }
  }, []);

  return { openFor, open, sending, failure, acceptedFor, acceptedMessage, send };
}
