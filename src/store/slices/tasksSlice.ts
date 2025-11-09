import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Task } from '@/types/task';

interface TasksState {
    tasks: Task[];
    isLoading: boolean;
}

const initialState: TasksState = {
    tasks: [], // Пустой массив - данные загрузятся из БД или Redux Persist
    isLoading: false,
};

export const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        setTasks: (state, action: PayloadAction<Task[]>) => {
            state.tasks = action.payload;
        },
        addTask: (state, action: PayloadAction<Task>) => {
            state.tasks.push(action.payload);
        },
        toggleTask: (state, action: PayloadAction<number>) => {
            const task = state.tasks.find(t => t.id === action.payload);
            if (task) {
                task.completed = !task.completed;
            }
        },
        reorderTasks: (state, action: PayloadAction<Task[]>) => {
            state.tasks = action.payload;
        },
        deleteTask: (state, action: PayloadAction<number>) => {
            state.tasks = state.tasks.filter(t => t.id !== action.payload);
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
    },
});

export const { setTasks, addTask, toggleTask, reorderTasks, deleteTask, setLoading } = tasksSlice.actions;

export default tasksSlice.reducer;

