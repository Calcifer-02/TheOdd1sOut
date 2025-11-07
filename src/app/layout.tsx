import styles from './layout.module.css';
import './globals.css';
import dynamic from 'next/dynamic';

const ClientProviders = dynamic(
    () => import('@/components/layout/ClientProviders'),
    {
        ssr: false, // ← ключевое: не рендерить на сервере
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
            <main className={styles.main}>
                {children}
            </main>
            <ClientProviders />
        </body>
      </html>
  );
}

