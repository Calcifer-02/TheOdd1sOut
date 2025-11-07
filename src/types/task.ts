export interface Task {
    id: number;
    title: string;
    completed: boolean;
    deadline?: string;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    tags: string[];
}

export interface Assignee {
    id: number;
    name: string;
}

export type LayoutMode = 'list' | 'grid' | 'calendar';
export type SortBy = 'deadline' | 'priority' | 'name';

export interface NewTaskFormData {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    deadline?: Date;
    time: string;
    assignee: string;
    tags: string[];
    reminder: string;
}