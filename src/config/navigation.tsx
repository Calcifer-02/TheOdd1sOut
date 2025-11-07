// src/config/navigation.tsx
import {
    HomeIcon,
    ListTodoIcon,
    BrainCircuitIcon,
    SmileIcon,
    Settings2Icon,
} from '@/components/icons';

export type NavItem = {
    href: string;
    label: string;
    icon: JSX.Element;
};

export const navItems: NavItem[] = [
    {
        href: '/',
        label: 'Главная',
        icon: <HomeIcon />,
    },
    {
        href: '/tasks',
        label: 'Задачи',
        icon: <ListTodoIcon />,
    },
    {
        href: '/focus',
        label: 'Фокус',
        icon: <BrainCircuitIcon />,
    },
    {
        href: '/mood',
        label: 'Состояние',
        icon: <SmileIcon />,
    },
    {
        href: '/settings',
        label: 'Настройки',
        icon: <Settings2Icon />,
    },
];