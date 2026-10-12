import { expect, it } from 'vitest';
import { resolvePortalDocumentSignerRole } from '@/lib/portal/portalDocumentSignatureHelpers';
it('uses the representative role for a family member even when the client role is also pending', () => {
  expect(resolvePortalDocumentSignerRole({ mode: 'client', roleKey: 'family_portal', pendingRoles: ['client', 'representative'], defaultRole: 'client' })).toBe('representative');
});
it('keeps a client signature and allows an explicitly requested representative signature', () => {
  expect(resolvePortalDocumentSignerRole({ mode: 'client', roleKey: 'client_portal', pendingRoles: ['client', 'representative'], defaultRole: 'client' })).toBe('client');
  expect(resolvePortalDocumentSignerRole({ mode: 'client', roleKey: 'client_portal', pendingRoles: ['representative'], defaultRole: 'client' })).toBe('representative');
  expect(resolvePortalDocumentSignerRole({ mode: 'employee', roleKey: 'employee_portal', pendingRoles: ['representative', 'employee'], defaultRole: 'employee' })).toBe('employee');
});
