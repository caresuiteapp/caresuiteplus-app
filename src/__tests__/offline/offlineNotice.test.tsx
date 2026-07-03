import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('OfflineNotice', () => {
  const root = path.join(__dirname, '..', '..');
  const noticeSource = readFileSync(path.join(root, 'components/ui/OfflineNotice.tsx'), 'utf8');

  it('exports honest OFFLINE.1 stage message', () => {
    expect(noticeSource).toContain(
      'Keine Verbindung. Einige Funktionen sind eingeschränkt. Offline-Speicherung wird schrittweise vorbereitet.',
    );
    expect(noticeSource).not.toMatch(/alle.*daten.*gespeichert/i);
  });

  it('returns null when visible is false', () => {
    expect(noticeSource).toContain('if (!visible) return null');
  });

  it('uses warning InfoBanner with offline title', () => {
    expect(noticeSource).toContain('InfoBanner');
    expect(noticeSource).toContain('variant="warning"');
    expect(noticeSource).toContain('title="Offline"');
    expect(noticeSource).toContain('OFFLINE_NOTICE_MESSAGE');
  });

  it('is wired in EmployeePortalShell via useConnectivity', () => {
    const source = readFileSync(
      path.join(root, 'components/portal/EmployeePortalShell.tsx'),
      'utf8',
    );
    expect(source).toContain('useConnectivity');
    expect(source).toContain('OfflineNotice');
    expect(source).toContain('isOffline');
  });
});
