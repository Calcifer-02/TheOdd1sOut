/**
 * Корень приложения: оформление, оболочка и выбор экрана по адресу.
 *
 * Экранов стало пять, потому что пути пользователя пять этапов и они не
 * помещаются в одну страницу: расчёт, кабинет с подпиской, предложение и
 * заявка, справочник полигонов, редактор цен. Какой этап открыт — видно в
 * адресе, и ссылка на него возвращает туда же (ADR-0008, инвариант 5).
 *
 * Выбор экрана — таблицей, а не деревом условий: незнакомый адрес обязан
 * давать понятный экран, а не пустую страницу.
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import { useEffect, type ReactNode } from 'react';
import { CabinetPage } from '@/pages/cabinet';
import { CalculatorPage } from '@/pages/calculator';
import { LandfillsPage } from '@/pages/landfills';
import { QuotePage } from '@/pages/quote';
import { ReferencesPage } from '@/pages/references';
import { ChatIdentity } from '@/features/identify-from-chat';
import { CALCULATOR_PATH, useRoute } from '@/shared/lib/routing';
import { useThemeStyles } from '@/shared/ui';
import { AppShell } from '@/widgets/app-shell';

/** Экраны сервиса: адрес, заголовок вкладки и содержимое. */
const SCREENS: { path: string; title: string; render: () => ReactNode }[] = [
  { path: CALCULATOR_PATH, title: 'Расчёт вывоза отходов', render: () => <CalculatorPage /> },
  { path: '/cabinet', title: 'Кабинет', render: () => <CabinetPage /> },
  { path: '/quote', title: 'Коммерческое предложение', render: () => <QuotePage /> },
  { path: '/landfills', title: 'Полигоны', render: () => <LandfillsPage /> },
  { path: '/references', title: 'Редактор цен', render: () => <ReferencesPage /> },
];

export function App() {
  useThemeStyles();

  const route = useRoute();
  const screen = SCREENS.find((item) => item.path === route.path) ?? SCREENS[0];

  useEffect(() => {
    // Заголовок вкладки называет этап, а не способ доставки приложения:
    // «мини-приложение» — свойство платформы, а не дело пользователя.
    document.title = `${screen.title} — ИМОЛТ`;
  }, [screen.title]);

  return (
    <AppShell>
      <ChatIdentity />
      {screen.render()}
    </AppShell>
  );
}
