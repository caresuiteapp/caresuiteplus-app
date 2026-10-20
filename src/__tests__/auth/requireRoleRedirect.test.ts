import { describe, expect, it } from 'vitest';
import { checkRoleAccess } from '@/lib/navigation/redirects';
import { resolveSessionHomeRoute } from '@/lib/navigation/sessionRouting';

describe('checkRoleAccess portal guards', () => {
  it('allows client_portal on /portal/client', () => {
    const decision = checkRoleAccess('/portal/client', 'client_portal');
    expect(decision.shouldRedirect).toBe(false);
  });

  it('redirects wrong roles directly to the web desktop', () => {
    const decision = checkRoleAccess('/portal/client', 'business_admin');
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.target).toBe('/Desktop');
  });

  it.each([
    '/portal/client',
    '/portal/client/appointments',
    '/portal/client/appointments/own-visit',
    '/portal/client/documents',
    '/portal/client/documents/own-document',
    '/portal/client/documents/signatures/own-signature',
    '/portal/client/messages',
    '/portal/client/messages/own-thread',
    '/portal/client/profile',
    '/portal/client/announcements',
    '/portal/client/proofs',
    '/portal/client/budget',
    '/portal/client/help',
    '/portal/client/live',
  ])('allows the family session destination %s without redirecting to itself', (path) => {
    expect(resolveSessionHomeRoute('family_portal')).toBe('/portal/client');
    expect(checkRoleAccess(path, 'family_portal').shouldRedirect).toBe(false);
    expect(checkRoleAccess(path, 'employee_portal').shouldRedirect).toBe(true);
    expect(checkRoleAccess(path, null).shouldRedirect).toBe(true);
  });
});
