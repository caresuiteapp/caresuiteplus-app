// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
const route = vi.hoisted(() => ({ id: 'first' }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => route,
  useRouter: () => ({ replace() {} }),
}));
vi.mock('@/components/portal/EmployeePortalExecutionErrorBoundary', () => ({
  EmployeePortalExecutionErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/screens/portal/EmployeePortalVisitExecutionScreen', () => ({
  EmployeePortalVisitExecutionScreen: function Form() {
    const [draft, setDraft] = useState('');
    return (
      <>
        <button onClick={() => setDraft('Erster Einsatz')}>Edit</button>
        <output>{draft}</output>
      </>
    );
  },
}));
import VisitRoute from '../../../app/portal/employee/assignments/[id]/execute';
it('keeps the current visit draft on rerender but discards it from the view when opening another visit', async () => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(<VisitRoute />));
    await act(async () => host.querySelector('button')!.click());
    await act(async () => root.render(<VisitRoute />));
    expect(host.querySelector('output')?.textContent).toBe('Erster Einsatz');
    route.id = 'second';
    await act(async () => root.render(<VisitRoute />));
    expect(host.querySelector('output')?.textContent).toBe('');
  } finally {
    await act(async () => root.unmount());
  }
});
