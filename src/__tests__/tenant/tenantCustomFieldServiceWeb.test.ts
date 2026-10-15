import { beforeEach, expect, it } from 'vitest';
import { createCustomFieldDraft } from '@/lib/tenant/tenantCustomFieldEditor';
import { fetchTenantCustomFieldDefinitions, resetTenantCustomFieldStore, saveTenantCustomFieldDefinition } from '@/lib/tenant/tenantCustomFieldService';

beforeEach(() => resetTenantCustomFieldStore());
const field = () => ({ ...createCustomFieldDraft().definition, fieldKey: 'internal_reference', label: 'Aktenzeichen' });

it('rejects missing tenant context before writing custom fields on web', async () => {
  const result = await saveTenantCustomFieldDefinition('', field(), 'business_admin');
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toContain('Mandanten');
});

it('requires the company management permission for creating and editing definitions', async () => {
  const result = await saveTenantCustomFieldDefinition('tenant-a', field(), 'employee_portal');
  expect(result.ok).toBe(false);
  const visible = await fetchTenantCustomFieldDefinitions('tenant-a', 'business_admin');
  expect(visible).toEqual({ ok: true, data: [] });
});

it('updates the existing definition and keeps company stores isolated', async () => {
  const created = await saveTenantCustomFieldDefinition('tenant-a', field(), 'business_admin');
  if (!created.ok) throw new Error(created.error);
  const saved = await saveTenantCustomFieldDefinition('tenant-a', { ...created.data[0], label: 'Internes Aktenzeichen', visibility: { office: true, portal: true }, validation: { required: true } }, 'business_admin');
  expect(saved).toEqual({ ok: true, data: [expect.objectContaining({ id: created.data[0].id, label: 'Internes Aktenzeichen', visibility: { office: true, portal: true }, validation: { required: true } })] });
  expect(await fetchTenantCustomFieldDefinitions('tenant-b', 'business_admin')).toEqual({ ok: true, data: [] });
});
