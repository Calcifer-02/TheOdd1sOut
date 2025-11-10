import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark' | 'system';

interface TaskSettings {
    defaultPriority: 'low' | 'medium' | 'high';
    autoArchive: boolean;
    archiveDays: number;
    showCompletedTasks: boolean;
    defaultView: 'list' | 'grid' | 'calendar';
    sortBy: 'date' | 'priority' | 'name';
}

interface UserProfile {
    name: string;
    email: string;
    avatar: string;
}

interface SettingsState {
    theme: Theme;
    taskSettings: TaskSettings;
    profile: UserProfile;
}

const initialState: SettingsState = {
    theme: 'system',
    taskSettings: {
        defaultPriority: 'medium',
        autoArchive: false,
        archiveDays: 30,
        showCompletedTasks: true,
        defaultView: 'list',
        sortBy: 'date'
    },
    profile: {
        name: 'Пользователь',
        email: 'user@example.com',
        avatar: ''
    }
};

export const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setTheme: (state, action: PayloadAction<Theme>) => {
            state.theme = action.payload;
        },
        updateTaskSettings: (state, action: PayloadAction<Partial<TaskSettings>>) => {
            state.taskSettings = {
                ...state.taskSettings,
                ...action.payload
            };
        },
        updateProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
            state.profile = {
                ...state.profile,
                ...action.payload
            };
        },
    },
});

export const { setTheme, updateTaskSettings, updateProfile } = settingsSlice.actions;

export default settingsSlice.reducer;

