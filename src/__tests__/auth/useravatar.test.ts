import { describe, expect, it } from 'vitest';
import {
  buildUserAvatarStoragePath,
  toUserAvatarUploadError,
  USER_AVATAR_MAX_BYTES,
  validateUserAvatarFile,
} from '@/lib/auth/useravatarservice';

describe('user avatar service', () => {
  it('builds tenant-isolated storage path', () => {
    expect(buildUserAvatarStoragePath('tenant-1', 'user-1', 'image/jpeg')).toBe(
      'tenant/tenant-1/users/user-1/avatar.jpg',
    );
    expect(buildUserAvatarStoragePath('tenant-1', 'user-1', 'image/webp')).toBe(
      'tenant/tenant-1/users/user-1/avatar.webp',
    );
  });

  it('accepts allowed mime types under size limit', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp'] as const) {
      const result = validateUserAvatarFile(mimeType, 1024);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toBe(mimeType);
    }
  });

  it('rejects disallowed mime types', () => {
    const result = validateUserAvatarFile('image/gif', 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JPEG, PNG oder WebP/);
    }
  });

  it('rejects files over 5 MB', () => {
    const result = validateUserAvatarFile('image/png', USER_AVATAR_MAX_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5 MB/);
    }
  });

  it('rejects empty files', () => {
    const result = validateUserAvatarFile('image/jpeg', 0);
    expect(result.ok).toBe(false);
  });

  it('maps missing bucket errors to migration hint', () => {
    expect(toUserAvatarUploadError('Bucket not found')).toMatch(/0088/);
    expect(toUserAvatarUploadError('new row violates row-level security policy')).toMatch(/Berechtigung/);
  });
});
