import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface MoodTestState {
    currentQuestion: number;
    answers: { [key: number]: number };
    isComplete: boolean;
    lastUpdated: number | null;
    result: {
        stressScore: number;
        copingScore: number;
        totalScore: number;
    } | null;
}

const initialState: MoodTestState = {
    currentQuestion: 0,
    answers: {},
    isComplete: false,
    lastUpdated: null,
    result: null,
};

// Максимальное время неактивности - 24 часа (в миллисекундах)
const MAX_INACTIVITY_TIME = 24 * 60 * 60 * 1000;

export const moodSlice = createSlice({
    name: 'mood',
    initialState,
    reducers: {
        setAnswer: (state, action: PayloadAction<{ questionId: number; value: number }>) => {
            state.answers[action.payload.questionId] = action.payload.value;
            state.lastUpdated = Date.now();
        },
        setCurrentQuestion: (state, action: PayloadAction<number>) => {
            state.currentQuestion = action.payload;
            state.lastUpdated = Date.now();
        },
        completeTest: (state, action: PayloadAction<{ stressScore: number; copingScore: number; totalScore: number }>) => {
            state.isComplete = true;
            state.result = action.payload;
            state.lastUpdated = Date.now();
        },
        resetTest: (state) => {
            state.currentQuestion = 0;
            state.answers = {};
            state.isComplete = false;
            state.lastUpdated = null;
            state.result = null;
        },
        checkAndResetIfExpired: (state) => {
            if (state.lastUpdated && !state.isComplete) {
                const timeSinceLastUpdate = Date.now() - state.lastUpdated;
                if (timeSinceLastUpdate > MAX_INACTIVITY_TIME) {
                    // Сбрасываем тест, если прошло более 24 часов
                    state.currentQuestion = 0;
                    state.answers = {};
                    state.isComplete = false;
                    state.lastUpdated = null;
                    state.result = null;
                }
            }
        },
    },
});

export const { setAnswer, setCurrentQuestion, completeTest, resetTest, checkAndResetIfExpired } = moodSlice.actions;

export default moodSlice.reducer;

