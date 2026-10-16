import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchTenantDocumentSettings, saveTenantDocumentSettings } from '@/lib/documents/tenantDocumentSettingsService.web';
import type { TenantDocumentSettingsForm } from '@/types/documents/tenantDocumentSettings';

const h = vi.hoisted(() => ({
  configured: true, deniedTenant: false,
  row: null as Record<string, unknown> | null,
  error: null as { message: string; code: string } | null,
  from: vi.fn(), eq: vi.fn(), upsert: vi.fn(),
}));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
vi.mock('@/lib/services/liveServiceGuard', () => ({
  guardServiceTenant: () => h.deniedTenant ? { ok: false, error: 'Kein Zugriff auf diesen Mandanten.' } : null,
}));
vi.mock('@/lib/supabase/client', () => ({
  getSupabaseClient: () => {
    if (!h.configured) return null;
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => { h.eq(...args); return query; },
      upsert: (row: Record<string, unknown>, options: unknown) => {
        h.upsert(row, options);
        if (!h.error) h.row = { ...row, id: 'saved-settings' };
        return query;
      },
      maybeSingle: async () => ({ data: h.row, error: h.error }),
      single: async () => ({ data: h.error ? null : h.row, error: h.error }),
    };
    return { from: (...args: unknown[]) => { h.from(...args); return query; } };
  },
}));

beforeEach(() => {
  vi.clearAllMocks(); h.configured = true; h.deniedTenant = false; h.row = null; h.error = null;
});

async function initialForm(): Promise<TenantDocumentSettingsForm> {
  const result = await fetchTenantDocumentSettings('tenant-one', 'business_admin');
  if (!result.ok) throw new Error(result.error);
  const { id, tenantId, updatedAt, ...form } = result.data;
  return form;
}

describe('Web document settings persistence', () => {
  it('reads one tenant and gives missing settings neutral defaults without writing or fabricating business data', async () => {
    const result = await fetchTenantDocumentSettings('tenant-one', 'business_admin');
    expect(h.from).toHaveBeenCalledWith('tenant_document_settings');
    expect(h.eq).toHaveBeenCalledWith('tenant_id', 'tenant-one');
    expect(h.upsert).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe('');
    expect(result.data.updatedAt).toBe('');
    expect(result.data.bankName).toBe('');
    expect(result.data.iban).toBe('');
    expect(result.data.bic).toBe('');
    expect(result.data.defaultTaxNotice).toBe('');
    expect(result.data.defaultContractClauses).toBe('');
    expect(result.data.headerLayout.contactPersonName).toBe('');
    expect(result.data.headerLayout.contactPersonEmail).toBe('');
    expect(result.data.logoUrl).toBeNull();
  });

  it('persists and reloads all form fields using the existing schema, including nested layout settings', async () => {
    const form = await initialForm();
    form.logoUrl = 'https://example.org/company.svg';
    form.logoWidthMm = 72;
    form.logoNaturalWidthPx = 900;
    form.logoNaturalHeightPx = 300;
    form.bankName = 'Eigene Bank';
    form.iban = 'DE22123456789012345678';
    form.bic = 'TESTDEFFXXX';
    form.primaryColor = '#123456';
    form.headerLayout.contactPersonName = 'Kontakt';
    form.pageLayout.marginLeftMm = 18;
    form.pageLayout.baseFontSizePt = 12;
    form.footerLayout.byDocumentType.contract = { enabled: true, showBankDetails: true, bankRequired: false, showMandatoryDisclosures: true, customText: 'Eigene Fußzeile' };
    form.ciEnforcementEnabled = false;
    const saved = await saveTenantDocumentSettings('tenant-one', form, 'business_admin');
    expect(saved.ok).toBe(true);
    expect(h.upsert).toHaveBeenCalledWith(expect.objectContaining({ tenant_id: 'tenant-one', bank_name: 'Eigene Bank', default_page_margin_left_mm: 18 }), { onConflict: 'tenant_id', defaultToNull: false });
    const payload = h.upsert.mock.calls[0][0];
    expect(payload).not.toHaveProperty('id');
    expect(payload).not.toHaveProperty('logo_width_mm');
    expect(payload.header_layout.documentLayout.logoWidthMm).toBe(72);
    const reloaded = await fetchTenantDocumentSettings('tenant-one', 'business_admin');
    if (!reloaded.ok) throw new Error(reloaded.error);
    expect(reloaded.data).toMatchObject({ ...form, id: 'saved-settings', tenantId: 'tenant-one' });
  });

  it('does not convert database or permission failures into demo success', async () => {
    const form = await initialForm();
    h.error = { message: 'new row violates row-level security policy', code: '42501' };
    expect((await saveTenantDocumentSettings('tenant-one', form, 'business_admin')).ok).toBe(false);
    expect((await fetchTenantDocumentSettings('tenant-one', 'business_admin')).ok).toBe(false);
    h.configured = false;
    expect((await fetchTenantDocumentSettings('tenant-one', 'business_admin')).ok).toBe(false);
  });

  it('blocks denied roles and tenants before database access', async () => {
    expect((await fetchTenantDocumentSettings('tenant-one', 'client_portal')).ok).toBe(false);
    h.deniedTenant = true;
    expect((await fetchTenantDocumentSettings('foreign-tenant', 'business_admin')).ok).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });

  it('rejects invalid geometry and unsafe logo addresses before writing', async () => {
    const form = await initialForm();
    for (const patch of [{ logoWidthMm: Number.NaN }, { defaultPaymentTermsDays: -1 }, { logoUrl: 'javascript:alert(1)' }, { primaryColor: 'red; }' }]) {
      expect((await saveTenantDocumentSettings('tenant-one', { ...form, ...patch }, 'business_admin')).ok).toBe(false);
    }
    expect(h.upsert).not.toHaveBeenCalled();
  });
});
