import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal visit execution UX completion', () => {
  it('execution screen wires photo, voice and attachment references', () => {
    const screen = readSrc('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(screen).toContain('EmployeePortalVisitPhotoModal');
    expect(screen).toContain('EmployeePortalVisitVoiceNoteModal');
    expect(screen).toContain('photoReferences');
    expect(screen).toContain('onOpenAttachments');
    expect(screen).not.toContain('Foto-Anhang ist in dieser Version noch nicht verfügbar');
    expect(screen).not.toContain('Sprachnotiz folgt');
  });

  it('documentation panel supports attachments and external AI trigger', () => {
    const panel = readSrc('src/components/portal/EmployeePortalVisitDocumentationPanel.tsx');
    expect(panel).toContain('photoReferences');
    expect(panel).toContain('openAiRequest');
    expect(panel).toContain('EmployeePortalVisitDocumentationAiModal');
  });

  it('task grouping uses workflow category resolver', () => {
    const grouping = readSrc('src/lib/portal/groupEmployeePortalTasks.ts');
    expect(grouping).toContain('resolveVisitTaskCategory');
  });

  it('visit attachment service uploads to assist visit storage path', () => {
    const service = readSrc('src/lib/portal/employeePortalVisitAttachmentService.ts');
    const paths = readSrc('src/lib/assist/assistStoragePaths.ts');
    expect(service).toContain('buildAssistVisitAttachmentStoragePath');
    expect(paths).toContain('attachments');
  });

  it('live dashboard exposes attachment compact card', () => {
    const dashboard = readSrc('src/components/portal/EmployeePortalVisitLiveDashboard.tsx');
    expect(dashboard).toContain('Fotos / Anhänge');
    expect(dashboard).toContain('attachmentCount');
  });
});
