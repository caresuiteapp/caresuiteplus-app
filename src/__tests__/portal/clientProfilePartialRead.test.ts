import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/hooks/core', () => ({ useAsyncQuery: h.query }));
vi.mock('@/hooks/usePortalActor', () => ({ usePortalActor: () => ({
  tenantId: 'tenant-1', clientId: 'client-1', actorId: 'account-1', roleKey: 'client_portal',
  isReady: true, isLinkedReady: true, isResolvingClientLink: false,
}) }));
vi.mock('@/lib/portal', () => ({ fetchClientPortalProfile: vi.fn(), fetchClientCarePlanSummaries: vi.fn() }));
import { useClientPortalProfile } from '@/hooks/useClientPortalProfile';

const query = (patch = {}) => ({ data: null, loading: false, error: null, refreshError: null, refresh: vi.fn(), ...patch });
function readHook(profileQuery: unknown, plansQuery: unknown) {
  h.query.mockReturnValueOnce(profileQuery).mockReturnValueOnce(plansQuery);
  let result: ReturnType<typeof useClientPortalProfile> | undefined;
  function Probe() { result = useClientPortalProfile(); return null; }
  renderToStaticMarkup(createElement(Probe));
  return result!;
}
beforeEach(() => vi.clearAllMocks());
describe('client profile partial reads', () => {
  it('preserves the loaded profile while exposing a care-plan read failure', () => {
    const result = readHook(query({ data: { profile: { clientId: 'client-1' } } }), query({ error: 'Pflegepläne konnten nicht geladen werden.' }));
    expect(result.profile?.clientId).toBe('client-1');
    expect(result.carePlans).toEqual([]);
    expect(result.carePlanError).toBeTruthy();
    expect(result.error).toBeTruthy();
  });
  it('exposes refresh failures while preserving previously loaded care plans', () => {
    const result = readHook(query({ data: { profile: { clientId: 'client-1' } } }), query({ data: [{ id: 'plan-1' }], refreshError: 'Network error' }));
    expect(result.carePlans).toEqual([{ id: 'plan-1' }]);
    expect(result.carePlanError).toBeTruthy();
  });
  it('keeps a successfully loaded empty care-plan list separate from errors', () => {
    const result = readHook(query({ data: { profile: { clientId: 'client-1' } } }), query({ data: [] }));
    expect(result.carePlans).toEqual([]);
    expect(result.carePlanError).toBeNull();
  });
});
