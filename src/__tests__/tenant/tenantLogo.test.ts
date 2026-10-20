import { describe, expect, it } from 'vitest';
import {
  buildTenantLogoStoragePath,
  EMPTY_TENANT_LOGO,
  hasTenantLogoChanges,
  resolveTenantLogoUrlForSave,
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

describe('hasTenantLogoChanges', () => {
  it('detects pending uploads and removals', () => {
    expect(hasTenantLogoChanges(EMPTY_TENANT_LOGO, '')).toBe(false);
    expect(
      hasTenantLogoChanges(
        {
          ...EMPTY_TENANT_LOGO,
          pending: {
            localUri: 'blob:test',
            fileName: 'logo.png',
            mimeType: 'image/png',
            sizeBytes: 1,
            contentBase64: 'a',
          },
        },
        '',
      ),
    ).toBe(true);
    expect(
      hasTenantLogoChanges({ ...EMPTY_TENANT_LOGO, removed: true }, 'https://example.com/logo.png'),
    ).toBe(true);
    expect(
      hasTenantLogoChanges({ ...EMPTY_TENANT_LOGO, removed: true }, ''),
    ).toBe(false);
  });
});

describe('resolveTenantLogoUrlForSave', () => {
  it('rejects display changes without pending upload payload', async () => {
    const result = await resolveTenantLogoUrlForSave(
      'tenant-1',
      { ...EMPTY_TENANT_LOGO, displayUri: 'blob:new-logo' },
      '',
      true,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/nicht bereit/);
    }
  });

  it('returns local uri in demo mode for pending uploads', async () => {
    const result = await resolveTenantLogoUrlForSave(
      'tenant-1',
      {
        displayUri: 'blob:demo-logo',
        pending: {
          localUri: 'blob:demo-logo',
          fileName: 'logo.png',
          mimeType: 'image/png',
          sizeBytes: 1,
          contentBase64: 'a',
        },
        removed: false,
      },
      '',
      false,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('blob:demo-logo');
    }
  });
});
