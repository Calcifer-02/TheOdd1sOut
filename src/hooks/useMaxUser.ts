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

      const maxWebApp = window.WebApp as MaxWebApp | undefined;

      if (!maxWebApp) {
        setError(new Error('MAX WebApp не доступен. Убедитесь, что скрипт max-web-app.js подключен.'));
        setIsLoading(false);
        return;
      }

      setWebApp(maxWebApp);

      // Получаем данные пользователя из initDataUnsafe
      const webAppUser = maxWebApp.initDataUnsafe?.user;

      if (!webAppUser) {
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

      setUser(userData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user data');
      setError(error);
      console.error('Error fetching MAX user:', error);
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


