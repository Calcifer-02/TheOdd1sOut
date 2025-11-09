// src/config/navigation.tsx
import {
    HomeIcon,
    BrainCircuitIcon,
    SmileIcon,
    UserCircleIcon,
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
        href: '/profile',
        label: 'Профиль',
        icon: <UserCircleIcon />,
    },
];


