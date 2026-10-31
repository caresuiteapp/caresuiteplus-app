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

it('blocks native reads and writes without a live company grant even for an admin role', async () => {
  environment.os = 'android';
  const result = await saveTenantCustomFieldDefinition('tenant-a', field(), 'employee_portal');
  expect(result.ok).toBe(false);
  const visible = await fetchTenantCustomFieldDefinitions('tenant-a', 'business_admin');
  expect(visible).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenverbindung') });
});

it('does not create native company demo fields in either tenant', async () => {
  environment.os = 'android';
  const created = await saveTenantCustomFieldDefinition('tenant-a', field(), 'business_admin');
  expect(created).toMatchObject({ ok: false, error: expect.stringContaining('aktive Datenverbindung') });
  expect((await fetchTenantCustomFieldDefinitions('tenant-a', 'business_admin')).ok).toBe(false);
  expect((await fetchTenantCustomFieldDefinitions('tenant-b', 'business_admin')).ok).toBe(false);
});

it('does not create Web demo fields when the live service is absent', async () => { expect((await saveTenantCustomFieldDefinition('tenant-a', field(), 'business_admin')).ok).toBe(false); expect((await fetchTenantCustomFieldDefinitions('tenant-a', 'business_admin')).ok).toBe(false); });
