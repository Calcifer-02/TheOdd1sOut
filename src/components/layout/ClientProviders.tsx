// app/components/layout/ClientProviders.tsx
'use client';

import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import Navigation from './Navigation';

export default function ClientProviders() {
    return (
        <MaxUI>
            <Navigation />
        </MaxUI>
    );
}