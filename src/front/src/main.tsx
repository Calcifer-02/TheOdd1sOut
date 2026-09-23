import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Не найден корневой узел разметки');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
