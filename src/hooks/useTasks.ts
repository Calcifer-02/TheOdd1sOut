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
            console.log('🔄 Loading tasks from API...');
            dispatch(setLoading(true));

            try {
                // Пробуем загрузить из API
                const tasksFromDB = await TasksService.fetchTasks();
                console.log('📦 Received tasks from API:', tasksFromDB);

                // Если запрос успешен (даже если данных нет) - используем API
                setUseAPI(true);
                console.log('✅ API is available, useAPI set to true');

                // Загружаем данные если они есть
                if (tasksFromDB && tasksFromDB.length > 0) {
                    dispatch(setTasks(tasksFromDB));
                    console.log(`📝 Loaded ${tasksFromDB.length} tasks from database`);
                } else {
                    // БД пустая, но доступна - показываем пустой список
                    // Redux Persist может восстановить старые данные, но мы их очищаем
                    // так как БД является source of truth
                    dispatch(setTasks([]));
                    console.log('📭 Database is empty, showing empty list');
                }
            } catch (error) {
                console.error('❌ Failed to load tasks from API, using local storage:', error);
                // Фолбэк на локальные данные (Redux Persist)
                setUseAPI(false);
                console.log('💾 Using local storage mode');
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
        console.log('🗑️ Deleting task, useAPI:', useAPI, 'Task ID:', taskId);

        // Удаляем из Redux
        dispatch(deleteTaskAction(taskId));
        setPendingDelete(null);

        // Удаляем из БД
        if (useAPI) {
            try {
                console.log('🌐 Sending delete request to API...');
                await TasksService.deleteTask(taskId);
                console.log('✅ Task deleted from database:', taskId);
            } catch (error) {
                console.error('❌ Failed to delete task from database:', error);
                // Восстанавливаем задачу при ошибке
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    console.log('↩️ Restoring task:', task);
                    dispatch(addTask(task));
                }
            }
        } else {
            console.log('💾 Task deleted locally (no API)');
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
        console.log('📝 Creating task, useAPI:', useAPI, 'Task data:', newTask);

        if (useAPI) {
            try {
                console.log('🌐 Sending task to API...');
                const createdTask = await TasksService.createTask(newTask);
                console.log('✅ Task created via API:', createdTask);
                dispatch(addTask(createdTask));
                return createdTask;
            } catch (error) {
                console.error('❌ Failed to create task via API:', error);
                // Фолбэк на локальное создание
                const task: Task = {
                    ...newTask,
                    id: Math.max(...tasks.map(t => t.id), 0) + 1,
                };
                console.log('💾 Created task locally (fallback):', task);
                dispatch(addTask(task));
                return task;
            }
        } else {
            // Локальное создание без API
            const task: Task = {
                ...newTask,
                id: Math.max(...tasks.map(t => t.id), 0) + 1,
            };
            console.log('💾 Created task locally (no API):', task);
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