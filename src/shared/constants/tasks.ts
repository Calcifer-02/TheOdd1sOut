import { Assignee } from '@/types/task';

export const ASSIGNEES: Assignee[] = [
    { id: 1, name: 'Я' },
    { id: 2, name: 'Александр' },
    { id: 3, name: 'Команда' },
];

export const PRIORITIES = {
    low: { label: 'Низкий', color: '#9CA3AF' },
    medium: { label: 'Средний', color: '#F59E0B' },
    high: { label: 'Высокий', color: '#EF4444' },
};

export const TAGS = ['личное', 'работа', 'срочно'];

export const REMINDER_OPTIONS = [
    'Не установлено',
    'За 15 минут',
    'За 30 минут',
    'За 1 час',
    'За 1 день'
];