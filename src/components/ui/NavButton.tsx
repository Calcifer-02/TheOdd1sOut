'use client';

import { Button, ButtonProps } from '@maxhub/max-ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export interface NavButtonProps extends Omit<ButtonProps, 'onClick'> {
    href: string;
    children: ReactNode;
    isActive?: boolean; // можно вычислять внутри, но лучше передавать — гибкость
}

export function NavButton({
                              href,
                              children,
                              isActive = false,
                              mode = 'secondary',
                              size = 'medium',
                              stretched = false,
                              ...props
                          }: NavButtonProps) {
    const pathname = usePathname();
    const computedIsActive = isActive || pathname === href || pathname.startsWith(`${href}/`);

    // Используем `asChild`, чтобы Button не создавал <button>, а оборачивал <a>
    return (
        <Button
            asChild
            mode={mode}
            size={size}
            stretched={stretched}
            {...props}
        >
            <Link
                href={href}
                aria-current={computedIsActive ? 'page' : undefined}
            >
                {children}
            </Link>
        </Button>
    );
}