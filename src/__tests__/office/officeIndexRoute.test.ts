import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const state = vi.hoisted(() => ({ params: {} as Record<string, string | string[]> }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => state.params,
  useRouter: () => ({ replace: vi.fn() }),
  Redirect: ({ href }: { href: string }) => React.createElement('a', { href }, 'Weiterleitung'),
}));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({
  LiquidState: ({ title, message }: { title: string; message: string }) => React.createElement('section', null, title, message),
}));
// The actual wrappers select these receiving route functions. Their auth and
// scene lifecycle have separate focused tests; this suite executes URL targets.
vi.mock('@/components/navigation/NativeWorkflowPage.native', () => ({ withNativeWorkflowPage: (Page: React.ComponentType) => Page }));
import NativeOfficeRoute from '../../../app/office/index.native';
import NativeDashboardAlias from '../../../app/business/office/dashboard.native';

const render = (Page: React.ComponentType) => renderToStaticMarkup(React.createElement(Page));
beforeEach(() => { state.params = {}; });

describe('actual Android Office entry destinations', () => {
  it.each([NativeOfficeRoute, NativeDashboardAlias])('opens the actual company workspace for an unqualified saved Office entry', (Page) => {
    expect(render(Page)).toContain('href="/unternehmen"');
  });
  it.each([NativeOfficeRoute, NativeDashboardAlias])('preserves the requested Office area, record and repeated query values', (Page) => {
    state.params = { area: 'clients', id: 'record/a &?', keep: ['one', 'two'] };
    const html = render(Page);
    expect(html).toContain('href="/business/office/clients?id=record%2Fa+%26%3F&amp;keep=one&amp;keep=two"');
    expect(html).not.toContain('/unternehmen');
  });
  it('does not silently replace an unknown Office area with the company page', () => {
    state.params = { area: 'unknown' };
    const html = render(NativeOfficeRoute);
    expect(html).toContain('Office-Arbeitsbereich nicht gefunden');
    expect(html).not.toContain('<a');
  });
  it('has no competing tab index for the same Office URL', () => {
    expect(existsSync(path.join(root, 'app/office/(tabs)/index.tsx'))).toBe(false);
    expect(existsSync(path.join(root, 'app/assist/(tabs)/index.tsx'))).toBe(false);
  });
  it('keeps upload and Assist receivers separate from these saved Office aliases', () => {
    expect(readFileSync(path.join(root, 'app/office/documents/upload.tsx'), 'utf8')).toContain('OfficeDocumentUploadScreen');
    expect(readFileSync(path.join(root, 'app/assist/index.tsx'), 'utf8')).toContain('moduleKey="assist"');
  });
});
