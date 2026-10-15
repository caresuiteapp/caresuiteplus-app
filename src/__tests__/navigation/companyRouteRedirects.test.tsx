import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeIndexRoute from '../../../app/office/index.web';
import OfficeDashboardRedirect from '../../../app/business/office/dashboard.web';
import NativeCompanyRoute from '../../../app/unternehmen';
import LegacyLiquidOfficeRoute from '../../../app/liquid-command/office/index.web';

const state = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => state.params,
  Redirect: ({ href }: { href: string | { pathname: string; params: Record<string, string> } }) => (
    <a href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.params)}`}>Weiterleitung</a>
  ),
}));
vi.mock('@/liquid-command/screens/ModuleWorkspaceScreen', () => ({
  ModuleWorkspaceScreen: ({ moduleKey }: { moduleKey: string }) => <span>{moduleKey}:{state.params.area}</span>,
}));

beforeEach(() => { state.params = {}; });

describe('company route compatibility', () => {
  it.each([undefined, 'company'])('redirects the previous Office entry with area %s to Unternehmen', (area) => {
    state.params = area ? { area, record: 'saved-company' } : { record: 'saved-company' };
    expect(renderToStaticMarkup(<OfficeIndexRoute />)).toContain('href="/unternehmen?record=saved-company"');
    expect(state.params.record).toBe('saved-company');
  });

  it.each(['people', 'clients', 'documents'])('keeps the %s Office work area reachable', (area) => {
    state.params = { area };
    expect(renderToStaticMarkup(<OfficeIndexRoute />)).toBe(`<span>office:${area}</span>`);
  });

  it('redirects the retired dashboard directly to Unternehmen', () => {
    expect(renderToStaticMarkup(<OfficeDashboardRedirect />)).toContain('href="/unternehmen"');
  });

  it('keeps the native fallback on the existing Office route', () => {
    expect(renderToStaticMarkup(<NativeCompanyRoute />)).toContain('href="/office"');
  });

  it('keeps legacy Liquid Office links on the canonical company screen', () => {
    state.params = { area: 'company' };
    expect(renderToStaticMarkup(<LegacyLiquidOfficeRoute />)).toContain('href="/unternehmen');
    state.params = { area: 'people' };
    expect(renderToStaticMarkup(<LegacyLiquidOfficeRoute />)).toBe('<span>office:people</span>');
  });
});
