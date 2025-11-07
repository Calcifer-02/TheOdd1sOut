'use client';

import { NavTab } from '../ui/NavTab';
import { navItems } from '@/config/navigation';
import styles from './Navigation.module.css';

export default function Navigation() {
    return (
        <nav className={styles.navigation}>
            <div className={styles.navContainer}>
                {navItems.map((item) => (
                    <NavTab
                        key={item.href}
                        href={item.href}
                        icon={item.icon}
                        label={item.label}
                    />
                ))}
            </div>
        </nav>
    );
}