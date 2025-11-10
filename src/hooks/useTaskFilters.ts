import { useState, useMemo, useEffect } from 'react';
import { Task, LayoutMode, SortBy } from '@/types/task';
import { useAppSelector } from '@/store/hooks';

export const useTaskFilters = (tasks: Task[]) => {
    // Получаем настройки из Redux store с безопасным чтением
    const taskSettings = useAppSelector((state) => state.settings?.taskSettings);

    // Используем настройки из store как начальные значения с fallback
    const [layoutMode, setLayoutMode] = useState<LayoutMode>(
        (taskSettings?.defaultView as LayoutMode) || 'list'
    );
    const [sortBy, setSortBy] = useState<SortBy>(
        (taskSettings?.sortBy as SortBy) || 'date'
    );
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
    const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    // Обновляем значения при изменении настроек в store
    useEffect(() => {
        if (taskSettings?.defaultView) {
            setLayoutMode(taskSettings.defaultView as LayoutMode);
        }
        if (taskSettings?.sortBy) {
            setSortBy(taskSettings.sortBy as SortBy);
        }
    }, [taskSettings?.defaultView, taskSettings?.sortBy]);

    const filteredTasks = useMemo(() => {
        let filtered = tasks.filter(task => {
            // Фильтр по выполненным задачам из настроек
            if (taskSettings?.showCompletedTasks === false && task.completed) {
                return false;
            }

            if (selectedAssignees.length > 0 && !selectedAssignees.includes(task.assignee)) {
                return false;
            }
            if (selectedPriorities.length > 0 && !selectedPriorities.includes(task.priority)) {
                return false;
            }
            if (selectedTags.length > 0 && !task.tags.some(tag => selectedTags.includes(tag))) {
                return false;
            }
            return true;
        });

        // Сортировка согласно настройкам
        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'priority':
                    const priorityOrder = { high: 0, medium: 1, low: 2 };
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                case 'name':
                    return a.title.localeCompare(b.title);
                case 'date':
                case 'deadline':
                case 'createdAt':
                default:
                    if (!a.deadline) return 1;
                    if (!b.deadline) return -1;
                    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
            }
        });
    }, [tasks, selectedAssignees, selectedPriorities, selectedTags, taskSettings, sortBy]);

    const toggleAssignee = (assignee: string) => {
        setSelectedAssignees(prev =>
            prev.includes(assignee)
                ? prev.filter(a => a !== assignee)
                : [...prev, assignee]
        );
    };

    const togglePriority = (priority: string) => {
        setSelectedPriorities(prev =>
            prev.includes(priority)
                ? prev.filter(p => p !== priority)
                : [...prev, priority]
        );
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    return {
        layoutMode,
        setLayoutMode,
        sortBy,
        setSortBy,
        selectedAssignees,
        selectedPriorities,
        selectedTags,
        filteredTasks,
        toggleAssignee,
        togglePriority,
        toggleTag,
    };
};