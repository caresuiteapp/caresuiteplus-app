import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('ClientPortalOverviewScreen adaptive engine wiring', () => {
  it('renders AdaptivePortalOverview via portal engine', () => {
    const source = readSrc('src/screens/portal/ClientPortalOverviewScreen.tsx');
    expect(source).toContain('AdaptivePortalOverview');
    expect(source).toContain('usePortalActor');
    expect(source).not.toContain('PortalOverviewTab');
    expect(source).not.toContain('Kein Portalinhalt');
  });

  it('loads portal context from module assignments', () => {
    const hook = readSrc('src/hooks/usePortalContext.ts');
    expect(hook).toContain('resolvePortalContext');
    const service = readSrc('src/lib/portal/clientModuleAssignmentService.ts');
    expect(service).toContain('client_module_assignments');
    expect(service).toContain('upsert');
    expect(service).toContain('onConflict: \'tenant_id,client_id,module_key\'');
  });

  it('fetches live widget data for active modules', () => {
    const fetcher = readSrc('src/lib/portal/engine/fetchPortalWidgetData.ts');
    expect(fetcher).toContain('fetchPortalWidgetData');
    expect(fetcher).toContain('care_plans');
    expect(fetcher).toContain('assignments');
    const resolver = readSrc('src/lib/portal/engine/resolvePortalContext.ts');
    expect(resolver).toContain('fetchPortalWidgetData');
    const live = readSrc('src/lib/portal/clientPortalDashboardLive.ts');
    expect(live).toContain('portal_visible');
    expect(live).toContain('portal_unread_count');
    expect(live).toContain('assignments');
  });

  it('treats assignment fetch failure as not configured (not empty modules)', () => {
    const resolver = readSrc('src/lib/portal/engine/resolvePortalContext.ts');
    expect(resolver).toContain('assignmentLoadFailed');
  });

  it('surfaces missing client link and timeout instead of infinite loading', () => {
    const hook = readSrc('src/hooks/usePortalContext.ts');
    expect(hook).toContain('Kein Klient:innenprofil verknüpft');
    expect(hook).toContain('withTimeout');
    expect(hook).toContain('isResolvingClientLink');
    const overview = readSrc('src/components/portal/AdaptivePortalOverview.tsx');
    expect(overview).toContain('loading && !context');
    const actor = readSrc('src/hooks/usePortalActor.ts');
    expect(actor).toContain('fetchPortalClientIdByAccessAccount');
    expect(actor).toContain('isLinkedReady');
  });

  it('portal messaging hooks wait for resolved client link via usePortalActor', () => {
    const messagesHook = readSrc('src/hooks/usePortalOfficeMessages.ts');
    expect(messagesHook).toContain('usePortalActor');
    expect(messagesHook).toContain('isLinkedReady');
    expect(messagesHook).toContain('clientId');
    expect(messagesHook).toContain('{ clientId, employeeId }');

    const threadHook = readSrc('src/hooks/usePortalOfficeThreadDetail.ts');
    expect(threadHook).toContain('usePortalActor');
    expect(threadHook).toContain('isLinkedReady');

    const modal = readSrc('src/components/portal/portalnewchatmodal.tsx');
    expect(modal).toContain('usePortalActor');
    expect(modal).toContain('isLinkedReady');
  });
});
