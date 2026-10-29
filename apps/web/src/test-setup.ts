import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest sin globales: Testing Library no limpia sola el DOM entre pruebas.
afterEach(() => {
  cleanup();
});
