// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const f = vi.hoisted(() => ({ proofs: vi.fn(), documents: vi.fn(), actor: 'a' }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({ tenantId: 't', clientId: 'c', actorId: f.actor, roleKey: 'client_portal', isLinkedReady: true }) }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/lib/realtime', () => ({ subscribeToClientPortalDocumentRequestChanges: () => () => {} }));
vi.mock('@/lib/portal/clientSignatureAttention', () => ({ fetchClientPendingProofs: f.proofs, fetchClientPendingDocuments: f.documents }));
import { ClientSignatureAttentionProvider, useClientSignatureAttention } from '@/components/portal/ClientSignatureAttentionProvider.web';
import { invalidatePortalProofCache } from '@/lib/portal/portalProofCacheSignal';
let root: Root; let host: HTMLDivElement;
function Status() { const state = useClientSignatureAttention(); return <output>{state.items.length}:{state.error ?? ''}</output>; }
const render = async () => { await act(async () => root.render(<ClientSignatureAttentionProvider><Status /></ClientSignatureAttentionProvider>)); };
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, React }); f.actor = 'a';
  f.proofs.mockResolvedValue({ ok: true, data: [{ id: 'p' }] }); f.documents.mockResolvedValue({ ok: true, data: [] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('removes completed signatures immediately after the completion event', async () => {
  await render(); expect(host.textContent).toBe('1:');
  f.proofs.mockResolvedValue({ ok: true, data: [] });
  await act(async () => invalidatePortalProofCache()); expect(host.textContent).toBe('0:');
});
it('retains a known open task when its refresh fails', async () => {
  await render(); f.proofs.mockResolvedValue({ ok: false, error: 'Abfrage fehlgeschlagen' });
  await act(async () => invalidatePortalProofCache()); expect(host.textContent).toBe('1:Abfrage fehlgeschlagen');
});
it('clears prior-account items before the new-account response arrives', async () => {
  await render(); f.actor = 'b'; f.proofs.mockImplementation(() => new Promise(() => {})); f.documents.mockImplementation(() => new Promise(() => {}));
  await render(); expect(host.textContent).toBe('0:');
});
