import { describe, expect, it } from 'vitest';
import { isLightPortalRoutePath } from '@/lib/navigation/isPortalRoute';

describe('light portal chrome', () => {
  it.each([
    '/portal/client',
    '/portal/client/',
    '/portal/client/messages/thread?origin=push',
    '/portal/employee',
    '/portal/employee/assignments/visit/execute',
  ])('keeps dark status symbols on the light portal at %s', (path) => {
    expect(isLightPortalRoutePath(path)).toBe(true);
  });

  it.each(['/portal', '/portal/family', '/portal/client-other', '/office', '/auth/client-login'])('preserves the theme of other surfaces at %s', (path) => {
    expect(isLightPortalRoutePath(path)).toBe(false);
  });
});
