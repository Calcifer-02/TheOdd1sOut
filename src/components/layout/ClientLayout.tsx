// app/components/layout/ClientLayout.tsx
'use client';

import dynamic from 'next/dynamic';
import Navigation from './Navigation';
import '@maxhub/max-ui/dist/styles.css';

const MaxUI = dynamic(
    () => import('@maxhub/max-ui').then((mod) => mod.MaxUI),
    {
        ssr: false,
        loading: () => <div className="min-h-screen bg-background" />
    }
);

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <MaxUI>
            {children}
            <Navigation />
        </MaxUI>
    );
}
