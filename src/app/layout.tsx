import type { Metadata } from 'next';
import Navigation from '@/components/layout/Navigation';
import './globals.css';

export const metadata: Metadata = {
  title: 'MAX Mini App - Социальное приложение',
  description: 'Мини-приложение для мессенджера MAX - Хакатон VK 2025',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <Navigation />
        <main>{children}</main>
      </body>
    </html>
  );
}

