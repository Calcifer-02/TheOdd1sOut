// Общая подготовка проверок интерфейса: сопоставители разметки из
// @testing-library/jest-dom, подмена ширины окна и чистая площадка перед
// каждой проверкой.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import { MOBILE_WIDTH, installViewport, setViewportWidth } from './viewport';

beforeAll(() => {
  installViewport();
});

afterEach(() => {
  cleanup();

  // Состояние выборки живёт в адресе (ADR-0008), а адрес в jsdom — общий на
  // весь файл проверок: без возврата к пустому следующая проверка начиналась
  // бы с сортировкой и пределом, которые задала предыдущая.
  window.history.replaceState(null, '', '/');

  // Ширина окна — такое же общее состояние: проверка десктопной раскладки не
  // должна превращать следующую проверку в десктопную молча.
  setViewportWidth(MOBILE_WIDTH);
});
