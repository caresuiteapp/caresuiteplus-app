import { describe, expect, it } from 'vitest';
import {
  fetchClientFullDetail,
  fetchClientInternalNotes,
  fetchClientNotesForPortal,
  toPortalView,
  assertNoInternalNotesInPortalView,
} from '@/lib/clients';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

describe('ClientNotes Portal Isolation', () => {
  it('Office-Query liefert interne Notizen', async () => {
    const result = await fetchClientInternalNotes(DEMO_TENANT_ID, 'client-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((n) => n.isInternal === true)).toBe(true);
  });

  it('Portal-Query liefert KEINE internen Notizen', async () => {
    const result = await fetchClientNotesForPortal(DEMO_TENANT_ID, 'client-001');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('toPortalView entfernt internalNotes', async () => {
    const full = await fetchClientFullDetail(DEMO_TENANT_ID, 'client-002');
    expect(full.ok).toBe(true);
    if (!full.ok) return;

    expect(full.data.internalNotes.length).toBeGreaterThan(0);

    const portalView = toPortalView(full.data);
    expect('internalNotes' in portalView).toBe(false);
    expect(assertNoInternalNotesInPortalView(portalView)).toBe(true);
  });

  it('Timeline-Portalfilter schließt interne Ereignisse aus', async () => {
    const full = await fetchClientFullDetail(DEMO_TENANT_ID, 'client-001');
    expect(full.ok).toBe(true);
    if (!full.ok) return;

    const hasInternal = full.data.timeline.some((e) => e.isInternal);
    expect(hasInternal).toBe(true);

    const portalEvents = full.data.timeline.filter((e) => !e.isInternal);
    expect(portalEvents.every((e) => !e.isInternal)).toBe(true);
    expect(portalEvents.length).toBeLessThan(full.data.timeline.length);
  });
});
