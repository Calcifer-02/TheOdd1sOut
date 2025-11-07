import { useState, useMemo } from 'react';
import { Task, LayoutMode, SortBy } from '@/types/task';

export const useTaskFilters = (tasks: Task[]) => {
    const [layoutMode, setLayoutMode] = useState<LayoutMode>('list');
    const [sortBy, setSortBy] = useState<SortBy>('deadline');
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
    const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
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
    }, [tasks, selectedAssignees, selectedPriorities, selectedTags]);

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