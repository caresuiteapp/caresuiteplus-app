import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Portal documents live wiring', () => {
  it('documents hook resolves portal actor context', () => {
    const hook = readSrc('src/hooks/usePortalDocuments.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('clientId');
    expect(hook).toContain('tenantId');
    expect(hook).not.toContain("useAuth");
  });

  it('document service loads live Supabase client_documents for portal actors', () => {
    const service = readSrc('src/lib/portal/documentService.ts');
    expect(service).toContain('fetchLivePortalDocumentsForClient');
    expect(service).toContain("getServiceMode() === 'supabase'");
    expect(service).toContain('downloadLivePortalDocument');
    expect(service).toContain('return { ok: true, data: [] }');

    const live = readSrc('src/lib/portal/portalDocumentsLiveService.ts');
    expect(live).toContain("fromUnknownTable(supabase, 'client_documents')");
    expect(live).toContain(".eq('portal_visible', true)");
    expect(live).toContain('canClientPortalSeeFeature');
    expect(live).toContain('createSignedUrl');
    expect(live).toContain('syncClientDocumentPortalReleaseIfEnabled');
    expect(live).toContain('mapClientDocumentToPortalListItem');
    expect(live).toContain('client_intake_documents');
    expect(live).toContain('enrichClientDocumentWithIntakeRows');
    expect(live).toContain('viewReady');
    expect(live).not.toContain('demoPortalDocuments');
  });

  it('portal list uses resolved German titles and intake HTML enrichment', () => {
    const live = readSrc('src/lib/portal/portalDocumentsLiveService.ts');
    expect(live).toContain('finalized_html');
    expect(live).toContain('preview_html');
    expect(live).toContain('collectIntakeLookupKeys');
    expect(live).toContain('resolveIntakeTemplateKey');
    expect(live).toContain("status', ['finalized', 'signed']");

    const tab = readSrc('src/components/portal/PortalDocumentsTab.tsx');
    expect(tab).toContain('formatPortalDocumentMeta');
    expect(tab).toContain('displayFileName');
    expect(tab).toContain('useDeviceClass');
    expect(tab).toContain('usePlatformLayout');
    expect(tab).toContain('PORTAL_MOBILE_NAV_HEIGHT');
    expect(tab).not.toContain('{doc.fileName}');

    const display = readSrc('src/lib/office/officeDocumentDisplay.ts');
    expect(display).toContain('resolveOfficeDocumentTitle');
    expect(display).toContain('isTechnicalIntakeDocumentTitle');
    expect(display).toContain('mapClientDocumentToPortalListItem');

    const detail = readSrc('src/screens/portal/PortalClientDocumentDetailScreen.tsx');
    expect(detail).toContain('DocumentHtmlPreview');
    expect(detail).toContain('viewReady');
  });

  it('portal fetch includes vertrag/datenschutz statuses and excludes proofs only', () => {
    const live = readSrc('src/lib/portal/portalDocumentsLiveService.ts');
    expect(live).toContain('PORTAL_CLIENT_DOCUMENT_STATUSES');
    expect(live).toContain('.in(\'status\', [...PORTAL_CLIENT_DOCUMENT_STATUSES])');
    expect(live).toContain('PORTAL_PROOFS_CATEGORY');
    expect(live).toContain(".neq('category', PORTAL_PROOFS_CATEGORY)");
    expect(live).toContain('mapCatalogCategoryToPortalCategory');

    const display = readSrc('src/lib/office/officeDocumentDisplay.ts');
    expect(display).toContain('datenschutz');

    const visibility = readSrc('src/lib/clients/clientDocumentPortalVisibility.ts');
    expect(visibility).toContain("'abgeschlossen'");
    expect(visibility).toContain("'bestaetigt'");
    expect(visibility).toContain('leistungsnachweis');
  });

  it('office syncs portal_visible when Dokumente feature is enabled', () => {
    const release = readSrc('src/lib/clients/clientDocumentPortalReleaseService.ts');
    expect(release).toContain('portal_visible: true');
    expect(release).toContain('promoteFinalizedIntakeDocumentsToClientRecord');
    expect(release).toContain('PORTAL_CLIENT_DOCUMENT_STATUSES');
    expect(release).not.toContain(".eq('status', 'aktiv')");

    const settings = readSrc('src/lib/client/clientPortalSettingsService.ts');
    expect(settings).toContain('releaseClientDocumentsForPortal');

    const documents = readSrc('src/lib/clients/clientDocumentsService.ts');
    expect(documents).toContain('syncClientDocumentPortalReleaseIfEnabled');
    expect(documents).toContain('canClientPortalSeeFeature');
  });

  it('portal RLS allows finalized document statuses', () => {
    const migration = readFileSync(
      path.join(root, 'supabase', 'migrations', '0181_portal_client_documents_status_rls.sql'),
      'utf8',
    );
    expect(migration).toContain("'abgeschlossen'");
    expect(migration).toContain("'bestaetigt'");
    expect(migration).toContain("sensitivity NOT IN ('internal', 'restricted')");
  });

  it('portal intake HTML RLS uses finalized intake statuses', () => {
    const migration = readFileSync(
      path.join(root, 'supabase', 'migrations', '0184_portal_intake_documents_html_rls_fix.sql'),
      'utf8',
    );
    expect(migration).toContain("'finalized'");
    expect(migration).toContain("'signed'");
    expect(migration).not.toContain("'abgeschlossen'");
  });

  it('document detail hook passes portal context in live mode', () => {
    const hook = readSrc('src/hooks/usePortalDocumentDetail.ts');
    expect(hook).toContain('usePortalActor');
    expect(hook).toContain('fetchPortalDocumentDetail');
    expect(hook).toContain('tenantId');
    expect(hook).toContain('clientId');
    expect(hook).toContain('downloadUrl');
    expect(hook).toContain('Linking.openURL');
  });

  it('client documents tab hides duplicate header on phone', () => {
    const route = readSrc('app/portal/client/(tabs)/documents.tsx');
    expect(route).toContain('hideHeaderOnPhone');
  });

  it('DocumentHtmlPreview uses responsive tall preview on compact and desktop viewports', () => {
    const preview = readSrc('src/components/office/DocumentHtmlPreview.tsx');
    expect(preview).toContain('maxWidth');
    expect(preview).toContain('breakpoints.tablet');
    expect(preview).toContain('resolvePreviewHeight');
    expect(preview).toContain('480');
    expect(preview).toContain('560');
    expect(preview).toContain('0.6');
    expect(preview).toContain('0.7');
  });
});
