/**
 * Типы для работы с MAX API
 * Документация: https://platform-api.max.ru
 */

/**
 * Базовый объект пользователя MAX
 */
export interface MaxUser {
  /** ID пользователя */
  user_id: number;

  /** Отображаемое имя пользователя */
  first_name: string;

  /** Отображаемая фамилия пользователя (может быть null) */
  last_name: string | null;

  /** @deprecated Устаревшее поле, скоро будет удалено */
  name?: string | null;

  /** Уникальное публичное имя пользователя. Может быть null, если пользователь недоступен или имя не задано */
  username: string | null;

  /** true, если пользователь является ботом */
  is_bot: boolean;

  /** Время последней активности пользователя в MAX (Unix-время в миллисекундах) */
  last_activity_time: number;
}

/**
 * Пользователь с фотографией
 */
export interface MaxUserWithPhoto extends MaxUser {
  /** URL аватара пользователя */
  avatar_url?: string;
  /** Дополнительная информация о фото */
  photo?: {
    url: string;
    width?: number;
    height?: number;
  };
}

/**
 * Информация о боте
 */
export interface MaxBotInfo extends MaxUser {
  /** Описание бота */
  description?: string;
  /** Команды бота */
  commands?: Array<{
    command: string;
    description: string;
  }>;
}

/**
 * Ответ от MAX API с ошибкой
 */
export interface MaxApiError {
  error: string;
  error_code?: string;
  message?: string;
}

/**
 * Конфигурация для MAX API клиента
 */
export interface MaxApiConfig {
  /** Токен авторизации */
  token: string;
  /** Базовый URL API (по умолчанию: https://platform-api.max.ru) */
  baseUrl?: string;
}

