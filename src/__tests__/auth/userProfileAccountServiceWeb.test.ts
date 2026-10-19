import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types';
import type { UserAvatarPending } from '@/lib/auth/useravatarservice';
import {
  readUserProfileAvatarFile,
  removeUserAccountAvatar,
  saveUserAccountAvatar,
  saveUserProfileAccount,
  validateUserProfileAccountDraft,
} from '@/lib/auth/userProfileAccountService.web';

const mocks = vi.hoisted(() => {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn() };
  const bucket = { upload: vi.fn(), getPublicUrl: vi.fn(), remove: vi.fn() };
  return {
    query, bucket,
    client: { auth: { getUser: vi.fn() }, from: vi.fn(), storage: { from: vi.fn() } },
    clientAvailable: true,
    demo: false,
    decodeFails: false,
    resolveProfile: vi.fn(),
    patchDemo: vi.fn(),
    written: {} as Record<string, unknown>,
    sequence: 0,
  };
});

vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => mocks.clientAvailable ? mocks.client : null }));
vi.mock('@/lib/supabase/config', () => ({ isDemoMode: () => mocks.demo }));
vi.mock('@/lib/auth/resolveAuthenticatedProfile', () => ({ resolveAuthenticatedProfileId: mocks.resolveProfile }));
vi.mock('@/lib/auth/userprofileservice', () => ({
  patchDemoProfileOverride: mocks.patchDemo,
  buildUserProfileWritePayload: (first: string, last: string, updatedAt: string) => ({ first_name: first || null, last_name: last || null, updated_at: updatedAt }),
}));
vi.mock('@/lib/auth/userdisplayname', () => ({ composeUserFullName: (first: string | null, last: string | null) => [first?.trim(), last?.trim()].filter(Boolean).join(' ') || null }));

