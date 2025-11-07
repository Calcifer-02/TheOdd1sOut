// app/components/layout/ClientLayout.tsx
'use client';

import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import Navigation from './Navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <MaxUI>
            {children}
            <Navigation />
        </MaxUI>
    );
}