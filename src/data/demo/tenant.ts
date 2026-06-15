import type { Tenant, TenantAddress, TenantContact, TenantSubscription } from '@/types';

export const DEMO_TENANT_ID = 'tenant-demo-001';

export const demoTenant: Tenant = {
  id: DEMO_TENANT_ID,
  name: 'CareSuite+ Demo',
  slug: 'demo',
  legalForm: 'GmbH',
  industry: 'Ambulanter Pflegedienst',
  phone: '+49 30 12345678',
  email: 'kontakt@demo.caresuiteplus.app',
  website: 'https://demo.caresuiteplus.app',
  createdAt: '2025-01-15T08:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

export const demoTenantAddress: TenantAddress = {
  id: 'addr-demo-001',
  tenantId: DEMO_TENANT_ID,
  street: 'Musterstraße 12',
  zip: '10115',
  city: 'Berlin',
  state: 'Berlin',
  country: 'Deutschland',
  createdAt: '2025-01-15T08:00:00.000Z',
};

export const demoTenantContact: TenantContact = {
  id: 'contact-demo-001',
  tenantId: DEMO_TENANT_ID,
  firstName: 'Sabine',
  lastName: 'Muster',
  role: 'Geschäftsführung',
  phone: '+49 30 12345679',
  email: 'sabine.muster@demo.caresuiteplus.app',
  isPrimary: true,
  createdAt: '2025-01-15T08:00:00.000Z',
};

export const demoTenantSubscription: TenantSubscription = {
  id: 'sub-demo-001',
  tenantId: DEMO_TENANT_ID,
  status: 'trialing',
  planKey: 'pflege_pro',
  trialEndsAt: '2026-09-01T00:00:00.000Z',
  currentPeriodStart: '2026-03-01T00:00:00.000Z',
  currentPeriodEnd: '2026-04-01T00:00:00.000Z',
  createdAt: '2025-01-15T08:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};
