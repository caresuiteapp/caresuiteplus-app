import { describe, expect, it } from 'vitest';
import {
  buildEmployeeAvatarStoragePath,
  EMPLOYEE_AVATAR_MAX_BYTES,
  mapEmployeeAvatarUrl,
  validateEmployeeAvatarFile,
} from '@/lib/office/employeeAvatarService';

describe('employee avatar service', () => {
  it('builds tenant-isolated storage path', () => {
    expect(
      buildEmployeeAvatarStoragePath('tenant-1', 'emp-1', 'image/jpeg'),
    ).toBe('tenant/tenant-1/employees/emp-1/avatar.jpg');
    expect(
      buildEmployeeAvatarStoragePath('tenant-1', 'emp-1', 'image/webp'),
    ).toBe('tenant/tenant-1/employees/emp-1/avatar.webp');
  });

  it('maps avatar_url preferring stored column value', () => {
    expect(mapEmployeeAvatarUrl('https://cdn.example/avatar.jpg')).toBe(
      'https://cdn.example/avatar.jpg',
    );
    expect(mapEmployeeAvatarUrl('  ', 'tenant/x/employees/y/avatar.png')).toBeNull();
    expect(mapEmployeeAvatarUrl(null)).toBeNull();
  });

  it('accepts allowed mime types under size limit', () => {
    for (const mimeType of ['image/jpeg', 'image/png', 'image/webp'] as const) {
      const result = validateEmployeeAvatarFile(mimeType, 1024);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toBe(mimeType);
    }
  });

  it('rejects disallowed mime types', () => {
    const result = validateEmployeeAvatarFile('image/gif', 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JPEG, PNG oder WebP/);
    }
  });

  it('rejects files over 5 MB', () => {
    const result = validateEmployeeAvatarFile('image/png', EMPLOYEE_AVATAR_MAX_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5 MB/);
    }
  });

  it('rejects empty files', () => {
    const result = validateEmployeeAvatarFile('image/jpeg', 0);
    expect(result.ok).toBe(false);
  });
});
