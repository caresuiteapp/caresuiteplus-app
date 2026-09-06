import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('client portal experience recovery', () => {
  it('uses the personal client overview instead of the generic route card dashboard', () => {
    const route = readSrc('app/portal/client/(tabs)/index.tsx');
    const overview = readSrc('src/components/portal/AdaptivePortalOverview.tsx');
    expect(route).toContain('AdaptivePortalOverview');
    expect(route).toContain('hideHeaderOnPhone');
    expect(route).not.toContain('PortalHomeScreen');
    expect(overview).toContain('if (!routeSection)');
    expect(overview.indexOf('if (!routeSection)')).toBeLessThan(
      overview.indexOf("if (context.primaryModule === 'assist')"),
    );
    expect(
      overview.slice(
        overview.indexOf('if (!routeSection)'),
        overview.indexOf("if (context.primaryModule === 'assist')"),
      ),
    ).toContain('<AssistPortalOverview');
  });

  it('opens the complete document list from the mobile dashboard', () => {
    const home = readSrc('src/components/portal/assist/ClientPortalHomeDashboard.tsx');
    const documentBlock = home.slice(
      home.indexOf('title="Dokumente"'),
      home.indexOf('title="Unterschriften"'),
    );
    expect(documentBlock).toContain("router.push('/portal/client/documents'");
    expect(documentBlock).not.toContain('/documents/signatures');
  });

  it('keeps the client document read path free of office writes and settings-table gates', () => {
    const service = readSrc('src/lib/portal/portalDocumentsLiveService.ts');
    expect(service).not.toContain('syncClientDocumentPortalReleaseIfEnabled');
    expect(service).not.toContain('fetchClientPortalSettingsResolved');
    expect(service).toContain(".eq('portal_visible', true)");
    expect(service).toContain('PORTAL_INTERNAL_SENSITIVITIES');
  });

  it('replaces technical database details with understandable portal text', () => {
    expect(toPortalUserFacingError('Datenbankfehler: Bitte erneut versuchen.')).toBe(
      'Die Daten konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
    );
    expect(toPortalUserFacingError('permission denied for relation client_documents')).toBe(
      'Die Daten konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
    );
    expect(toPortalUserFacingError('Dokument nicht gefunden oder nicht freigegeben.')).toBe(
      'Dokument nicht gefunden oder nicht freigegeben.',
    );
  });

  it('does not expose technical module language in the profile or base overview', () => {
    const profile = readSrc('src/screens/portal/ClientPortalProfileScreen.tsx');
    const base = readSrc('src/components/portal/ClientPortalBaseOverview.tsx');
    expect(profile).not.toContain('Warten auf Modulfreigabe');
    expect(profile).not.toContain('Noch keine Module freigegeben');
    expect(base).not.toContain('Module noch nicht freigegeben');
  });

  it('alerts clients about unread messages and required signatures with direct actions', () => {
    const layout = readSrc('app/portal/client/_layout.tsx');
    const prompt = readSrc('src/components/portal/ClientPortalAttentionPrompt.tsx');
    expect(layout).toContain('ClientPortalAttentionPrompt');
    expect(prompt).toContain('Neue Nachricht');
    expect(prompt).toContain('Ihre Unterschrift wird benötigt');
    expect(prompt).toContain('`/portal/client/messages/${unread[0].id}`');
    expect(prompt).toContain("'/portal/client/documents/signatures'");
    expect(prompt).toContain('acknowledged.get(accountKey)');
  });
});
