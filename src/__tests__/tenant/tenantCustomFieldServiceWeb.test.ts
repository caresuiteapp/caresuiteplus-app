import { beforeEach, expect, it, vi } from 'vitest';
import { createCustomFieldDraft } from '@/lib/tenant/tenantCustomFieldEditor';
import { fetchTenantCustomFieldDefinitions, resetTenantCustomFieldStore, saveTenantCustomFieldDefinition } from '@/lib/tenant/tenantCustomFieldService';

const environment = vi.hoisted(() => ({ os: 'web' }));
vi.mock('react-native', () => ({ Platform: { get OS() { return environment.os; } } }));
beforeEach(() => { environment.os = 'web'; resetTenantCustomFieldStore(); });
const field = () => ({ ...createCustomFieldDraft().definition, fieldKey: 'internal_reference', label: 'Aktenzeichen' });

it('rejects missing tenant context before writing custom fields on web', async () => {
  const result = await saveTenantCustomFieldDefinition('', field(), 'business_admin');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('Mandanten');
});

it('preserves native role permissions for creating and editing definitions', async () => {
  environment.os = 'android';
  const result = await saveTenantCustomFieldDefinition('tenant-a', field(), 'employee_portal');
  expect(result.ok).toBe(false);
  const visible = await fetchTenantCustomFieldDefinitions('tenant-a', 'business_admin');
  expect(visible).toEqual({ ok: true, data: [] });
});

it('preserves native demo stores and isolates companies', async () => {
  environment.os = 'android';
  const created = await saveTenantCustomFieldDefinition('tenant-a', field(), 'business_admin');
  if (!created.ok) throw new Error(created.error);
  const saved = await saveTenantCustomFieldDefinition('tenant-a', { ...created.data[0], label: 'Internes Aktenzeichen', visibility: { office: true, portal: true }, validation: { required: true } }, 'business_admin');
  expect(saved).toEqual({ ok: true, data: [expect.objectContaining({ id: created.data[0].id, label: 'Internes Aktenzeichen', visibility: { office: true, portal: true }, validation: { required: true } })] });
  expect(await fetchTenantCustomFieldDefinitions('tenant-b', 'business_admin')).toEqual({ ok: true, data: [] });
});

it('does not create Web demo fields when the live service is absent', async () => { expect((await saveTenantCustomFieldDefinition('tenant-a', field(), 'business_admin')).ok).toBe(false); expect((await fetchTenantCustomFieldDefinitions('tenant-a', 'business_admin')).ok).toBe(false); });
