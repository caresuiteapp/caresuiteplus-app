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
});
