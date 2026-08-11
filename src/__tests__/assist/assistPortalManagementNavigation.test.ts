import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('Assist Portalverwaltung', () => {
  it('opens the functional client portal administration from the Assist navigation', () => {
    const catalog = read('src/liquid-command/navigation/moduleCatalog.ts');
    const route = read('app/assist/portale.tsx');

    expect(catalog).toMatch(/id: 'portals',[\s\S]*?route: '\/assist\/portale'/);
    expect(route).toContain('ClientPortalCodesScreen');
    expect(route).not.toContain('DomainPortalScreen');
  });

  it('keeps the former preview route functional instead of rendering a placeholder', () => {
    const legacyRoute = read('app/assist/portal-preview.tsx');

    expect(legacyRoute).toContain('ClientPortalCodesScreen');
    expect(legacyRoute).not.toContain('DomainPortalScreen');
  });

  it('passes the selected Assist client into the portal administration', () => {
    const workspace = read('src/liquid-command/screens/AssistClientsWorkspace.tsx');
    const portalScreen = read('src/screens/office/access/ClientPortalCodesScreen.tsx');

    expect(workspace).toContain('/assist/portale?clientId=${clientId}');
    expect(portalScreen).toContain('useLocalSearchParams');
    expect(portalScreen).toContain('requestedClientExists');
  });

  it('exposes real portal operations', () => {
    const portalScreen = read('src/screens/office/access/ClientPortalCodesScreen.tsx');

    expect(portalScreen).toContain('setupClientPortalAccess');
    expect(portalScreen).toContain('regenerateClientPortalAccessCode');
    expect(portalScreen).toContain('copyTextToClipboard');
    expect(portalScreen).toContain('Aktive Portal-Zugänge');
  });
});
