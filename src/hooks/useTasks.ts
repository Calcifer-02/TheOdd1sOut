import { useEffect, useState, useRef } from 'react';
import { Task } from '@/types/task';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTasks, addTask, toggleTask as toggleTaskAction, reorderTasks as reorderTasksAction, deleteTask as deleteTaskAction, setLoading } from '@/store/slices/tasksSlice';
import { TasksService } from '@/services/tasksService';

export const useTasks = () => {
    const dispatch = useAppDispatch();
    const tasks = useAppSelector((state) => state.tasks.tasks);
    const isLoading = useAppSelector((state) => state.tasks.isLoading);
    const [useAPI, setUseAPI] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ taskId: number; task: Task } | null>(null);
    const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const loadTasks = async () => {
            dispatch(setLoading(true));

            try {
                // Загружаем из API
                const tasksFromDB = await TasksService.fetchTasks();

                if (tasksFromDB && tasksFromDB.length > 0) {
                    dispatch(setTasks(tasksFromDB));
                    setUseAPI(true);
                }
                // Если БД пустая - просто показываем пустой список
                // Redux Persist автоматически восстановит данные если они были
            } catch (error) {
                console.error('Failed to load tasks from API, using local storage:', error);
                // Фолбэк на локальные данные (Redux Persist)
                // Не загружаем моковые данные - просто работаем с тем что есть в Redux
                setUseAPI(false);
            }

            dispatch(setLoading(false));
        };

        loadTasks();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Очистка таймера при размонтировании
    useEffect(() => {
        return () => {
            if (deleteTimerRef.current) {
                clearTimeout(deleteTimerRef.current);
            }
        };
    }, []);

    const toggleTask = async (taskId: number) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Если задача становится выполненной - запускаем таймер удаления
        if (!task.completed) {
            // Оптимистично помечаем как выполненную
            dispatch(toggleTaskAction(taskId));

            // Сохраняем задачу для возможной отмены
            setPendingDelete({ taskId, task: { ...task, completed: true } });

            // Запускаем таймер на удаление (5 секунд)
            deleteTimerRef.current = setTimeout(() => {
                performDelete(taskId);
            }, 5000);

            // Обновляем в БД
            if (useAPI) {
                try {
                    await TasksService.toggleTask(taskId, true);
                } catch (error) {
                    console.error('Failed to toggle task:', error);
                    // Откатываем при ошибке
                    dispatch(toggleTaskAction(taskId));
                    setPendingDelete(null);
                    if (deleteTimerRef.current) {
                        clearTimeout(deleteTimerRef.current);
                    }
                }
            }
        } else {
            // Если задача снова становится невыполненной - просто переключаем
            dispatch(toggleTaskAction(taskId));

            if (useAPI) {
                try {
                    await TasksService.toggleTask(taskId, false);
                } catch (error) {
                    console.error('Failed to toggle task:', error);
                    dispatch(toggleTaskAction(taskId));
                }
            }
        }
    };

    const performDelete = async (taskId: number) => {
        // Удаляем из Redux
        dispatch(deleteTaskAction(taskId));
        setPendingDelete(null);

        // Удаляем из БД
        if (useAPI) {
            try {
                await TasksService.deleteTask(taskId);
                console.log('✅ Task deleted:', taskId);
            } catch (error) {
                console.error('Failed to delete task:', error);
                // Восстанавливаем задачу при ошибке
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    dispatch(addTask(task));
                }
            }
        }
    };

    const cancelDelete = () => {
        if (pendingDelete && deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;

            // Откатываем статус выполнения
            dispatch(toggleTaskAction(pendingDelete.taskId));

            // Обновляем в БД
            if (useAPI) {
                TasksService.toggleTask(pendingDelete.taskId, false).catch(error => {
                    console.error('Failed to cancel delete:', error);
                });
            }

            setPendingDelete(null);
        }
    };

    const dismissNotification = () => {
        setPendingDelete(null);
    };

    const createTask = async (newTask: Omit<Task, 'id'>): Promise<Task | null> => {
        if (useAPI) {
            try {
                const createdTask = await TasksService.createTask(newTask);
                dispatch(addTask(createdTask));
                return createdTask;
            } catch (error) {
                console.error('Failed to create task:', error);
                // Фолбэк на локальное создание
                const task: Task = {
                    ...newTask,
                    id: Math.max(...tasks.map(t => t.id), 0) + 1,
                };
                dispatch(addTask(task));
                return task;
            }
        } else {
            // Локальное создание без API
            const task: Task = {
                ...newTask,
                id: Math.max(...tasks.map(t => t.id), 0) + 1,
            };
            dispatch(addTask(task));
            return task;
        }
    };

    const reorderTasks = async (newTasks: Task[]) => {
        // Оптимистичное обновление UI
        dispatch(reorderTasksAction(newTasks));

        if (useAPI) {
            try {
                await TasksService.reorderTasks(newTasks);
            } catch (error) {
                console.error('Failed to reorder tasks:', error);
                // При ошибке оставляем новый порядок в UI (не откатываем)
            }
        }
    };

    const updateTask = async (taskId: number, updates: Partial<Task>) => {
        // Находим задачу
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        // Оптимистично обновляем в Redux
        const updatedTask = { ...task, ...updates };
        dispatch(reorderTasksAction(tasks.map(t => t.id === taskId ? updatedTask : t)));

        // Обновляем в БД
        if (useAPI) {
            try {
                await TasksService.updateTask(taskId, updates);
                console.log('Task updated:', taskId);
            } catch (error) {
                console.error('Failed to update task:', error);
                // Откатываем при ошибке
                dispatch(reorderTasksAction(tasks));
            }
        }
    };

    return {
        tasks,
        isLoading,
        toggleTask,
        createTask,
        reorderTasks,
        updateTask,
        useAPI,
        pendingDelete,
        cancelDelete,
        dismissNotification,
    };
};