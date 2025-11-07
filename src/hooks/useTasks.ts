import { useState, useEffect } from 'react';
import { Task } from '@/types/task';
import { MOCK_TASKS } from '@/shared/constants/mockData';

export const useTasks = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadTasks = async () => {
            await new Promise(resolve => setTimeout(resolve, 1500));
            setTasks(MOCK_TASKS);
            setIsLoading(false);
        };

        loadTasks();
    }, []);

    const toggleTask = (taskId: number) => {
        setTasks(tasks.map(task =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
        ));
    };

    const createTask = (newTask: Omit<Task, 'id'>) => {
        const task: Task = {
            ...newTask,
            id: Math.max(...tasks.map(t => t.id), 0) + 1,
        };
        setTasks([...tasks, task]);
    };

    const reorderTasks = (newTasks: Task[]) => {
        setTasks(newTasks);
    };

    return {
        tasks,
        isLoading,
        toggleTask,
        createTask,
        reorderTasks,
    };
};