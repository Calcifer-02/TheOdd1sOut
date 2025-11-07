// ui/NavTab.tsx
'use client';

import { ToolButton } from '@maxhub/max-ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavTabProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
}

export function NavTab({
                           href,
                           icon,
                           label,
                           isActive,
                           ...props
                       }: NavTabProps) {
    const pathname = usePathname();
    const computedIsActive = isActive || pathname === href || pathname.startsWith(`${href}/`);

    const activeAppearance = computedIsActive ? 'secondary' : 'default';

    return (
        <ToolButton
            asChild
            icon={icon}
            appearance={activeAppearance}
            {...props}
        >
            <Link
                href={href}
                aria-current={computedIsActive ? 'page' : undefined}
                style={{ textDecoration: 'none' }}
            >
                {label}
            </Link>
        </ToolButton>
    );
}