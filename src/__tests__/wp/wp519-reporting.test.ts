import { describe, expect, it } from 'vitest';
import { getDemoPdlCockpit, demoReportList } from '@/data/demo/reportingDemo';
import { validateTransition } from '@/lib/services/workflow/workflowEngine';
import { fetchPdlCockpit } from '@/lib/reporting';
import { enforcePermission } from '@/lib/permissions';

/** WP519 — Tests Reporting */
describe('WP519 Reporting', () => {
  it('enforcePermission schützt Reporting-Service', () => {
    expect(enforcePermission(null, 'business.reporting.view')).not.toBeNull();
  });

  it('liefert PDL-Cockpit Demo-Snapshot mit KPIs', () => {
    const snapshot = getDemoPdlCockpit();
    expect(snapshot.kpis.length).toBeGreaterThan(0);
    expect(snapshot.openTasks.length).toBeGreaterThan(0);
    expect(snapshot.risks.length).toBeGreaterThan(0);
  });

  it('enthält Demo-Berichtsliste', () => {
    expect(demoReportList.length).toBeGreaterThanOrEqual(3);
    expect(demoReportList[0].title).toBeTruthy();
  });

  it('fetchPdlCockpit verweigert ohne Rolle', async () => {
    const result = await fetchPdlCockpit('tenant-demo-001', null);
    expect(result.ok).toBe(false);
  });

  it('validiert Workflow-Übergänge', () => {
    const result = validateTransition('entwurf', 'aktiv');
    expect(result.valid).toBe(true);
  });
});
