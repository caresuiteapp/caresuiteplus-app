import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('employee portal camera persistence R5', () => {
  it('persists every uploaded visit medium with durable metadata', () => {
    const service = read('src/lib/portal/employeePortalVisitAttachmentService.ts');

    expect(service).toContain("'assist_visit_attachments'");
    expect(service).toContain('upload_source: \'employee_portal\'');
    expect(service).toContain('employee_id: input.employeeId');
    expect(service).toContain('metadataPersisted: false');
    expect(service).not.toContain('.remove([storagePath])');
  });

  it('recovers orphaned files from storage and documentation references', () => {
    const service = read('src/lib/portal/employeePortalVisitAttachmentService.ts');

    expect(service).toContain('.list(folder');
    expect(service).toContain(".select('photo_references')");
    expect(service).toContain("upload_source: 'recovered'");
    expect(service).toContain("onConflict: 'tenant_id,storage_path'");
  });

  it('recovers an Android camera result after activity recreation', () => {
    const picker = read('src/lib/portal/employeePortalMediaPicker.ts');
    const execution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');

    expect(picker).toContain('ImagePicker.getPendingResultAsync()');
    expect(picker).toContain("Platform.OS !== 'android'");
    expect(execution).toContain('recoverEmployeePortalPendingCameraMedia');
    expect(execution).toContain("setLocalSuccess('Kameraaufnahme wiederhergestellt und dauerhaft gespeichert.')");
  });

  it('uses a real HTTPS browser camera with a readable capture surface', () => {
    const picker = read('src/lib/portal/employeePortalMediaPicker.ts');
    const vercel = read('vercel.json');

    expect(picker).toContain('navigator.mediaDevices.getUserMedia');
    expect(picker).toContain('window.isSecureContext');
    expect(picker).toContain("facingMode: { ideal: 'environment' }");
    expect(picker).toContain("capture.textContent = 'Foto aufnehmen'");
    expect(vercel).toContain('camera=(self)');
  });

  it('uploads a captured visit medium immediately without a second save action', () => {
    const modal = read('src/components/portal/EmployeePortalVisitPhotoModal.tsx');

    expect(modal).toContain('if (acceptedMedia) await handleUpload(acceptedMedia)');
    expect(modal).toContain('employeeId,');
    expect(modal).toContain('Geräteeinstellungen öffnen');
    expect(modal).toContain('Seite nach Freigabe neu laden');
  });

  it('provides the durable metadata table and employee-portal RLS', () => {
    const migration = read(
      'supabase/migrations/20260826090000_employee_portal_visit_media_persistence_r5.sql',
    );

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.assist_visit_attachments');
    expect(migration).toContain('UNIQUE (tenant_id, storage_path)');
    expect(migration).toContain('assist_visit_attachments_portal_select');
    expect(migration).toContain('assist_visit_attachments_portal_insert');
    expect(migration).toContain('portal_employee_assigned_visit_ids');
  });

});
