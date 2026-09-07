// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: unknown) => s },
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Image: () => <img />,
}));
vi.mock('expo-router', () => ({ useFocusEffect: () => {} }));
vi.mock('@/lib/dom/releaseSignatureCaptureEnvironment', () => ({ releaseSignatureCaptureEnvironment: vi.fn() }));
vi.mock('@/theme', () => ({ spacing: { sm: 8, xs: 4 }, typography: { caption: {} } }));
vi.mock('@/components/ui', () => ({
  PremiumButton: () => null, PremiumInput: () => null,
  InfoBanner: ({ message }: { message: string }) => <p>{message}</p>,
}));
vi.mock('@/components/portal/EmployeePortalVisitCompactCard', () => ({ EmployeePortalVisitCompactCard: () => null }));
vi.mock('@/components/inputs/CareSignatureModal', () => ({
  CareSignatureModal: (p: { visible: boolean; disabled: boolean; statusMessage?: string; onConfirm: (value: string) => void; onCheckStatus?: () => void }) => p.visible ? (
    <section role="dialog">
      <textarea defaultValue="original signature strokes" />
      <p role="status">{p.statusMessage}</p>
      <button disabled={p.disabled} onClick={() => p.onConfirm('data:image/png;base64,original')}>Save</button>
      {p.onCheckStatus ? <button onClick={p.onCheckStatus}>Check</button> : null}
    </section>
  ) : null,
}));
import { EmployeePortalVisitSignaturePanel } from '@/components/portal/EmployeePortalVisitSignaturePanel';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(onCapture: () => Promise<{ ok: boolean; error?: string }>, extra: Record<string, unknown> = {}) {
  await act(async () => root.render(<EmployeePortalVisitSignaturePanel clientName="Testperson" modalOnly openCaptureRequest={1} onCapture={onCapture} {...extra} />));
}
async function click(label: string) {
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === label)!.click());
}

it('keeps the original capture visible when confirmation has timed out', async () => {
  const save = vi.fn().mockResolvedValue({ ok: false, error: 'Speicherung noch nicht bestätigt' });
  await render(save); const canvas = host.querySelector('textarea');
  await click('Save');
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
  expect(host.querySelector('textarea')).toBe(canvas);
  expect(host.querySelector('textarea')?.value).toBe('original signature strokes');
  expect(host.textContent).toContain('Speicherung noch nicht bestätigt');
});

it('shows a real storage error inside the tablet capture without losing its strokes', async () => {
  await render(vi.fn().mockResolvedValue({ ok: false, error: 'Upload fehlgeschlagen' }));
  await click('Save');
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
  expect(host.textContent).toContain('Upload fehlgeschlagen');
});

it('catches unexpected exceptions and keeps the capture open', async () => {
  await render(vi.fn().mockRejectedValue(new Error('connection lost')));
  await click('Save');
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
  expect(host.textContent).toContain('Speicherung konnte nicht bestätigt werden');
});

it('allows a read-only status check without resubmitting while a write is unconfirmed', async () => {
  const save = vi.fn(); const check = vi.fn();
  await render(save, { confirmationPending: true, confirmationStalled: true, onCheckStatus: check });
  await click('Save'); await click('Check');
  expect(save).not.toHaveBeenCalled();
  expect(check).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
});

it('closes only on actual success or an authoritative late confirmation', async () => {
  const save = vi.fn().mockResolvedValue({ ok: true });
  await render(save); await click('Save');
  expect(host.querySelector('[role=dialog]')).toBeNull();
  await render(save, { openCaptureRequest: 2 });
  expect(host.querySelector('[role=dialog]')).not.toBeNull();
  await render(save, { openCaptureRequest: 2, closeCaptureRequest: 1 });
  expect(host.querySelector('[role=dialog]')).toBeNull();
});

it('shows a late server error while preserving the capture', async () => {
  const save = vi.fn().mockResolvedValue({ ok: false, error: 'Noch nicht bestätigt' });
  await render(save); await click('Save'); const canvas = host.querySelector('textarea');
  await render(save, { saveError: 'Speicherung vom Server abgelehnt' });
  expect(host.textContent).toContain('Speicherung vom Server abgelehnt');
  expect(host.querySelector('textarea')).toBe(canvas);
});
