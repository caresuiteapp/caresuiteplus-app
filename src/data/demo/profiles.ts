import type { Profile, RoleKey } from '@/types';
import { DEMO_TENANT_ID } from './tenant';

const BASE = '2025-01-15T08:00:00.000Z';
const UPDATED = '2026-06-01T10:00:00.000Z';

type DemoProfileSeed = Profile & { roleKey: RoleKey };

/** Ein Demo-Profil je Rolle — für Login-Tests und Berechtigungsprüfung (WP 009/011) */
export const demoProfiles: DemoProfileSeed[] = [
  {
    id: 'profile-admin-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-001',
    roleKey: 'business_admin',
    displayName: 'Sabine Muster',
    email: 'admin@demo.caresuiteplus.app',
    phone: '+49 30 12345679',
    avatarUrl: null,
    createdAt: BASE,
    updatedAt: UPDATED,
  },
  {
    id: 'profile-manager-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-002',
    roleKey: 'business_manager',
    displayName: 'Jens Hartmann',
    email: 'jens.hartmann@demo.caresuiteplus.app',
    phone: '+49 30 12345680',
    avatarUrl: null,
    createdAt: '2025-02-01T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-billing-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-003',
    roleKey: 'billing',
    displayName: 'Petra Lehmann',
    email: 'petra.lehmann@demo.caresuiteplus.app',
    phone: '+49 30 12345681',
    avatarUrl: null,
    createdAt: '2025-02-15T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-dispatch-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-004',
    roleKey: 'dispatch',
    displayName: 'Markus Vogel',
    email: 'markus.vogel@demo.caresuiteplus.app',
    phone: '+49 30 12345682',
    avatarUrl: null,
    createdAt: '2025-03-01T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-nurse-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-005',
    roleKey: 'nurse',
    displayName: 'Dr. Anna Krüger',
    email: 'anna.krueger@demo.caresuiteplus.app',
    phone: '+49 170 2345678',
    avatarUrl: null,
    createdAt: '2025-03-15T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-employee-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-006',
    roleKey: 'caregiver',
    displayName: 'Thomas Keller',
    email: 'thomas.keller@demo.caresuiteplus.app',
    phone: '+49 170 1234567',
    avatarUrl: null,
    createdAt: '2025-04-01T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-counselor-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-007',
    roleKey: 'counselor',
    displayName: 'Lisa Brandt',
    email: 'lisa.brandt@demo.caresuiteplus.app',
    phone: '+49 30 12345683',
    avatarUrl: null,
    createdAt: '2025-04-15T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-akademie-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-008',
    roleKey: 'akademie_admin',
    displayName: 'Ralf Stein',
    email: 'ralf.stein@demo.caresuiteplus.app',
    phone: '+49 30 12345684',
    avatarUrl: null,
    createdAt: '2025-05-01T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-portal-employee-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-009',
    roleKey: 'employee_portal',
    displayName: 'Sandra Meier',
    email: 'sandra.meier@demo.caresuiteplus.app',
    phone: '+49 170 3456789',
    avatarUrl: null,
    createdAt: '2025-05-15T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-client-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-010',
    roleKey: 'client_portal',
    displayName: 'Helga Schneider',
    email: 'helga.schneider@demo.caresuiteplus.app',
    phone: '+49 30 98765432',
    avatarUrl: null,
    createdAt: '2025-06-01T08:00:00.000Z',
    updatedAt: UPDATED,
  },
  {
    id: 'profile-family-001',
    tenantId: DEMO_TENANT_ID,
    roleId: 'role-011',
    roleKey: 'family_portal',
    displayName: 'Karin Schneider',
    email: 'karin.schneider@demo.caresuiteplus.app',
    phone: '+49 170 4567890',
    avatarUrl: null,
    createdAt: '2025-06-15T08:00:00.000Z',
    updatedAt: UPDATED,
  },
];

export function getDemoProfileForRole(roleKey: RoleKey): Profile {
  const profile = demoProfiles.find((p) => p.roleKey === roleKey);
  if (!profile) {
    return demoProfiles[0];
  }
  return profile;
}
