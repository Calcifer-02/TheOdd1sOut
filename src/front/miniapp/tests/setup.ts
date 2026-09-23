// Общая подготовка проверок интерфейса: сопоставители разметки из
// @testing-library/jest-dom и чистая площадка перед каждой проверкой.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