const profile: Profile = {
  id: 'profile-legacy', tenantId: 'tenant-1', roleId: 'role-1', roleKey: 'business_admin',
  firstName: 'Kevin', lastName: 'Reinhardt', displayName: 'Kevin Reinhardt',
  email: 'konto@example.org', phone: '+49 123', avatarUrl: 'https://example.org/old.png',
  createdAt: '2026-01-01T10:00:00Z', updatedAt: '2026-01-01T10:00:00Z',
};
const row = {
  id: profile.id, tenant_id: profile.tenantId, first_name: profile.firstName, last_name: profile.lastName,
  phone: profile.phone, avatar_url: profile.avatarUrl, updated_at: profile.updatedAt,
};
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=';
function pending(): UserAvatarPending {
  return { localUri: `data:image/png;base64,${png}`, fileName: 'bild.png', mimeType: 'image/png', sizeBytes: atob(png).length, contentBase64: png };
}
function imageFile(bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0)), type = 'image/png', size = bytes.byteLength): File {
  return { name: 'bild.png', type, size, arrayBuffer: async () => bytes.buffer } as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo = false;
  mocks.clientAvailable = true;
  mocks.decodeFails = false;
  mocks.sequence = 0;
  mocks.written = {};
  mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });
  mocks.resolveProfile.mockResolvedValue({ ok: true, data: profile.id });
  mocks.client.from.mockReturnValue(mocks.query);
  mocks.client.storage.from.mockReturnValue(mocks.bucket);
  mocks.query.update.mockImplementation((payload: Record<string, unknown>) => { mocks.written = payload; return mocks.query; });
  mocks.query.eq.mockReturnValue(mocks.query);
  mocks.query.select.mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockImplementation(async () => ({ data: { ...row, ...mocks.written }, error: null }));
  mocks.bucket.upload.mockResolvedValue({ data: { path: 'uploaded' }, error: null });
  mocks.bucket.getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `https://storage.example.org/storage/v1/object/public/user-avatars/${path}` } }));
  vi.stubGlobal('crypto', { randomUUID: () => `new-${++mocks.sequence}` });
  vi.stubGlobal('Image', class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 1;
    naturalHeight = 1;
    set src(value: string) {
      if (value) queueMicrotask(() => { if (mocks.decodeFails) this.onerror?.(); else this.onload?.(); });
    }
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('Web profile account validation', () => {
  it('trims names and optional phone without requiring both names', () => {
    expect(validateUserProfileAccountDraft({ firstName: ' Kevin ', lastName: ' ', phone: ' +49 123 ' })).toEqual({
      ok: true, data: { firstName: 'Kevin', lastName: '', phone: '+49 123' },
    });
  });

  it('rejects clearing both names even when a previous display name exists', async () => {
    const result = await saveUserProfileAccount(profile, 'auth-1', { firstName: ' ', lastName: '', phone: '' });
    expect(result.ok).toBe(false);
    expect(mocks.client.from).not.toHaveBeenCalled();
    expect(mocks.resolveProfile).not.toHaveBeenCalled();
  });

  it.each([
    { firstName: 'x'.repeat(121), lastName: '', phone: '' },
    { firstName: 'Kevin', lastName: '', phone: 'x'.repeat(51) },
    { firstName: 'Ke\nvin', lastName: '', phone: '' },
  ])('rejects excessive lengths and control characters: %j', (draft) => {
    expect(validateUserProfileAccountDraft(draft).ok).toBe(false);
  });
});

describe('Web own-profile persistence', () => {
  it('uses verified legacy identity and writes only permitted personal fields', async () => {
    const result = await saveUserProfileAccount(profile, 'auth-1', { firstName: ' Eva ', lastName: ' ', phone: ' 555 ' });
    expect(mocks.resolveProfile).toHaveBeenCalledWith('tenant-1');
    expect(mocks.query.eq).toHaveBeenCalledWith('id', 'profile-legacy');
    expect(mocks.query.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    expect(mocks.written).toEqual({ first_name: 'Eva', last_name: null, phone: '555', updated_at: expect.any(String) });
    expect(result).toEqual({ ok: true, data: { ...profile, firstName: 'Eva', lastName: null, displayName: 'Eva', phone: '555', updatedAt: expect.any(String) } });
  });

  it('rejects a different signed-in user before a profile write', async () => {
    mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-2' } }, error: null });
    expect((await saveUserProfileAccount(profile, 'auth-1', { firstName: 'Eva', lastName: '', phone: '' })).ok).toBe(false);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('rejects an unconfirmed profile mapping before a profile write', async () => {
    mocks.resolveProfile.mockResolvedValue({ ok: true, data: 'another-profile' });
    expect((await saveUserProfileAccount(profile, 'auth-1', { firstName: 'Eva', lastName: '', phone: '' })).ok).toBe(false);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it.each([null, { ...row, tenant_id: 'another-tenant' }, { ...row, id: 'another-profile' }])('does not treat an absent or mismatched returned row as success', async (data) => {
    mocks.query.maybeSingle.mockResolvedValue({ data, error: null });
    expect((await saveUserProfileAccount(profile, 'auth-1', { firstName: 'Eva', lastName: '', phone: '' })).ok).toBe(false);
  });

  it('catches rejected requests and exposes a usable message', async () => {
    mocks.query.maybeSingle.mockRejectedValue(new Error('Failed to fetch'));
    expect(await saveUserProfileAccount(profile, 'auth-1', { firstName: 'Eva', lastName: '', phone: '' })).toEqual({
      ok: false, error: expect.stringContaining('Internetverbindung'),
    });
  });

  it('keeps demo edits scoped to the current profile without live calls', async () => {
    mocks.demo = true;
    expect((await saveUserProfileAccount(profile, 'auth-1', { firstName: 'Eva', lastName: '', phone: '' })).ok).toBe(true);
    expect(mocks.patchDemo).toHaveBeenCalledWith(profile.id, expect.objectContaining({ firstName: 'Eva', phone: null }));
    expect(mocks.client.auth.getUser).not.toHaveBeenCalled();
    expect(mocks.client.from).not.toHaveBeenCalled();
  });
});

describe('Web profile image selection', () => {
  it('reads an allowed decodable image and reports the actual byte count', async () => {
    expect(await readUserProfileAvatarFile(imageFile())).toEqual({ ok: true, data: pending() });
  });

  it('rejects MIME and image-signature mismatches', async () => {
    expect((await readUserProfileAvatarFile(imageFile(undefined, 'image/jpeg'))).ok).toBe(false);
    expect((await readUserProfileAvatarFile(imageFile(undefined, 'image/gif'))).ok).toBe(false);
  });

  it('rejects files that the browser cannot decode', async () => {
    mocks.decodeFails = true;
    expect((await readUserProfileAvatarFile(imageFile())).ok).toBe(false);
  });

  it.each([0, NaN, 5 * 1024 * 1024 + 1])('rejects an invalid declared size: %s', async (size) => {
    expect((await readUserProfileAvatarFile(imageFile(undefined, 'image/png', size))).ok).toBe(false);
  });

  it('checks actual bytes instead of trusting an understated file size', async () => {
    expect((await readUserProfileAvatarFile(imageFile(new Uint8Array(5 * 1024 * 1024 + 1), 'image/png', 1))).ok).toBe(false);
  });
});

describe('Web account avatar persistence', () => {
  it('uploads to a unique tenant/user path without overwriting the current image', async () => {
    const first = await saveUserAccountAvatar(profile, 'auth-1', pending());
    const second = await saveUserAccountAvatar(profile, 'auth-1', pending());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(mocks.bucket.upload).toHaveBeenNthCalledWith(1, 'tenant/tenant-1/users/auth-1/avatar-new-1.png', expect.any(Uint8Array), { contentType: 'image/png', upsert: false });
    expect(mocks.bucket.upload).toHaveBeenNthCalledWith(2, 'tenant/tenant-1/users/auth-1/avatar-new-2.png', expect.any(Uint8Array), { contentType: 'image/png', upsert: false });
    expect(Object.keys(mocks.written).sort()).toEqual(['avatar_url', 'updated_at']);
    expect(mocks.bucket.remove).not.toHaveBeenCalled();
  });

  it('does not persist a URL when upload fails and hides backend implementation details', async () => {
    mocks.bucket.upload.mockResolvedValue({ error: { message: 'Bucket not found: migration 0088' } });
    const result = await saveUserAccountAvatar(profile, 'auth-1', pending());
    expect(result).toEqual({ ok: false, error: expect.stringContaining('nicht hochgeladen') });
    expect(mocks.query.update).not.toHaveBeenCalled();
  });

  it('rejects a session change during upload before writing the profile', async () => {
    mocks.bucket.upload.mockImplementation(async () => {
      mocks.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'auth-2' } }, error: null });
      return { error: null };
    });
    expect((await saveUserAccountAvatar(profile, 'auth-1', pending())).ok).toBe(false);
    expect(mocks.query.update).not.toHaveBeenCalled();
  });

  it('keeps existing objects untouched if profile persistence returns no row', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await saveUserAccountAvatar(profile, 'auth-1', pending())).ok).toBe(false);
    expect(mocks.bucket.remove).not.toHaveBeenCalled();
  });

  it('does not delete potentially referenced objects after an uncertain network result', async () => {
    mocks.query.maybeSingle.mockRejectedValue(new Error('Network request failed'));
    expect((await saveUserAccountAvatar(profile, 'auth-1', pending())).ok).toBe(false);
    expect(mocks.bucket.remove).not.toHaveBeenCalled();
  });

  it('rejects malformed or mismatched pending bytes before upload', async () => {
    expect((await saveUserAccountAvatar(profile, 'auth-1', { ...pending(), contentBase64: 'not-base64!' })).ok).toBe(false);
    expect((await saveUserAccountAvatar(profile, 'auth-1', { ...pending(), sizeBytes: 1 })).ok).toBe(false);
    expect(mocks.bucket.upload).not.toHaveBeenCalled();
  });

  it('removes the profile reference only after a confirmed row update', async () => {
    const result = await removeUserAccountAvatar(profile, 'auth-1');
    expect(result.ok && result.data.avatarUrl).toBe(null);
    expect(mocks.written).toEqual({ avatar_url: null, updated_at: expect.any(String) });
    expect(mocks.bucket.remove).not.toHaveBeenCalled();
  });

  it('reports failed removal instead of displaying an unsaved empty avatar', async () => {
    mocks.query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect((await removeUserAccountAvatar(profile, 'auth-1')).ok).toBe(false);
  });
});
