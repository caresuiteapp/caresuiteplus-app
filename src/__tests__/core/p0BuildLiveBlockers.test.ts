import { describe, expect, it, vi, afterEach } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { buildTenantStoragePath } from '@/lib/storage/storagePaths';
import { guardLiveDemoFeature, guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

const root = path.join(__dirname, '..', '..', '..');

const ASSET_MIN = {
  'assets/icon.png': 500,
  'assets/favicon.png': 500,
  'assets/splash-icon.png': 500,
};

describe('P0 Build/Live Blockers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('store assets exist with minimum size', () => {
    for (const [rel, minBytes] of Object.entries(ASSET_MIN)) {
      const file = path.join(root, rel);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeGreaterThanOrEqual(minBytes);
    }
  });

  it('upload storage path includes tenant_id', () => {
    const tenantId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const storagePath = buildTenantStoragePath(tenantId, 'office', 'documents', 'doc-1', 'test.pdf');
    expect(storagePath).toContain(`tenant/${tenantId}/`);
    expect(storagePath).toContain('office/documents');
  });

  it('guardServiceTenant allows live tenant uuid', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    expect(guardServiceTenant('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBeNull();
  });

  it('guardServiceTenant rejects wrong tenant in demo mode', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    expect(guardServiceTenant('wrong-tenant')).not.toBeNull();
    expect(guardServiceTenant(DEMO_TENANT_ID)).toBeNull();
  });

  it('guardLiveDemoFeature blocks demo-only features in live mode', () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'false');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    const blocked = guardLiveDemoFeature('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'SIS-Bewertungen');
    expect(blocked?.ok).toBe(false);
    if (blocked && !blocked.ok) {
      expect(blocked.error).toContain('Live-Modus');
    }
  });

  it('pflege module service uses fetchDomainModuleSnapshot without DEMO_TENANT_ID guard', () => {
    const source = readFileSync(
      path.join(root, 'src/lib/pflege/pflegeModuleService.ts'),
      'utf8',
    );
    expect(source).toContain('fetchDomainModuleSnapshot');
    expect(source).toContain('pflegeSupabaseRepository');
    expect(source).not.toMatch(/DEMO_TENANT_ID/);
  });

  it('office upload screen uses expo-document-picker', () => {
    const source = readFileSync(
      path.join(root, 'src/screens/office/OfficeDocumentUploadScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('expo-document-picker');
    expect(source).toContain('getDocumentAsync');
  });

  it('officeDocumentsService rejects empty live upload', () => {
    const source = readFileSync(
      path.join(root, 'src/lib/office/officeDocumentsService.ts'),
      'utf8',
    );
    expect(source).toContain('sizeBytes <= 0');
    expect(source).toContain('contentBase64');
    expect(source).toContain("'office', 'documents'");
    expect(source).toContain('buildStorageObjectFileName');
  });
});
