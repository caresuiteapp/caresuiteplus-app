import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolutionContext } from 'metro-resolver';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));

const require = createRequire(import.meta.url);
const { resolve } = require('metro-resolver');
const config = require('../../../metro.config.js');
const root = path.resolve(__dirname, '../../..');
const request = '@/lib/clients/repositories/clientIntakeDraftRepository.supabase';
const consumers = [
  'src/hooks/useClientIntakeWizard.ts',
  'src/components/office/DeleteIntakeDraftButton.web.tsx',
  'src/components/office/ClientFirstContact.web.tsx',
];

// Vitest normally resolves .ts first. Ask the installed Metro resolver to choose
// the browser module, so a stale .web.ts override cannot evade release checks.
function webRepository(consumer: string): string {
  const context: ResolutionContext = {
    ...config.resolver,
    originModulePath: path.join(root, consumer),
    assetExts: new Set(config.resolver.assetExts),
    mainFields: config.resolver.resolverMainFields,
    preferNativePlatform: false,
    allowHaste: false,
    dev: false,
    customResolverOptions: {},
    nodeModulesPaths: [],
    redirectModulePath: value => value,
    resolveAsset: () => null,
    resolveHasteModule: () => null,
    resolveHastePackage: () => null,
    getPackage: file => JSON.parse(readFileSync(file, 'utf8')),
    getPackageForModule: () => null,
    doesFileExist: file => { try { return statSync(file).isFile(); } catch { return false; } },
    fileSystemLookup: file => {
      try { return { exists: true, type: statSync(file).isDirectory() ? 'd' : 'f', realPath: realpathSync(file) }; }
      catch { return { exists: false }; }
    },
    resolveRequest: resolve,
  };
  const result = config.resolver.resolveRequest(context, path.join(root, 'src', request.slice(2)), 'web');
  expect(result.type).toBe('sourceFile');
  return result.filePath;
}

const api: typeof import('@/lib/clients/repositories/clientIntakeDraftRepository.supabase') =
  await import(webRepository(consumers[0]));
const tenantId = '11111111-1111-4111-8111-111111111111';
const clientId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const receipt = { contract: 'client-intake-draft-v1', clientId, operationId, revision: 5,
  formHash: `sha256:${'a'.repeat(64)}`, status: 'draft', replayed: false };
beforeEach(() => { mocks.rpc.mockReset(); });

describe('production Web intake repository resolution', () => {
  it.each(consumers)('provides every imported runtime function to %s', async consumer => {
    const source = readFileSync(path.join(root, consumer), 'utf8');
    const declaration = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)]
      .find(match => match[2] === request);
    expect(declaration).toBeDefined();
    const exports = await import(webRepository(consumer));
    for (const name of declaration![1].split(',').map(value => value.trim()).filter(value => !value.startsWith('type '))) {
      expect(typeof exports[name], `${consumer}: ${name}`).toBe('function');
    }
  });

  it('loads an existing full draft and deletes only its confirmed revision', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...receipt, form: { ...EMPTY_CLIENT_INTAKE_FORM, firstName: 'Anna' }, updatedAt: '2026-10-21T19:00:00Z' }, error: null });
    const loaded = await api.loadServerClientIntakeDraft(tenantId, clientId);
    expect(loaded).toMatchObject({ ok: true, data: { clientId, revision: 5, form: { firstName: 'Anna' } } });
    expect(mocks.rpc).toHaveBeenLastCalledWith('client_intake_load_draft', { p_tenant: tenantId, p_client: clientId });
    if (!loaded.ok || !loaded.data) throw new Error('Draft did not load');
    mocks.rpc.mockResolvedValueOnce({ data: { contract: 'client-intake-delete-v1', clientId, deleted: true }, error: null });
    expect((await api.deleteClientIntakeDraft(tenantId, clientId, loaded.data.revision)).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenLastCalledWith('client_intake_delete_draft', { p_tenant: tenantId, p_client: clientId, p_expected_revision: 5 });
  });

  it('saves through the revisioned full-form RPC instead of the prepared care writer', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: receipt, error: null });
    expect((await api.upsertClientIntakeDraft(tenantId, EMPTY_CLIENT_INTAKE_FORM, { clientId, operationId, expectedRevision: 4 })).ok).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith('client_intake_save_draft', {
      p_tenant: tenantId, p_client: clientId, p_form: EMPTY_CLIENT_INTAKE_FORM, p_expected_revision: 4, p_operation_id: operationId,
    });
  });

  it('keeps a changed draft when deletion reports a revision conflict', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'changed' } });
    expect(await api.deleteClientIntakeDraft(tenantId, clientId, 5)).toMatchObject({ ok: false, error: expect.stringContaining('inzwischen geändert') });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
