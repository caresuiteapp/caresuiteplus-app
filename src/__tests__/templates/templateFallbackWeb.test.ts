import { beforeEach, describe, expect, it, vi } from 'vitest';
import { templateSupabaseRepository } from '@/lib/templates/templateRepository.supabase.web';
import { getCommunicationMessageTemplateDefaults } from '@/lib/templates/communicationTemplateDefaults';

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[], row: null as Record<string, unknown> | null,
  error: null as { code: string; message: string } | null,
  insert: vi.fn(), eq: vi.fn(), or: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => {
    const query = {
      select: () => query, is: () => query, order: () => query,
      eq: (...args: unknown[]) => { h.eq(...args); return query; },
      or: (...args: unknown[]) => { h.or(...args); return query; },
      insert: (row: Record<string, unknown>) => { h.insert(row); h.row = { ...row, id: 'saved-copy', created_at: '2026-10-15', updated_at: '2026-10-15' }; return query; },
      maybeSingle: async () => ({ data: h.row, error: h.error }),
      single: async () => ({ data: h.row, error: h.error }),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve({ data: h.rows, error: h.error }).then(resolve),
    };
    return { from: () => query };
  },
}));
beforeEach(() => { vi.clearAllMocks(); h.rows = []; h.row = null; h.error = null; });

describe('Web message template fallback detail and copies', () => {
  it('resolves the same built-in template in the list and detail', async () => {
    const list = await templateSupabaseRepository.list('tenant-one', { moduleKey: 'communication', templateType: 'message' });
    if (!list.ok) throw new Error(list.error);
    const first = list.data[0];
    const detail = await templateSupabaseRepository.getById('tenant-one', first.id);
    expect(detail).toEqual({ ok: true, data: first });
    expect(h.or).toHaveBeenCalledWith('tenant_id.is.null,tenant_id.eq.tenant-one');
  });

  it('copies the fallback content into a real tenant row and returns the persisted ID', async () => {
    const first = getCommunicationMessageTemplateDefaults()[0];
    const copy = await templateSupabaseRepository.duplicateSystemForTenant('tenant-one', first.id, 'profile-one');
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'tenant-one', scope: 'tenant', content: first.content, status: 'draft', created_by: 'profile-one' }));
    expect(copy.ok).toBe(true);
    if (copy.ok) expect(copy.data.id).toBe('saved-copy');
  });

  it('preserves existing non-message templates when adding missing message defaults', async () => {
    h.rows = [{ id: 'office-existing', tenant_id: 'tenant-one', scope: 'tenant', module_key: 'office', template_type: 'documentation_text', status: 'active', title: 'Eigener Text', content: 'Inhalt', sort_order: 1 }];
    const result = await templateSupabaseRepository.list('tenant-one');
    if (!result.ok) throw new Error(result.error);
    expect(result.data.some(item => item.id === 'office-existing')).toBe(true);
    expect(result.data.some(item => item.moduleKey === 'communication')).toBe(true);
  });

  it('prefers saved content and never masks authorization errors with fallback data', async () => {
    const first = getCommunicationMessageTemplateDefaults()[0];
    h.row = { id: first.id, scope: 'system', module_key: 'communication', template_type: 'message', status: 'active', title: 'Gespeichert', content: 'Geändert' };
    const result = await templateSupabaseRepository.getById('tenant-one', first.id);
    if (!result.ok) throw new Error(result.error);
    expect(result.data?.content).toBe('Geändert');
    h.error = { code: '42501', message: 'permission denied' };
    expect((await templateSupabaseRepository.getById('tenant-one', first.id)).ok).toBe(false);
    expect((await templateSupabaseRepository.duplicateSystemForTenant('tenant-one', first.id)).ok).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });
});
