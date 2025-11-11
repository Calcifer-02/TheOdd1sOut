/**
 * Сервис для работы с MAX API
 * Документация: https://platform-api.max.ru
 */

import { MaxUser, MaxApiError, MaxApiConfig } from '@/types/maxApi';

export class MaxApiService {
  private static readonly DEFAULT_BASE_URL = 'https://platform-api.max.ru';
  private token: string;
  private baseUrl: string;

  constructor(config: MaxApiConfig) {
    this.token = config.token;
    this.baseUrl = config.baseUrl || MaxApiService.DEFAULT_BASE_URL;
  }

  /**
   * Выполнить HTTP запрос к MAX API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Authorization': this.token,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData: MaxApiError = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`,
        }));

        throw new Error(
          errorData.message || errorData.error || `API request failed with status ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error('MAX API Error:', error);
      throw error;
    }
  }

  /**
   * GET /me - Получить информацию о текущем пользователе/боте
   * @returns Информация о пользователе
   */
  async getMe(): Promise<MaxUser> {
    return this.request<MaxUser>('/me', {
      method: 'GET',
    });
  }

  /**
   * GET /users/{userId} - Получить информацию о пользователе по ID
   * @param userId - ID пользователя
   * @returns Информация о пользователе
   */
  async getUser(userId: number): Promise<MaxUser> {
    return this.request<MaxUser>(`/users/${userId}`, {
      method: 'GET',
    });
  }

  /**
   * Проверить валидность токена
   * @returns true, если токен валиден
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getMe();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }
}

/**
 * Создать экземпляр MAX API клиента
 * @param token - Токен авторизации MAX
 * @param baseUrl - Опциональный базовый URL
 * @returns Экземпляр MaxApiService
 */
export function createMaxApiClient(token: string, baseUrl?: string): MaxApiService {
  return new MaxApiService({ token, baseUrl });
}

/**
 * Singleton instance для работы с MAX API
 * Используется токен из переменных окружения
 */
let maxApiInstance: MaxApiService | null = null;

export function getMaxApiInstance(): MaxApiService {
  if (!maxApiInstance) {
    const token = process.env.NEXT_PUBLIC_MAX_API_TOKEN;

    if (!token) {
      throw new Error(
        'MAX API token is not configured. Please set NEXT_PUBLIC_MAX_API_TOKEN environment variable.'
      );
    }

    maxApiInstance = createMaxApiClient(token);
  }

  return maxApiInstance;
}

