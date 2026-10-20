import { describe, expect, it } from 'vitest';
import { auditPublicAccessRoutes, inspectPublicAccessRoutes } from '../../../scripts/audit-public-access-routes.mjs';

const routes = ['./_layout.tsx', './index.tsx', './auth/forgot-password.tsx', './auth/reset-password.tsx', './support/index.tsx', './support/index.web.tsx'];

describe('public access route resolution with the installed Expo router', () => {
  it('reproduces the export failure when flat and index support routes coexist', () => {
    expect(() => inspectPublicAccessRoutes([...routes, './support.tsx', './support.web.tsx']))
      .toThrow(/Found conflicting screens with the same pattern.*support/);
  });
  it('selects the existing web index route for anonymous support', () => {
    expect(inspectPublicAccessRoutes(routes).find(route => route.url === '/support'))
      .toEqual({ url: '/support', filePath: 'support/index.html', contextKey: './support/index.web.tsx' });
  });
  it('preserves the native support route', () => {
    expect(inspectPublicAccessRoutes(routes, 'android').find(route => route.url === '/support')?.contextKey)
      .toBe('./support/index.tsx');
  });
  it('exports both administration recovery URLs at their existing paths', () => {
    expect(inspectPublicAccessRoutes(routes).filter(route => route.url.startsWith('/auth/')).map(route => route.filePath))
      .toEqual(['auth/forgot-password.html', 'auth/reset-password.html']);
  });
  it('resolves the actual application public routes without conflicts', () => {
    expect(auditPublicAccessRoutes()).toEqual(inspectPublicAccessRoutes(routes));
  });
});
