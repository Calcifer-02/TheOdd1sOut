import { Middleware } from '@reduxjs/toolkit';
import { RootState } from '../store';

// Middleware для синхронизации настроек с localStorage
export const settingsSyncMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
    const result = next(action);

    // После каждого изменения settings сохраняем в localStorage
    if (typeof action === 'object' && action !== null && 'type' in action && typeof action.type === 'string' && action.type.startsWith('settings/')) {
        const state = store.getState();
        const { theme, taskSettings } = state.settings;

        // Сохраняем только настройки из Redux
        const settingsToSave = {
            theme,
            taskSettings,
            savedAt: new Date().toISOString()
        };

        try {
            localStorage.setItem('reduxSettings', JSON.stringify(settingsToSave));
        } catch (error) {
            console.error('Failed to save settings to localStorage:', error);
        }
    }

    return result;
};

