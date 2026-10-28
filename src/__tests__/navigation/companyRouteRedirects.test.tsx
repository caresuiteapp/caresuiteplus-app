import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeIndexRoute from '../../../app/office/index.web';
import OfficeDashboardRedirect from '../../../app/business/office/dashboard.web';
import NativeCompanyRoute from '../../../app/unternehmen.native';
import LegacyLiquidOfficeRoute from '../../../app/liquid-command/office/index.web';

const state = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => state.params,
  useRouter: () => ({ replace: vi.fn() }),
  Redirect: ({ href }: { href: string | { pathname: string; params: Record<string, string> } }) => (
    <a href={typeof href === 'string' ? href : `${href.pathname}?${new URLSearchParams(href.params)}`}>Weiterleitung</a>
  ),
}));
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({ LiquidState: ({ title }: { title: string }) => <span>{title}</span> }));
vi.mock('@/components/navigation/NativeWorkflowPage.native', () => ({ withNativeWorkflowPage: (Page: import('react').ComponentType) => Page }));

vi.mock('@/liquid-command/screens/CompanyWorkspaceScreen.native', () => ({ CompanyWorkspaceScreen: () => <span>native-company</span> }));
vi.mock('@/liquid-command/shell/LiquidModuleRouteLayout', () => ({ LiquidModuleRouteLayout: ({ children }: { children: import('react').ReactNode }) => <main>{children}</main> }));
beforeEach(() => { state.params = {}; });

describe('company route compatibility', () => {
  it.each([undefined, 'company'])('redirects the previous Office entry with area %s to Unternehmen', (area) => {
    state.params = area ? { area, record: 'saved-company' } : { record: 'saved-company' };
    expect(renderToStaticMarkup(<OfficeIndexRoute />)).toContain('href="/unternehmen?record=saved-company"');
    expect(state.params.record).toBe('saved-company');
  });

  it.each([['people', '/business/office/employees'], ['clients', '/business/office/clients'], ['documents', '/business/office/documents']])('keeps the %s Office work area reachable', (area, target) => {
    state.params = { area, record: 'selected-record' };
    expect(renderToStaticMarkup(<OfficeIndexRoute />)).toContain(`href="${target}?record=selected-record"`);
  });

  it('redirects the retired dashboard directly to Unternehmen', () => {
    expect(renderToStaticMarkup(<OfficeDashboardRedirect />)).toContain('href="/unternehmen"');
  });

  it('retains an old dashboard area and record when opening its receiving page', () => {
    state.params = { area: 'people', record: 'employee-17' };
    expect(renderToStaticMarkup(<OfficeDashboardRedirect />)).toContain('href="/business/office/employees?record=employee-17"');
  });

  it('opens the current native company workspace', () => {
    expect(renderToStaticMarkup(<NativeCompanyRoute />)).toContain('native-company');
  });

  it('keeps legacy Liquid Office links on the canonical company screen', () => {
    state.params = { area: 'company' };
    expect(renderToStaticMarkup(<LegacyLiquidOfficeRoute />)).toContain('href="/unternehmen');
    state.params = { area: 'people' };
    expect(renderToStaticMarkup(<LegacyLiquidOfficeRoute />)).toContain('href="/business/office/employees"');
  });
});
