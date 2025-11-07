import { Task } from '@/types/task';

export const MOCK_TASKS: Task[] = [
    {
        id: 1,
        title: 'Подготовить презентацию для встречи',
        completed: false,
        deadline: 'Сегодня, 14:00',
        priority: 'high',
        assignee: 'Я',
        tags: ['работа', 'срочно'],
    },
    {
        id: 2,
        title: 'Купить продукты',
        completed: false,
        deadline: 'Сегодня, 18:00',
        priority: 'low',
        assignee: 'Я',
        tags: ['личное'],
    },
    {
        id: 3,
        title: 'Код-ревью pull request',
        completed: true,
        deadline: 'Вчера, 17:00',
        priority: 'medium',
        assignee: 'Александр',
        tags: ['работа'],
    },
    {
        id: 4,
        title: 'Позвонить клиенту',
        completed: false,
        deadline: 'Завтра, 10:00',
        priority: 'medium',
        assignee: 'Команда',
        tags: ['работа'],
    },
    {
        id: 5,
        title: 'Обновить документацию',
        completed: false,
        priority: 'low',
        assignee: 'Я',
        tags: ['работа'],
    },
];