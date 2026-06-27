import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Portal appointments live wiring', () => {
  it('appointments hook resolves portal actor context', () => {
    const hook = readSrc('src/hooks/usePortalAppointments.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('clientId');
    expect(hook).toContain('tenantId');
    expect(hook).not.toContain('useAuth');
  });

  it('appointment service loads live Supabase assignments for portal actors', () => {
    const service = readSrc('src/lib/portal/appointmentService.ts');
    expect(service).toContain('fetchLivePortalAppointmentsForClient');
    expect(service).toContain("getServiceMode() === 'supabase'");
    expect(service).toContain('return { ok: true, data: [] }');
    expect(service).toContain('fetchLivePortalAppointmentsForEmployee');

    const live = readSrc('src/lib/portal/portalAppointmentsLiveService.ts');
    expect(live).toContain("fromUnknownTable(supabase, 'assignments')");
    expect(live).toContain(".eq('client_id', filter.clientId)");
    expect(live).toContain("'planned'");
    expect(live).not.toContain('demoAppointments');
    expect(live).not.toContain('Helga Schneider');
  });

  it('client appointment detail hook passes portal context in live mode', () => {
    const hook = readSrc('src/hooks/usePortalClientAppointmentDetail.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('fetchPortalClientAppointmentDetail');
    expect(hook).toContain('tenantId');
    expect(hook).toContain('clientId');
  });

  it('client Einsätze tab shows live empty state copy', () => {
    const tab = readSrc('src/components/portal/PortalAppointmentsTab.tsx');
    expect(tab).toContain("'Keine Einsätze geplant'");
    expect(tab).toContain('ErrorState');
  });
});
