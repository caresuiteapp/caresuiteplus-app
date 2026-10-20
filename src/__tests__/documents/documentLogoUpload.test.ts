// Service and browser-image lifecycle contracts; these tests do not verify browser layout.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareDocumentLogo, uploadDocumentLogo, type PreparedDocumentLogo } from '@/lib/documents/documentLogoUpload.web';

const h = vi.hoisted(() => ({
  denied: false, foreignTenant: false, connected: true,
  permission: vi.fn(), tenant: vi.fn(), connect: vi.fn(), bucket: vi.fn(),
  upload: vi.fn(), download: vi.fn(), publicUrl: vi.fn(), remove: vi.fn(), update: vi.fn(),
  database: vi.fn(), rpc: vi.fn(), companyLogo: vi.fn(), persistBranding: vi.fn(),
}));
vi.mock('@/lib/permissions', () => ({ enforcePermission: (...args: unknown[]) => {
  h.permission(...args); return h.denied ? { ok: false, error: 'Keine Berechtigung.' } : null;
} }));
vi.mock('@/lib/services/liveServiceGuard', () => ({ guardServiceTenant: (tenantId: string) => {
  h.tenant(tenantId); return h.foreignTenant ? { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' } : null;
} }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => {
  h.connect();
  return h.connected ? {
    storage: { from: (bucket: string) => { h.bucket(bucket); return { upload: h.upload, download: h.download, getPublicUrl: h.publicUrl, remove: h.remove, update: h.update }; } },
    from: h.database, rpc: h.rpc,
  } : null;
} }));
vi.mock('@/lib/tenant/tenantLogoService', () => ({
  TENANT_LOGO_BUCKET: 'tenant-branding', TENANT_LOGO_MAX_BYTES: 5 * 1024 * 1024,
  uploadTenantLogo: h.companyLogo, persistTenantLogoUrl: h.persistBranding,
}));

const TENANT = '123e4567-e89b-42d3-a456-426614174000';
const UPLOAD = '889bd0f4-a5fd-448c-9931-8342a0cac4cc';
const PATH = `tenant/${TENANT}/document-logos/${UPLOAD}.png`;
const MAX_BYTES = 5 * 1024 * 1024;
const PNG = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13];
const JPG = [255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1];
const WEBP = [82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80];
const logoFile = (bytes = PNG, type = 'image/png', name = 'Unternehmenslogo.png') => new File([new Uint8Array(bytes)], name, { type });
const prepared = (file = logoFile(), uploadId = UPLOAD): PreparedDocumentLogo => ({ file, uploadId, previewUrl: 'blob:local-selection', width: 900, height: 300 });
const upload = (logo = prepared(), tenant = TENANT) => uploadDocumentLogo(tenant, logo, 'business_admin');

beforeEach(() => {
  vi.clearAllMocks(); h.denied = false; h.foreignTenant = false; h.connected = true;
  h.upload.mockResolvedValue({ data: { path: PATH }, error: null });
  h.download.mockResolvedValue({ data: null, error: { message: 'Not found' } });
  h.publicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://assets.example.test/${path}` } }));
});
afterEach(() => {
  expect(h.database).not.toHaveBeenCalled();
  expect(h.rpc).not.toHaveBeenCalled();
  expect(h.companyLogo).not.toHaveBeenCalled();
  expect(h.persistBranding).not.toHaveBeenCalled();
  expect(h.remove).not.toHaveBeenCalled();
  expect(h.update).not.toHaveBeenCalled();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('document logo upload validation before Storage', () => {
  it.each([
    ['unsupported SVG', () => new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })],
    ['unsupported executable', () => logoFile(PNG, 'application/octet-stream')],
    ['inherited object key instead of MIME type', () => logoFile(WEBP, 'constructor')],
    ['empty image', () => new File([], 'logo.png', { type: 'image/png' })],
    ['over 5 MB', () => new File([new Uint8Array(MAX_BYTES + 1)], 'logo.png', { type: 'image/png' })],
    ['JPEG declared as PNG', () => logoFile(JPG, 'image/png')],
    ['PNG declared as JPEG', () => logoFile(PNG, 'image/jpeg')],
    ['invalid WebP signature', () => logoFile(PNG, 'image/webp')],
  ] as const)('rejects %s without accessing Storage', async (_label, file) => {
    const result = await upload(prepared(file()));
    expect(result.ok).toBe(false);
    expect(h.connect).not.toHaveBeenCalled();
    expect(h.bucket).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
  });
  it.each(['', 'tenant-a', `${TENANT}/../other`])('rejects invalid tenant %s before Storage even when the tenant guard passes', async (tenant) => {
    expect((await upload(prepared(), tenant)).ok).toBe(false);
    expect(h.connect).not.toHaveBeenCalled();
  });
  it.each(['', 'not-an-id', `${UPLOAD}/../logo`])('rejects invalid immutable upload ID %s', async (id) => {
    expect((await upload(prepared(logoFile(), id))).ok).toBe(false);
    expect(h.connect).not.toHaveBeenCalled();
  });
  it('honors the foreign-tenant guard for an otherwise valid UUID', async () => {
    h.foreignTenant = true;
    expect(await upload()).toEqual({ ok: false, error: 'Kein Zugriff auf diesen Mandanten.' });
    expect(h.tenant).toHaveBeenCalledWith(TENANT);
    expect(h.connect).not.toHaveBeenCalled();
  });
  it('requires document-catalog editing permission before any storage operation', async () => {
    h.denied = true;
    expect(await upload()).toEqual({ ok: false, error: 'Keine Berechtigung.' });
    expect(h.permission).toHaveBeenCalledWith('business_admin', 'office.catalogs.edit');
    expect(h.connect).not.toHaveBeenCalled();
  });
  it('returns an error when the authenticated storage client is unavailable', async () => {
    h.connected = false;
    expect((await upload()).ok).toBe(false);
    expect(h.upload).not.toHaveBeenCalled();
  });
});

