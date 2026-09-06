// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({
  proofs: vi.fn(),
  documents: vi.fn(),
  router: { push: vi.fn() },
  actorId: 'a',
  pathname: '/portal/client',
  threads: [] as { id: string; unreadCount: number }[],
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  AppState: { addEventListener: () => ({ remove() {} }) },
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('expo-router', () => ({ useRouter: () => f.router, usePathname: () => f.pathname }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({
  DEFAULT_LIVE_POLL_MS: 30000,
  useLiveRefresh: () => ({ isLiveConnected: false }),
}));
vi.mock('@/lib/realtime', () => ({
  subscribeToClientPortalDocumentRequestChanges: () => () => {},
}));
vi.mock('@/hooks/usePortalActor', () => ({
  usePortalActor: () => ({
    tenantId: 't',
    clientId: 'c',
    actorId: f.actorId,
    roleKey: 'client_portal',
    isLinkedReady: true,
  }),
}));
vi.mock('@/hooks/useportalofficemessages', () => ({
  usePortalOfficeMessages: () => ({ threads: f.threads, loading: true }),
}));
vi.mock('@/lib/portal/clientSignatureAttention', () => ({
  fetchClientPendingProofs: f.proofs,
  fetchClientPendingDocuments: f.documents,
  signatureAttentionKey: (item: { kind: string; id: string }) => `${item.kind}:${item.id}`,
}));
vi.mock('@/components/portal/assist/PortalGlassModal', () => ({
  PortalGlassModal: ({
    visible,
    title,
    onClose,
    onPrimary,
    children,
  }: {
    visible: boolean;
    title: string;
    onClose: () => void;
    onPrimary: () => void;
    children: React.ReactNode;
  }) =>
    visible ? (
      <section>
        <h1>{title}</h1>
        <button onClick={onClose}>Later</button>
        <button onClick={onPrimary}>Go</button>
        {children}
      </section>
    ) : null,
}));
vi.mock('@/components/ui', () => ({
  PremiumButton: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <button onClick={onPress}>{title}</button>
  ),
}));
import {
  ClientSignatureAttentionProvider,
  useClientSignatureAttention,
} from '@/components/portal/ClientSignatureAttentionProvider';
import { ClientPortalAttentionPrompt } from '@/components/portal/ClientPortalAttentionPrompt';
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  f.actorId = crypto.randomUUID();
  f.pathname = '/portal/client';
  f.threads = [];
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
const proof = { kind: 'proof', id: 'p', title: 'Nachweis', route: '/portal/client/documents/p' };
function Count() {
  const state = useClientSignatureAttention();
  return (
    <output>
      {state.items.length}:{state.error ?? ''}
    </output>
  );
}
it('shows proof attention without waiting for documents or messages; dismissal does not remove the open task', async () => {
  f.proofs.mockResolvedValue({ ok: true, data: [proof] });
  f.documents.mockImplementation(() => new Promise(() => {}));
  await act(async () =>
    root.render(
      <ClientSignatureAttentionProvider>
        <Count />
        <ClientPortalAttentionPrompt />
      </ClientSignatureAttentionProvider>,
    ),
  );
  expect(host.querySelector('h1')?.textContent).toBe('Ihre Unterschrift wird benötigt');
  await act(async () =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Later')!.click(),
  );
  expect(host.querySelector('h1')).toBeNull();
  expect(host.querySelector('output')?.textContent).toBe('1:');
});
it('opens the exact document despite failure of the other source and clears it on account switch', async () => {
  const document = {
    ...proof,
    kind: 'document',
    id: 'd',
    route: '/portal/client/documents/signatures/d',
  };
  f.proofs.mockResolvedValue({ ok: false, error: 'offline' });
  f.documents.mockResolvedValue({ ok: true, data: [document] });
  const view = () => (
    <ClientSignatureAttentionProvider>
      <Count />
      <ClientPortalAttentionPrompt />
    </ClientSignatureAttentionProvider>
  );
  await act(async () => root.render(view()));
  await act(async () =>
    [...host.querySelectorAll('button')].find((b) => b.textContent === 'Go')!.click(),
  );
  expect(f.router.push).toHaveBeenCalledWith(document.route);
  f.actorId = 'different';
  f.proofs.mockImplementation(() => new Promise(() => {}));
  f.documents.mockImplementation(() => new Promise(() => {}));
  await act(async () => root.render(view()));
  expect(host.querySelector('output')?.textContent).toBe('0:');
});
