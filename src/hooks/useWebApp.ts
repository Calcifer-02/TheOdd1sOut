/**
 * Хук для работы с MAX WebApp Bridge
 * Предоставляет доступ к API мини-приложения MAX
 */

import { useState, useEffect } from 'react';

/**
 * Интерфейс MAX WebApp Bridge
 */
export interface MaxWebApp {
  /** Строка с init данными */
  initData?: string;

  /** Объект с распарсенными init данными */
  initDataUnsafe?: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_bot?: boolean;
      is_premium?: boolean;
      photo_url?: string;
    };
    receiver?: any;
    chat?: any;
    chat_type?: string;
    chat_instance?: string;
    start_param?: string;
    can_send_after?: number;
    auth_date?: number;
    hash?: string;
  };

  /** Версия WebApp */
  version?: string;

  /** Платформа устройства */
  platform?: string;

  /** Цветовая схема */
  colorScheme?: 'light' | 'dark';

  /** Параметры темы */
  themeParams?: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
    secondary_bg_color?: string;
  };

  /** Приложение развернуто */
  isExpanded?: boolean;

  /** Высота viewport */
  viewportHeight?: number;

  /** Стабильная высота viewport */
  viewportStableHeight?: number;

  /** Высота заголовка */
  headerColor?: string;

  /** Цвет фона */
  backgroundColor?: string;

  /** Кнопка "Назад" */
  BackButton?: {
    isVisible?: boolean;
    show?: () => void;
    hide?: () => void;
    onClick?: (callback: () => void) => void;
    offClick?: (callback: () => void) => void;
  };

  /** Главная кнопка */
  MainButton?: {
    text?: string;
    color?: string;
    textColor?: string;
    isVisible?: boolean;
    isActive?: boolean;
    isProgressVisible?: boolean;
    setText?: (text: string) => void;
    show?: () => void;
    hide?: () => void;
    enable?: () => void;
    disable?: () => void;
    showProgress?: (leaveActive?: boolean) => void;
    hideProgress?: () => void;
    setParams?: (params: any) => void;
    onClick?: (callback: () => void) => void;
    offClick?: (callback: () => void) => void;
  };

  /** Методы */
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  enableClosingConfirmation?: () => void;
  disableClosingConfirmation?: () => void;
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
  sendData?: (data: string) => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  showPopup?: (params: any, callback?: (buttonId: string) => void) => void;
  showAlert?: (message: string, callback?: () => void) => void;
  showConfirm?: (message: string, callback?: (confirmed: boolean) => void) => void;
  showScanQrPopup?: (params: any, callback?: (text: string) => void) => void;
  closeScanQrPopup?: () => void;
  readTextFromClipboard?: (callback: (text: string) => void) => void;
  requestWriteAccess?: (callback?: (granted: boolean) => void) => void;
  requestContact?: (callback?: (granted: boolean, contact?: any) => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

// Расширяем Window интерфейс для доступа к WebApp
declare global {
  interface Window {
    WebApp?: any;
  }
}

interface UseWebAppReturn {
  /** WebApp объект */
  webApp: MaxWebApp | null;
  /** WebApp готов к использованию */
  isReady: boolean;
  /** Ошибка инициализации */
  error: Error | null;
}

/**
 * Хук для работы с MAX WebApp Bridge
 * @returns WebApp объект и состояние готовности
 */
export function useWebApp(): UseWebAppReturn {
  const [webApp, setWebApp] = useState<MaxWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Проверяем доступность window
    if (typeof window === 'undefined') {
      return;
    }

    // Функция для проверки загрузки WebApp
    const checkWebApp = () => {
      if (window.WebApp) {
        try {
          const webAppInstance = window.WebApp as MaxWebApp;

          // Инициализируем WebApp
          if (webAppInstance.ready) {
            try {
              webAppInstance.ready();
            } catch (err) {
              // В режиме разработки (браузер) это нормально
              if (process.env.NODE_ENV === 'development') {
                console.warn('[WebApp] Ready event failed (normal in browser):', err);
              }
            }
          }

          setWebApp(webAppInstance);
          setIsReady(true);
          setError(null);

          // Раскрываем приложение на весь экран
          console.log('📱 Expanding app to fullscreen...');
          console.log('Before expand - isExpanded:', webAppInstance.isExpanded);
          console.log('Before expand - viewportHeight:', webAppInstance.viewportHeight);

          if (webAppInstance.expand) {
            webAppInstance.expand();
            console.log('✅ expand() called');

            // Повторный вызов через небольшую задержку (для надёжности)
            setTimeout(() => {
              if (webAppInstance.expand) {
                webAppInstance.expand();
                console.log('✅ expand() called again (delayed)');
                console.log('After expand - isExpanded:', webAppInstance.isExpanded);
                console.log('After expand - viewportHeight:', webAppInstance.viewportHeight);
              }
            }, 300);
          } else {
            console.log('⚠️ expand() method not available');
          }

          console.log('MAX WebApp initialized:', {
            version: webAppInstance.version,
            platform: webAppInstance.platform,
            colorScheme: webAppInstance.colorScheme,
            user: webAppInstance.initDataUnsafe?.user,
            isExpanded: webAppInstance.isExpanded,
            viewportHeight: webAppInstance.viewportHeight,
          });


          if (webAppInstance.onEvent) {
            webAppInstance.onEvent('viewportChanged', () => {
              console.log('📐 Viewport changed:', {
                isExpanded: webAppInstance.isExpanded,
                viewportHeight: webAppInstance.viewportHeight,
                viewportStableHeight: webAppInstance.viewportStableHeight,
              });
            });
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error('Failed to initialize WebApp');
          setError(error);
          console.error('Error initializing WebApp:', error);
        }
      } else {
        setError(new Error('MAX WebApp не доступен. Приложение должно запускаться внутри MAX мессенджера.'));
      }
    };

    // Проверяем сразу
    checkWebApp();

    // Повторная проверка через небольшой таймаут (на случай асинхронной загрузки)
    const timer = setTimeout(checkWebApp, 500);

    return () => clearTimeout(timer);
  }, []);

  return {
    webApp,
    isReady,
    error,
  };
}

