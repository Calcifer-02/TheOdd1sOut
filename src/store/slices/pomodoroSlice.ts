import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type TimerMode = 'focus' | 'break' | 'idle';

interface PomodoroSettings {
  focusMinutes: number;
  breakMinutes: number;
  cycles: number;
}

interface PomodoroState {
  settings: PomodoroSettings;
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  currentCycle: number;
  completedCycles: number;
}

const initialState: PomodoroState = {
  settings: {
    focusMinutes: 25,
    breakMinutes: 5,
    cycles: 4,
  },
  mode: 'idle',
  timeLeft: 25 * 60, // 25 минут в секундах
  isRunning: false,
  currentCycle: 1,
  completedCycles: 0,
};

export const pomodoroSlice = createSlice({
  name: 'pomodoro',
  initialState,
  reducers: {
    // Настройки
    setFocusMinutes: (state, action: PayloadAction<number>) => {
      state.settings.focusMinutes = action.payload;
      if (state.mode === 'idle') {
        state.timeLeft = action.payload * 60;
      }
    },
    setBreakMinutes: (state, action: PayloadAction<number>) => {
      state.settings.breakMinutes = action.payload;
    },
    setCycles: (state, action: PayloadAction<number>) => {
      state.settings.cycles = action.payload;
    },

    // Управление таймером
    setMode: (state, action: PayloadAction<TimerMode>) => {
      state.mode = action.payload;
    },
    setTimeLeft: (state, action: PayloadAction<number>) => {
      state.timeLeft = action.payload;
    },
    decrementTime: (state) => {
      if (state.timeLeft > 0) {
        state.timeLeft -= 1;
      }
    },
    setIsRunning: (state, action: PayloadAction<boolean>) => {
      state.isRunning = action.payload;
    },
    setCurrentCycle: (state, action: PayloadAction<number>) => {
      state.currentCycle = action.payload;
    },
    incrementCurrentCycle: (state) => {
      state.currentCycle += 1;
    },
    setCompletedCycles: (state, action: PayloadAction<number>) => {
      state.completedCycles = action.payload;
    },
    incrementCompletedCycles: (state) => {
      state.completedCycles += 1;
    },

    // Комплексные действия
    startTimer: (state) => {
      if (state.mode === 'idle') {
        state.mode = 'focus';
        state.timeLeft = state.settings.focusMinutes * 60;
        state.completedCycles = 0;
        state.currentCycle = 1;
      }
      state.isRunning = true;
    },
    pauseTimer: (state) => {
      state.isRunning = false;
    },
    resetTimer: (state) => {
      state.isRunning = false;
      state.mode = 'idle';
      state.timeLeft = state.settings.focusMinutes * 60;
      state.currentCycle = 1;
      state.completedCycles = 0;
    },
    completeTimer: (state) => {
      state.isRunning = false;

      if (state.mode === 'focus') {
        state.completedCycles += 1;

        if (state.currentCycle >= state.settings.cycles) {
          // Все циклы завершены
          state.mode = 'idle';
          state.currentCycle = 1;
        } else {
          // Переход на перерыв
          state.mode = 'break';
          state.timeLeft = state.settings.breakMinutes * 60;
          state.isRunning = true;
        }
      } else if (state.mode === 'break') {
        // Переход к следующему циклу фокуса
        state.currentCycle += 1;
        state.mode = 'focus';
        state.timeLeft = state.settings.focusMinutes * 60;
        state.isRunning = true;
      }
    },
  },
});

export const {
  setFocusMinutes,
  setBreakMinutes,
  setCycles,
  setMode,
  setTimeLeft,
  decrementTime,
  setIsRunning,
  setCurrentCycle,
  incrementCurrentCycle,
  setCompletedCycles,
  incrementCompletedCycles,
  startTimer,
  pauseTimer,
  resetTimer,
  completeTimer,
} = pomodoroSlice.actions;

export default pomodoroSlice.reducer;

