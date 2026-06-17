import { describe, expect, it } from 'vitest';
import {
  buildTenantLogoStoragePath,
  TENANT_LOGO_MAX_BYTES,
  validateTenantLogoFile,
} from '@/lib/tenant/tenantLogoService';

describe('tenant logo service', () => {
  it('builds tenant-isolated storage path', () => {
    expect(buildTenantLogoStoragePath('tenant-1', 'image/jpeg')).toBe(
      'tenant/tenant-1/logo.jpg',
    );
    expect(buildTenantLogoStoragePath('tenant-1', 'image/png')).toBe(
      'tenant/tenant-1/logo.png',
    );
    expect(buildTenantLogoStoragePath('tenant-1', 'image/webp')).toBe(
      'tenant/tenant-1/logo.webp',
    );
    expect(buildTenantLogoStoragePath('tenant-1', 'image/svg+xml')).toBe(
      'tenant/tenant-1/logo.svg',
    );
  });

  it('accepts allowed mime types under size limit', () => {
    for (const mimeType of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ] as const) {
      const result = validateTenantLogoFile(mimeType, 1024);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toBe(mimeType);
    }
  });

  it('rejects disallowed mime types', () => {
    const result = validateTenantLogoFile('image/gif', 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/JPEG, PNG, SVG oder WebP/);
    }
  });

  it('rejects files over 5 MB', () => {
    const result = validateTenantLogoFile('image/png', TENANT_LOGO_MAX_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/5 MB/);
    }
  });

  it('rejects empty files', () => {
    const result = validateTenantLogoFile('image/jpeg', 0);
    expect(result.ok).toBe(false);
  });
});
