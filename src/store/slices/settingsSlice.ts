import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
    theme: Theme;
}

const initialState: SettingsState = {
    theme: 'system',
};

export const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setTheme: (state, action: PayloadAction<Theme>) => {
            state.theme = action.payload;
        },
    },
});

export const { setTheme } = settingsSlice.actions;

export default settingsSlice.reducer;

