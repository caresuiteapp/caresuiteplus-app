import { describe, expect, it } from 'vitest';
import { checkRoleAccess } from '@/lib/navigation/redirects';

describe('checkRoleAccess portal guards', () => {
  it('allows client_portal on /portal/client', () => {
    const decision = checkRoleAccess('/portal/client', 'client_portal');
    expect(decision.shouldRedirect).toBe(false);
  });

  it('redirects wrong roles to their home route instead of public start', () => {
    const decision = checkRoleAccess('/portal/client', 'business_admin');
    expect(decision.shouldRedirect).toBe(true);
    expect(decision.target).not.toBe('/');
  });
});
