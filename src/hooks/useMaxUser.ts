/**
 * Хук для работы с данными пользователя MAX через WebApp Bridge
 */

import { useState, useEffect } from 'react';
import { MaxUser } from '@/types/maxApi';
import { MaxWebApp } from './useWebApp';

interface UseMaxUserReturn {
  /** Данные пользователя */
  user: MaxUser | null;
  /** Флаг загрузки */
  isLoading: boolean;
  /** Ошибка */
  error: Error | null;
  /** Функция для обновления данных */
  refetch: () => void;
  /** WebApp объект (если доступен) */
  webApp: MaxWebApp | null;
}

/**
 * Хук для получения информации о текущем пользователе MAX через WebApp Bridge
 * @returns Данные пользователя, состояние загрузки и ошибки
 */
export function useMaxUser(): UseMaxUserReturn {
  const [user, setUser] = useState<MaxUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [webApp, setWebApp] = useState<MaxWebApp | null>(null);

  const fetchUser = () => {
    try {
      setIsLoading(true);
      setError(null);

      // Проверяем доступность WebApp
      if (typeof window === 'undefined') {
        setIsLoading(false);
        return;
      }

      // ПРИОРИТЕТ 1: Проверяем debug режим (localStorage)
      const debugUserId = localStorage.getItem('debug_user_id');
      if (debugUserId) {
        console.log('🔧 [useMaxUser] Debug mode: using user_id from localStorage:', debugUserId);
        const userData: MaxUser = {
          user_id: parseInt(debugUserId),
          first_name: 'Debug User',
          last_name: null,
          username: 'debug_user',
          is_bot: false,
          last_activity_time: Date.now(),
        };
        setUser(userData);
        setIsLoading(false);
        return;
      }

      // ПРИОРИТЕТ 2: MAX WebApp
      const maxWebApp = window.WebApp as MaxWebApp | undefined;

      if (!maxWebApp) {
        console.warn('⚠️ [useMaxUser] MAX WebApp не доступен');
        setError(new Error('MAX WebApp не доступен. Убедитесь, что скрипт max-web-app.js подключен.'));
        setIsLoading(false);
        return;
      }

      setWebApp(maxWebApp);

      // Получаем данные пользователя из initDataUnsafe
      const webAppUser = maxWebApp.initDataUnsafe?.user;

      if (!webAppUser) {
        console.warn('⚠️ [useMaxUser] Данные пользователя недоступны в WebApp');
        setError(new Error('Данные пользователя недоступны в WebApp'));
        setIsLoading(false);
        return;
      }

      // Преобразуем данные WebApp в формат MaxUser
      const userData: MaxUser = {
        user_id: webAppUser.id,
        first_name: webAppUser.first_name,
        last_name: webAppUser.last_name || null,
        username: webAppUser.username || null,
        is_bot: webAppUser.is_bot || false,
        last_activity_time: maxWebApp.initDataUnsafe?.auth_date
          ? maxWebApp.initDataUnsafe.auth_date * 1000 // Конвертируем в миллисекунды
          : Date.now(),
      };

      console.log('✅ [useMaxUser] User loaded from MAX WebApp:', userData);
      setUser(userData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user data');
      setError(error);
      console.error('❌ [useMaxUser] Error fetching user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Небольшая задержка для гарантии загрузки WebApp
    const timer = setTimeout(fetchUser, 100);
    return () => clearTimeout(timer);
  }, []);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
    webApp: (webApp as MaxWebApp | null),
  };
}


