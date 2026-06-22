import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readSrc(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('realtime wiring', () => {
  it('useOfficeDashboard abonniert Office-Dashboard-Änderungen', () => {
    const source = readSrc('src/hooks/useOfficeDashboard.ts');
    expect(source).toContain('subscribeToOfficeDashboardChanges');
    expect(source).toContain('silent: true');
    expect(source).toContain('dataRef');
    expect(source).toContain('!hasData');
  });

  it('useDashboard behält KPI-Daten bei Hintergrund-Refresh', () => {
    const source = readSrc('src/hooks/useDashboard.ts');
    expect(source).toContain('subscribeToOfficeDashboardChanges');
    expect(source).toContain('silent: true');
    expect(source).toContain('dataRef');
    expect(source).toContain('!hasData');
  });

  it('useAsyncQuery nutzt stale-while-revalidate für loading', () => {
    const source = readSrc('src/hooks/core/useAsyncQuery.ts');
    expect(source).toContain('dataRef');
    expect(source).toContain('isInitialLoad');
    expect(source).toContain('if (!silent && isInitialLoad)');
  });

  it('usePortalSidebarData nutzt usePortalAssistRealtime', () => {
    const source = readSrc('src/hooks/usePortalSidebarData.ts');
    expect(source).toContain('usePortalAssistRealtime');
  });

  it('AssistPortalOverview lädt Dashboard still bei Live-Events', () => {
    const source = readSrc('src/components/portal/assist/AssistPortalOverview.tsx');
    expect(source).toContain('usePortalAssistRealtime');
    expect(source).toContain('loadDashboard(true)');
  });

  it('useNotifications abonniert Benachrichtigungs-Tabellen', () => {
    const source = readSrc('src/hooks/usenotifications.ts');
    expect(source).toContain('subscribeToNotificationChanges');
  });

  it('Office- und Portal-Messaging nutzen bestehende Realtime-Hooks', () => {
    expect(readSrc('src/hooks/useOfficeMessageThreads.ts')).toContain('subscribeToOfficeMessageInbox');
    expect(readSrc('src/hooks/usePortalOfficeMessages.ts')).toContain('subscribeToOfficeMessageInbox');
    expect(readSrc('src/hooks/useOfficeMessageThreadDetail.ts')).toContain('subscribeToOfficeMessageThread');
  });

  it('useEmployeeList nutzt useAsyncQuery live mit Employee-Liste', () => {
    const source = readSrc('src/hooks/useEmployeeList.ts');
    expect(source).toContain('subscribeToEmployeeListChanges');
    expect(source).toContain('live:');
    expect(source).toContain('isLiveConnected');
  });

  it('useEmployeeDetail nutzt Entity-Live-Subscribe', () => {
    const source = readSrc('src/hooks/useEmployeeDetail.ts');
    expect(source).toContain('subscribeToEmployeeDetailChanges');
    expect(source).toContain('isLiveConnected');
  });

  it('useClientRecord nutzt Client-Record-Live-Subscribe', () => {
    const source = readSrc('src/hooks/useClientRecord.ts');
    expect(source).toContain('subscribeToClientRecordChanges');
    expect(source).toContain('isLiveConnected');
  });

  it('useClientList nutzt useAsyncQuery live statt manuellem useEffect', () => {
    const source = readSrc('src/hooks/useClientList.ts');
    expect(source).toContain('subscribeToClientListChanges');
    expect(source).toContain('live:');
    expect(source).toContain('isLiveConnected');
    expect(source).not.toMatch(/useEffect\(\(\) => \{[\s\S]*subscribeToClientListChanges/);
  });

  it('useAssignmentList nutzt Assist-Operations-Live-Refresh', () => {
    const source = readSrc('src/hooks/useAssignmentList.ts');
    expect(source).toContain('subscribeToAssistOperationsChanges');
    expect(source).toContain('OPERATIONAL_LIVE_POLL_MS');
    expect(source).toContain('isLiveConnected');
    expect(source).not.toContain('useEffect');
  });

  it('useAssistDashboard nutzt Assist-Operations-Live-Refresh', () => {
    const source = readSrc('src/hooks/useAssistDashboard.ts');
    expect(source).toContain('subscribeToAssistOperationsChanges');
    expect(source).toContain('OPERATIONAL_LIVE_POLL_MS');
    expect(source).toContain('isLiveConnected');
    expect(source).toContain('fetchAssistDashboardBundle');
    expect(source).toContain('authReady');
  });

  it('useActiveExecutions nutzt Assist-Operations-Live-Refresh', () => {
    const source = readSrc('src/hooks/useActiveExecutions.ts');
    expect(source).toContain('subscribeToAssistOperationsChanges');
    expect(source).toContain('OPERATIONAL_LIVE_POLL_MS');
    expect(source).toContain('isLiveConnected');
  });

  it('realtime presets exportieren neue Subscribe-Helfer', () => {
    const indexSource = readSrc('src/lib/realtime/index.ts');
    expect(indexSource).toContain('subscribeToEmployeeListChanges');
    expect(indexSource).toContain('subscribeToEmployeeDetailChanges');
    expect(indexSource).toContain('subscribeToAssistOperationsChanges');
    expect(indexSource).toContain('subscribeToTimeTrackingChanges');
    expect(indexSource).toContain('subscribeToClientListChanges');
  });
});
