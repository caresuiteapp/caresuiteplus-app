// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Platform: { OS: 'web' }, useWindowDimensions: () => ({ width: 768 }),
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children, testID }: { children: React.ReactNode; testID?: string }) => <span data-testid={testID}>{children}</span>,
  Pressable: ({ children, onPress, testID }: { children: React.ReactNode; onPress: () => void; testID?: string }) => <button data-testid={testID} onClick={onPress}>{children}</button>,
}));
vi.mock('@/components/ui/PremiumCard', () => ({ PremiumCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
vi.mock('@/theme', () => ({ spacing: {}, typography: {} }));
vi.mock('@/lib/portal/employeePortalExecutionSurface', () => ({ employeePortalExecutionSurface: {}, employeePortalExecutionText: {} }));
import { EmployeePortalVisitLiveDashboard } from '@/components/portal/EmployeePortalVisitLiveDashboard';

let root: Root; let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const defaults = {
  tasks: [], documentationStatus: 'none' as const, signatureCaptured: false,
  requiresSignature: true, serviceSeconds: 0, onOpenTasks: vi.fn(),
  onOpenDocumentation: vi.fn(), onOpenSignature: vi.fn(), onOpenAttachments: vi.fn(),
};
const state = (card: string) => host.querySelector(`[data-testid="portal-open-${card}-state"]`)?.textContent?.trim();
async function render(props: Partial<React.ComponentProps<typeof EmployeePortalVisitLiveDashboard>> = {}) {
  await act(async () => root.render(<EmployeePortalVisitLiveDashboard {...defaults} {...props} />));
}
it('shows open markers for actionable cards whose content has not been saved', async () => {
  await render();
  for (const card of ['tasks', 'documentation', 'signature', 'attachments']) expect(state(card)).toBe('○');
});
it('uses a warning and a clear read-only action for an unconfirmed signature', async () => {
  const check = vi.fn();
  await render({ signatureConfirmationPending: true, signatureConfirmationStalled: true, onCheckSignature: check });
  expect(state('signature')).toBe('!');
  const button = host.querySelector<HTMLButtonElement>('[data-testid="portal-open-signature"]')!;
  expect(button.textContent).toContain('Status prüfen');
  await act(async () => button.click());
  expect(check).toHaveBeenCalledOnce();
  expect(defaults.onOpenSignature).not.toHaveBeenCalled();
});
it('does not report a prior signature as confirmed during a new pending capture', async () => {
  await render({ signatureCaptured: true, signatureConfirmationPending: true });
  expect(state('signature')).toBe('↻');
  expect(host.querySelector('button[data-testid="portal-open-signature"]')).toBeNull();
});
it('shows completion only for saved documentation, signature and attachments', async () => {
  await render({ documentationStatus: 'submitted', signatureCaptured: true, attachmentCount: 1 });
  for (const card of ['documentation', 'signature', 'attachments']) expect(state(card)).toBe('✓');
  expect(state('tasks')).toBe('○');
});
