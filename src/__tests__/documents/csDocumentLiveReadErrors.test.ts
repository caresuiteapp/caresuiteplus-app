import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  connected: true,
  requestError: null as unknown,
  signatureError: null as unknown,
  transportError: false,
  requests: [] as Record<string, unknown>[],
  filters: [] as [string, unknown][],
}));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: () => null }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => state.connected ? {} : null }));
vi.mock('@/lib/supabase/untypedTable', () => ({
  fromUnknownTable: (_client: unknown, table: string) => {
    let single = false;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { state.filters.push([key, value]); return query; },
      in: () => query,
      maybeSingle: () => { single = true; return query; },
      then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
        if (state.transportError) return Promise.reject(new Error('Connection lost')).then(resolve, reject);
        return Promise.resolve(table === 'cs_document_requests'
          ? { data: single ? state.requests[0] ?? null : state.requests, error: state.requestError }
          : { data: [], error: state.signatureError }).then(resolve, reject);
      },
    };
    return query;
  },
}));
import * as nativeService from '@/lib/documents/csTemplates/csDocumentRequestService';
import * as webService from '@/lib/documents/csTemplates/csDocumentRequestService.web';

const request = { id: 'request-1', owner_tenant_id: 'tenant-1', title: 'Pflichtdokument', status: 'sent' };
const denied = { code: '42501', message: 'permission denied' };
beforeEach(() => {
  state.connected = true; state.requestError = null; state.signatureError = null;
  state.transportError = false; state.requests = [request]; state.filters = [];
});

describe.each([['App', nativeService], ['Web', webService]] as const)('%s document read failures', (_platform, service) => {
  it('rejects a detail whose signature status cannot be read', async () => {
    state.signatureError = denied;
    expect(await service.fetchCsDocumentRequestDetail('tenant-1', 'request-1', 'business_admin')).toMatchObject({ ok: false });
    expect(state.filters).toContainEqual(['owner_tenant_id', 'tenant-1']);
  });
  it.each(['requests', 'signatures', 'transport', 'disconnected'] as const)('does not declare documents unblocked after a %s failure', async failure => {
    if (failure === 'requests') state.requestError = denied;
    if (failure === 'signatures') state.signatureError = denied;
    if (failure === 'transport') state.transportError = true;
    if (failure === 'disconnected') state.connected = false;
    expect(await service.inspectBlockingCsDocumentsForAssignment('tenant-1', 'assignment-1')).toMatchObject({ ok: false });
    expect(await service.hasBlockingCsDocumentForAssignment('tenant-1', 'assignment-1')).toMatchObject({ ok: false });
  });
  it('reports no blocking documents only after a successful empty query', async () => {
    state.requests = [];
    expect(await service.inspectBlockingCsDocumentsForAssignment('tenant-1', 'assignment-1')).toEqual({ ok: true, data: { hasBlockingDocuments: false, blockingRequests: [], reason: null } });
    expect(await service.hasBlockingCsDocumentForAssignment('tenant-1', 'assignment-1')).toEqual({ ok: true, data: false });
  });
});
