import styles from './layout.module.css';
import './globals.css';
import dynamic from 'next/dynamic';
import { StoreProvider } from '@/store/StoreProvider';

const ClientProviders = dynamic(
    () => import('@/components/layout/ClientProviders'),
    {
        ssr: false,
        loading: () => null,
    }
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <html lang="ru">
        <body className={styles.layout}>
            <StoreProvider>
                <main className={styles.main}>
                    {children}
                </main>
                <ClientProviders />
            </StoreProvider>
        </body>
      </html>
  );
}

