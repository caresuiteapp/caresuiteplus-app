import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_PORTAL_VIDEO_MAX_BYTES,
  normalizeEmployeePortalPickedMedia,
  validateEmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';
import {
  MESSAGE_VIDEO_ATTACHMENT_MAX_BYTES,
  validateMessageAttachment,
} from '@/lib/office/messageattachmentvalidation';

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('employee portal camera and media upload R1', () => {
  it('normalizes real iPhone HEIC and MOV picker results', () => {
    expect(
      normalizeEmployeePortalPickedMedia({
        uri: 'file:///IMG_0001.HEIC',
        fileName: 'IMG_0001.HEIC',
        mimeType: 'application/octet-stream',
      }),
    ).toMatchObject({ mimeType: 'image/heic', kind: 'image' });

    expect(
      normalizeEmployeePortalPickedMedia({
        uri: 'file:///clip.MOV',
        fileName: 'clip.MOV',
        mimeType: null,
      }),
    ).toMatchObject({ mimeType: 'video/quicktime', kind: 'video' });
  });

  it('creates a safe filename when the native camera supplies none', () => {
    const media = normalizeEmployeePortalPickedMedia({
      uri: 'file:///camera-result',
      reportedKind: 'image',
      prefix: 'kamera',
    });
    expect(media.fileName).toMatch(/^kamera-\d+\.jpg$/);
    expect(media.mimeType).toBe('image/jpeg');
  });

  it('accepts portal videos up to 50 MB and rejects larger uploads', () => {
    const base = normalizeEmployeePortalPickedMedia({
      uri: 'file:///einsatz.mp4',
      fileName: 'einsatz.mp4',
      mimeType: 'video/mp4',
      sizeBytes: EMPLOYEE_PORTAL_VIDEO_MAX_BYTES,
    });
    expect(validateEmployeePortalPickedMedia(base, 'portal-upload')).toEqual({ ok: true });
    expect(
      validateEmployeePortalPickedMedia(
        { ...base, sizeBytes: EMPLOYEE_PORTAL_VIDEO_MAX_BYTES + 1 },
        'portal-upload',
      ).ok,
    ).toBe(false);
  });

  it('keeps visit documents limited to PDF while allowing photos and videos', () => {
    const pdf = normalizeEmployeePortalPickedMedia({
      uri: 'file:///nachweis.pdf',
      fileName: 'nachweis.pdf',
      sizeBytes: 200,
    });
    const word = normalizeEmployeePortalPickedMedia({
      uri: 'file:///nachweis.docx',
      fileName: 'nachweis.docx',
      sizeBytes: 200,
    });
    expect(validateEmployeePortalPickedMedia(pdf, 'visit')).toEqual({ ok: true });
    expect(validateEmployeePortalPickedMedia(word, 'visit').ok).toBe(false);
  });

  it('accepts HEIC and 50 MB video message attachments', () => {
    expect(
      validateMessageAttachment({
        fileName: 'foto.heic',
        mimeType: 'image/heic',
        fileSizeBytes: 1024,
      }),
    ).toEqual({ ok: true });
    expect(
      validateMessageAttachment({
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        fileSizeBytes: MESSAGE_VIDEO_ATTACHMENT_MAX_BYTES,
      }),
    ).toEqual({ ok: true });
    expect(
      validateMessageAttachment({
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        fileSizeBytes: MESSAGE_VIDEO_ATTACHMENT_MAX_BYTES + 1,
      }).ok,
    ).toBe(false);
  });

  it('declares native permissions, browser policy and deterministic storage migration', () => {
    const app = read('app.json');
    const appConfig = read('app.config.ts');
    const vercel = read('vercel.json');
    const migration = read(
      'supabase/migrations/20260824113000_employee_portal_camera_media_upload_r1.sql',
    );

    expect(app).toContain('"expo-image-picker"');
    expect(app).toContain('"CAMERA"');
    expect(app).toContain('"RECORD_AUDIO"');
    expect(appConfig).toContain("'expo-image-picker'");
    expect(appConfig).toContain("permissions: ['INTERNET', 'CAMERA', 'RECORD_AUDIO']");
    expect(appConfig).toContain('NSCameraUsageDescription');
    expect(vercel).toContain('camera=(self), microphone=(self)');
    expect(migration).toContain("'image/heic'");
    expect(migration).toContain("'video/mp4'");
    expect(migration).toContain('assist_execution_storage_portal_insert');
    expect(migration).toContain('is_employee_portal_rls_context');
    expect(migration).toContain('portal_employee_assigned_visit_ids');
    expect(migration).not.toContain('WHEN insufficient_privilege');
  });
});
