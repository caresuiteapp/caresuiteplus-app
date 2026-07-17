import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('Office, portals and live workspace finalization', () => {
  it('makes desktop navigation and context sidebars independently scrollable', () => {
    const moduleNav = source('src/components/layout/platform/modulenavsidebar.tsx');
    const context = source('src/components/layout/platform/rightcontextpanel.tsx');
    const portalRight = source('src/components/layout/portal/PortalRightSidebar.tsx');

    expect(moduleNav).toContain("overflowY: 'auto'");
    expect(context).toContain("overflowY: 'auto'");
    expect(portalRight).toContain('ScrollView');
    expect(portalRight).toContain("overflowY: 'auto'");
  });

  it('shows portal uploads in Office and routes employee uploads into employee_documents', () => {
    const screen = source('src/screens/office/OfficeDocumentsListScreen.tsx');
    const service = source('src/lib/portal/assist/portalDocumentUploadService.ts');

    expect(screen).toContain('PortalUploadsOfficePanel');
    expect(screen).toContain('Eingang aus Mitarbeiter- und Klient:innenportal');
    expect(service).toContain("fromUnknownTable(supabase, 'employee_documents')");
    expect(service).toContain("upload.uploadContext === 'mitarbeiter'");
  });

  it('keeps GPS tracking active from departure through active service', () => {
    const execution = source('src/hooks/useEmployeePortalVisitExecution.ts');
    const tracking = source('src/lib/portal/employeePortalVisitTrackingService.ts');
    const gps = source('src/features/liveTracking/useEmployeeGpsTracking.ts');

    expect(execution).toContain("['unterwegs', 'angekommen', 'gestartet', 'pausiert']");
    expect(execution).toContain('ended && ctx.liveContext');
    expect(tracking).toContain('entry.trackingActive = entry.consent.granted');
    expect(gps).toContain('if (!releaseWatchRef.current) void startWatching()');
  });

  it('renders template previews automatically', () => {
    const preview = source('src/screens/documents/DocumentLivePreviewScreen.tsx');

    expect(preview).toContain('void handleRender()');
  });

  it('imports the absence helper used by the WFM time-account calculation', () => {
    const service = source('src/lib/wfm/wfmOfficeTimekeepingService.ts');
    expect(service).toContain("import { isWfmAbsenceCoveringDate } from './wfmDisplayHelpers'");
  });
});
