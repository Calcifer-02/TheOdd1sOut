export interface Task {
    id: number;
    title: string;
    description?: string;
    completed: boolean;
    deadline?: string | Date;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    tags: string[];
    order?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Assignee {
    id: number | string;
    name: string;
    avatarUrl?: string;
}

export type LayoutMode = 'list' | 'grid' | 'calendar';
export type SortBy = 'deadline' | 'priority' | 'name' | 'createdAt';

export interface NewTaskFormData {
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    deadline?: Date;
    time: string;
    assignee: string;
    tags: string[];
}