describe('immutable document-logo storage and recovery', () => {
  it('uploads under the tenant and unique document-logo ID, never the company-logo key', async () => {
    const logo = prepared(logoFile(PNG, 'image/png', '../../company/logo.svg'));
    expect(await upload(logo)).toEqual({ ok: true, data: `https://assets.example.test/${PATH}` });
    expect(h.bucket).toHaveBeenCalledWith('tenant-branding');
    expect(h.upload).toHaveBeenCalledExactlyOnceWith(PATH, logo.file, { contentType: 'image/png', upsert: false, cacheControl: '31536000' });
    expect(h.publicUrl).toHaveBeenCalledExactlyOnceWith(PATH);
    expect(h.download).not.toHaveBeenCalled();
  });
  it.each([['image/jpeg', JPG, 'jpg'], ['image/webp', WEBP, 'webp']] as const)('uses a canonical extension for %s', async (type, bytes, extension) => {
    const logo = prepared(logoFile([...bytes], type));
    expect((await upload(logo)).ok).toBe(true);
    expect(h.upload).toHaveBeenCalledWith(`tenant/${TENANT}/document-logos/${UPLOAD}.${extension}`, logo.file, expect.objectContaining({ contentType: type, upsert: false }));
  });
  it('accepts the exact 5 MB boundary after a matching image signature', async () => {
    const bytes = new Uint8Array(MAX_BYTES); bytes.set(PNG);
    const file = new File([bytes], 'logo.png', { type: 'image/png' });
    expect((await upload(prepared(file))).ok).toBe(true);
  });
  it('keeps failed uploads failed if no previous object can be verified', async () => {
    h.upload.mockResolvedValue({ error: { message: 'Upload failed' } });
    expect((await upload()).ok).toBe(false);
    expect(h.download).toHaveBeenCalledExactlyOnceWith(PATH);
    expect(h.publicUrl).not.toHaveBeenCalled();
  });
  it('recovers an interrupted response only by verifying the exact bytes at the same path', async () => {
    h.upload.mockResolvedValue({ error: { message: 'Already exists' } });
    h.download.mockResolvedValue({ data: new Blob([new Uint8Array(PNG)]), error: null });
    expect((await upload()).ok).toBe(true);
    expect(h.download).toHaveBeenCalledExactlyOnceWith(PATH);
    expect(h.upload).toHaveBeenCalledTimes(1);
  });
  it.each(['different size', 'same size, different bytes'] as const)('does not reuse an existing object with %s', async (variant) => {
    h.upload.mockResolvedValue({ error: { message: 'Already exists' } });
    const bytes = variant === 'different size' ? [...PNG, 1] : PNG.map((byte, index) => index === PNG.length - 1 ? 99 : byte);
    h.download.mockResolvedValue({ data: new Blob([new Uint8Array(bytes)]), error: null });
    expect((await upload()).ok).toBe(false);
    expect(h.publicUrl).not.toHaveBeenCalled();
  });
  it('does not report success after a transport exception', async () => {
    h.upload.mockRejectedValue(new Error('Network interrupted'));
    expect((await upload()).ok).toBe(false);
    expect(h.publicUrl).not.toHaveBeenCalled();
  });
  it.each(['', 'http://assets.example.test/logo.png', 'invalid-url'])('does not expose invalid/insecure public URL %s', async (url) => {
    h.publicUrl.mockReturnValue({ data: { publicUrl: url } });
    expect((await upload()).ok).toBe(false);
  });
});

describe('prepareDocumentLogo decode and local URL lifecycle', () => {
  function imageEnvironment(outcome: 'success' | 'error' | 'timeout' = 'success', width = 900, height = 300) {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prepared-document-logo');
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.stubGlobal('Image', class {
      naturalWidth = width; naturalHeight = height;
      onload: (() => void) | null = null; onerror: (() => void) | null = null;
      set src(value: string) { if (!value || outcome === 'timeout') return; queueMicrotask(() => outcome === 'error' ? this.onerror?.() : this.onload?.()); }
    });
    return { create, revoke };
  }
  it('returns actual decoded dimensions and keeps the preview alive for its caller', async () => {
    const { revoke } = imageEnvironment();
    const file = logoFile(); const result = await prepareDocumentLogo(file);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({ file, previewUrl: 'blob:prepared-document-logo', width: 900, height: 300 });
      expect(result.data.uploadId).toMatch(/^[0-9a-f-]{36}$/i);
    }
    expect(revoke).not.toHaveBeenCalled();
    expect(h.connect).not.toHaveBeenCalled();
  });
  it('rejects invalid content before generating any local preview URL', async () => {
    const { create } = imageEnvironment();
    expect((await prepareDocumentLogo(logoFile(JPG, 'image/png'))).ok).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([['decode error', 'error', 900, 300], ['zero dimensions', 'success', 0, 300], ['over 24 MP', 'success', 6000, 4001]] as const)('revokes the preview on %s', async (_label, outcome, width, height) => {
    const { revoke } = imageEnvironment(outcome, width, height);
    expect((await prepareDocumentLogo(logoFile())).ok).toBe(false);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:prepared-document-logo');
    expect(h.upload).not.toHaveBeenCalled();
  });
  it('times out an image decode and revokes its preview', async () => {
    vi.useFakeTimers();
    const { revoke } = imageEnvironment('timeout');
    const result = prepareDocumentLogo(logoFile());
    await vi.advanceTimersByTimeAsync(10_001);
    expect((await result).ok).toBe(false);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:prepared-document-logo');
  });
});
