import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ShowcaseApp } from './app/ShowcaseApp';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден корневой узел разметки');
}

createRoot(container).render(
  <StrictMode>
    <ShowcaseApp />
  </StrictMode>,
);
