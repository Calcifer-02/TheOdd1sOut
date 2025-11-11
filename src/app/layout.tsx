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
        <head>
          {/* Viewport для предотвращения автозума на iOS */}
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
          />

          {/* Полноэкранный режим для iOS */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

          {/* Полноэкранный режим для Android */}
          <meta name="mobile-web-app-capable" content="yes" />

          {/* MAX Bridge - библиотека для взаимодействия с мини-приложением MAX */}
          <script src="https://st.max.ru/js/max-web-app.js" async></script>
        </head>
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

