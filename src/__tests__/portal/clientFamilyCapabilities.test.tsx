// @vitest-environment happy-dom
// Real data hooks/provider, with authenticated actor and network/device boundaries inert.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalActor } from '@/hooks/usePortalActor';
import type { FamilyPortalAccessScope, FamilyPortalCapability } from '@/lib/portal/familyPortalAccessScope';
const f = vi.hoisted(() => ({ actor: {} as PortalActor, appointments: vi.fn(), appointment: vi.fn(), documents: vi.fn(), document: vi.fn(), download: vi.fn(), change: vi.fn(), live: vi.fn(), inbox: vi.fn(), thread: vi.fn(), send: vi.fn(), restart: vi.fn(), read: vi.fn(), ensure: vi.fn(), pendingProofs: vi.fn(), pendingDocuments: vi.fn(), context: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) }, Linking: { openURL: vi.fn() } }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => f.actor }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ authReady: true, user: { id: 'auth-user' }, portalSession: { tenantId: 'tenant-a', accountId: 'account-a', clientId: 'client-a', roleKey: 'family_portal' } }) }));
vi.mock('@/hooks/useConnectivity', () => ({ useConnectivity: () => ({ isOffline: false }) }));
vi.mock('@/lib/services/queryTimeout', () => ({ withServiceQueryTimeout: (promise: unknown) => promise, NATIVE_SERVICE_QUERY_TIMEOUT_MS: 30000 }));
vi.mock('@/hooks/core/useLiveRefresh', () => ({ DEFAULT_LIVE_POLL_MS: 30000, useLiveRefresh: () => ({ isLiveConnected: false }) }));
vi.mock('@/hooks/core', async () => ({ ...await import('@/hooks/core/useAsyncQuery'), ...await import('@/hooks/core/useMutation'), DEFAULT_LIVE_POLL_MS: 30000, LIVE_TRACKING_POLL_MS: 30000 }));
vi.mock('@/lib/portal', () => ({ fetchPortalDocuments: f.documents, fetchPortalDocumentDetail: f.document, downloadPortalDocument: f.download }));
vi.mock('@/lib/portal/appointmentService', () => ({ fetchPortalClientAppointmentDetail: f.appointment, requestPortalAppointmentChange: f.change }));
vi.mock('@/lib/offline/assignmentCacheService', () => ({ loadPortalAppointmentsWithCache: f.appointments }));
vi.mock('@/lib/offline/clientAppointmentCache', () => ({ readClientAppointmentCache: async () => null, writeClientAppointmentCache: async () => {} }));
vi.mock('@/lib/offline/idb', () => ({ offlineCacheEpoch: () => 1 }));
vi.mock('@/lib/realtime', () => ({ subscribeToEmployeePortalChanges: () => () => {}, subscribeToPortalAssistChanges: () => () => {}, subscribeToClientPortalDocumentRequestChanges: () => () => {} }));
vi.mock('@/lib/realtime/presets', () => ({ subscribeToAssistLiveTrackingChanges: () => () => {} }));
vi.mock('@/lib/polling/useVisibilityAwarePolling', () => ({ useVisibilityAwarePolling: () => {} }));
vi.mock('@/lib/performance', () => ({ useDevicePerformance: () => ({ profile: 'normal' }), livePollIntervalMs: () => 30000 }));
vi.mock('@/lib/portal/portalAppointmentsLiveService', () => ({ fetchActiveLivePortalAssignmentForClient: f.live }));
vi.mock('@/features/liveTracking/getClientLiveVisitLocation', () => ({ getClientLiveVisitLocation: async () => ({ mapVisible: false }), sanitizeClientLiveVisitLocation: (value: unknown) => value }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/auth/portalSupabaseAuth', () => ({ ensurePortalWriteSession: f.ensure }));
vi.mock('@/lib/office/portalofficemessageservice', () => ({ resolvePortalActor: () => ({ ok: true, data: { type: 'client', clientId: f.actor.clientId } }), fetchPortalOfficeThreads: f.inbox, fetchPortalOfficeThreadDetail: f.thread, sendPortalOfficeMessage: f.send, startNewPortalThreadFromClosed: f.restart }));
vi.mock('@/lib/office/messagereadservice', () => ({ markPortalThreadMessagesRead: f.read }));
vi.mock('@/lib/office/officemessagerealtime', () => ({ subscribeToOfficeMessageInbox: () => () => {}, subscribeToOfficeMessageThread: () => () => {} }));
vi.mock('@/lib/portal/clientSignatureAttention', () => ({ fetchClientPendingProofs: f.pendingProofs, fetchClientPendingDocuments: f.pendingDocuments }));
vi.mock('@/lib/portal/engine/resolvePortalContext', () => ({ resolvePortalContext: f.context }));
import { usePortalAppointments } from '@/hooks/usePortalAppointments';
import { usePortalDocuments } from '@/hooks/usePortalDocuments';
import { usePortalDocumentDetail } from '@/hooks/usePortalDocumentDetail';
import { usePortalClientAppointmentDetail } from '@/hooks/usePortalClientAppointmentDetail';
import { usePortalClientLiveTracking } from '@/hooks/usePortalClientLiveTracking';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import { usePortalOfficeThreadDetail } from '@/hooks/useportalofficethreaddetail';
import { ClientSignatureAttentionProvider, useClientSignatureAttention } from '@/components/portal/ClientSignatureAttentionProviderCore';
import { usePortalContext } from '@/hooks/usePortalContext';

let root: Root, host: HTMLDivElement;
const permissions = (allowed: FamilyPortalCapability[]) => Object.fromEntries(allowed.map(key => [key, true])) as FamilyPortalAccessScope['permissions'];
function grant(...allowed: FamilyPortalCapability[]) { f.actor = { ...f.actor, familyAccess: { tenantId: 'tenant-a', accountId: 'account-a', clientId: 'client-a', relativeContactId: 'relative-a', validFrom: '2026-01-01T00:00:00.000000Z', expiresAt: null, source: 'authenticated_family_portal_scope', permissions: permissions(allowed) } }; }
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  f.actor = { tenantId: 'tenant-a', actorId: 'account-a', clientId: 'client-a', employeeId: null, roleKey: 'family_portal', familyAccess: null, displayName: 'Angehörige Testperson', isReady: true, isLinkedReady: true, isResolvingClientLink: false, isResolvingEmployeeLink: false, isResolvingDisplayName: false };
  f.appointments.mockResolvedValue({ ok: true, data: [{ id: 'visit-a' }] }); f.appointment.mockResolvedValue({ ok: true, data: { id: 'visit-a' } });
  f.documents.mockResolvedValue({ ok: true, data: [{ id: 'document-a' }] }); f.document.mockResolvedValue({ ok: true, data: { id: 'document-a' } });
  f.inbox.mockResolvedValue({ ok: true, data: [{ id: 'thread-a' }] }); f.thread.mockResolvedValue({ ok: true, data: { id: 'thread-a', messages: [] } });
  f.live.mockResolvedValue({ ok: true, data: null }); f.pendingProofs.mockResolvedValue({ ok: true, data: [{ id: 'proof-a' }] }); f.pendingDocuments.mockResolvedValue({ ok: true, data: [{ id: 'document-a' }] });
  f.ensure.mockResolvedValue({ ok: true }); f.send.mockResolvedValue({ ok: true, data: { id: 'sent-a' } }); f.restart.mockResolvedValue({ ok: true, data: { id: 'new-thread' } }); f.read.mockResolvedValue({ ok: true, data: null });
  f.context.mockResolvedValue({ clientId: 'client-a', displayName: 'Neuer erlaubter Kontext' });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('family capabilities across actual retained client hooks', () => {
  it('keeps service-record-only proof reads separate from general document deep links', async () => {
    grant('service_records');
    let detail!: ReturnType<typeof usePortalDocumentDetail>;
    function Probe({ proof }: { proof: boolean }) { detail = usePortalDocumentDetail('proof-a', 'client', proof ? 'service-proof' : undefined); return null; }
    await render(<Probe proof />);
    expect(f.document).toHaveBeenCalledExactlyOnceWith('proof-a', 'account-a', 'family_portal', { tenantId: 'tenant-a', clientId: 'client-a', employeeId: null, contentKind: 'service-proof' });
    await act(async () => { await detail.download(); }); expect(f.download).not.toHaveBeenCalled();
    await render(<Probe proof={false} />); expect(detail.data).toBeNull(); expect(detail.error).toContain('nicht freigegeben'); expect(f.document).toHaveBeenCalledOnce();
  });
  it('does not turn appointment visibility, messaging or confirmation capabilities into a schedule-change writer', async () => {
    grant('appointments', 'send_messages', 'confirm_appointments');
    f.appointment.mockResolvedValue({ ok: true, data: { id: 'visit-a', canRequestChange: true } });
    let detail!: ReturnType<typeof usePortalClientAppointmentDetail>;
    function Probe() { detail = usePortalClientAppointmentDetail('visit-a'); return null; }
    await render(<Probe />); expect(f.appointment).toHaveBeenCalledOnce(); expect(detail.data?.canRequestChange).toBe(false);
    await act(async () => { await detail.requestChange('Bitte einen anderen Termin planen.'); });
    expect(f.change).not.toHaveBeenCalled();
  });
  it('blocks appointment detail and live-location deep links before their services', async () => {
    let detail!: ReturnType<typeof usePortalClientAppointmentDetail>;
    let live!: ReturnType<typeof usePortalClientLiveTracking>;
    function Probe() { detail = usePortalClientAppointmentDetail('visit-a'); live = usePortalClientLiveTracking(); return <div>{detail.error}{live.error}</div>; }
    await render(<Probe />); await act(async () => { await detail.requestChange('Bitte später'); });
    expect(f.appointment).not.toHaveBeenCalled(); expect(f.live).not.toHaveBeenCalled(); expect(f.change).not.toHaveBeenCalled(); expect(host.textContent).toContain('nicht freigegeben');
  });
  it.each(['appointments', 'documents', 'messages'] as const)('removes known %s immediately when its capability is revoked', async capability => {
    let values: unknown[] = [];
    function Probe() {
      const a = usePortalAppointments('client'), d = usePortalDocuments('client'), m = usePortalOfficeMessages();
      values = capability === 'appointments' ? a.items : capability === 'documents' ? d.items : m.threads;
      return <div>{values.length}</div>;
    }
    grant('appointments', 'documents', 'messages'); await render(<Probe />); expect(values).toHaveLength(1);
    const reads = [f.appointments.mock.calls.length, f.documents.mock.calls.length, f.inbox.mock.calls.length];
    grant(); await render(<Probe />); expect(values).toHaveLength(0);
    expect([f.appointments.mock.calls.length, f.documents.mock.calls.length, f.inbox.mock.calls.length]).toEqual(reads);
  });
  it('never requests a document download when document viewing itself is denied', async () => {
    let detail!: ReturnType<typeof usePortalDocumentDetail>;
    function Probe() { detail = usePortalDocumentDetail('document-a', 'client'); return null; }
    grant('download_documents'); await render(<Probe />); await act(async () => { await detail.download(); });
    expect(f.document).not.toHaveBeenCalled(); expect(f.download).not.toHaveBeenCalled();
  });
  it('protects direct thread reads, read receipts and writes instead of relying on the inbox', async () => {
    let thread!: ReturnType<typeof usePortalOfficeThreadDetail>;
    function Probe() { thread = usePortalOfficeThreadDetail('thread-a'); return <div>{thread.error}</div>; }
    await render(<Probe />);
    await act(async () => { await thread.markAsRead(); await thread.sendMessage('Text'); await thread.startNewChat(); });
    expect(f.thread).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled(); expect(f.restart).not.toHaveBeenCalled(); expect(f.ensure).not.toHaveBeenCalled();
    expect(thread.loading).toBe(false); expect(host.textContent).toContain('nicht freigegeben');
  });
  it('allows a read-only family conversation without allowing send or restart', async () => {
    let thread!: ReturnType<typeof usePortalOfficeThreadDetail>;
    function Probe() { thread = usePortalOfficeThreadDetail('thread-a'); return null; }
    grant('messages'); await render(<Probe />); expect(thread.detail?.id).toBe('thread-a'); expect(thread.canSend).toBe(false);
    await act(async () => { await thread.markAsRead(); await thread.sendMessage('Text'); await thread.startNewChat(); });
    expect(f.read).toHaveBeenCalledOnce(); expect(f.send).not.toHaveBeenCalled(); expect(f.restart).not.toHaveBeenCalled(); expect(f.ensure).not.toHaveBeenCalled();
  });
  it('does not trap read-only family accounts behind an unfulfillable signature requirement', async () => {
    let attention!: ReturnType<typeof useClientSignatureAttention>;
    function Probe() { attention = useClientSignatureAttention(); return <div>{attention.items.length}</div>; }
    grant('documents', 'service_records'); await render(<ClientSignatureAttentionProvider><Probe /></ClientSignatureAttentionProvider>);
    expect(f.pendingProofs).not.toHaveBeenCalled(); expect(f.pendingDocuments).not.toHaveBeenCalled(); expect(attention.items).toEqual([]);
    grant('documents', 'service_records', 'sign_records'); await render(<ClientSignatureAttentionProvider><Probe /></ClientSignatureAttentionProvider>); expect(attention.items).toHaveLength(2);
    grant('documents', 'service_records'); await render(<ClientSignatureAttentionProvider><Probe /></ClientSignatureAttentionProvider>); expect(attention.items).toEqual([]);
  });
  it('ends thread loading with an actionable error when account linking has failed', async () => {
    f.actor = { ...f.actor, roleKey: 'client_portal', isLinkedReady: false, clientId: null };
    let thread!: ReturnType<typeof usePortalOfficeThreadDetail>;
    function Probe() { thread = usePortalOfficeThreadDetail('thread-a'); return <div>{thread.error}</div>; }
    await render(<Probe />); expect(thread.loading).toBe(false); expect(host.textContent).toContain('erneut an'); expect(f.thread).not.toHaveBeenCalled();
  });
  it('binds the home context read to current family capabilities and rejects a late prior-grant response', async () => {
    let context!: ReturnType<typeof usePortalContext>;
    function Probe() { context = usePortalContext(); return <div>{context.context?.displayName}</div>; }
    let finish!: (value: unknown) => void;
    f.context.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    grant('documents'); await render(<Probe />);
    expect(f.context).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', clientId: 'client-a', roleKey: 'family_portal', familyAccess: expect.objectContaining({ accountId: 'account-a', permissions: { documents: true } }) }));
    grant(); await render(<Probe />); expect(host.textContent).toContain('Neuer erlaubter Kontext');
    await act(async () => finish({ displayName: 'Privater Altstand der früheren Freigabe' }));
    expect(host.textContent).not.toContain('Privater Altstand'); expect(context.context?.displayName).toBe('Neuer erlaubter Kontext');
  });
});
