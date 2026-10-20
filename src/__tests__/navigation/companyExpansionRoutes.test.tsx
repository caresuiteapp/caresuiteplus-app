/// <reference types="vite/client" />
import type { ComponentType, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getRouteByPath } from '@/lib/navigation/routes';
import { safeWebReturnPath } from '@/lib/navigation/webLoginReturn';
import { describeLiquidRoute } from '@/liquid-command/navigation/routeContext';

vi.mock('expo-router', () => ({ Redirect: ({ href }: { href: string }) => <a href={href}>Weiter</a> }));
vi.mock('@/liquid-command/screens/CompanyWorkspaceScreen.web', () => ({ CompanyWorkspaceScreen: ({ initialTab, initialView }: { initialTab: string; initialView: string }) => <span>{initialTab}:{initialView}</span> }));
vi.mock('@/liquid-command/shell/LiquidModuleRouteLayout', () => ({ LiquidModuleRouteLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
const routes = import.meta.glob<{ default: ComponentType }>('../../../app/unternehmen/*.tsx', { eager: true });
const expected = {
  standorte: ['structure', 'sites'], abteilungen: ['structure', 'departments'], gesellschaften: ['structure', 'entities'],
  franchise: ['structure', 'relationships'], personalzuordnung: ['structure', 'placements'], zugriffe: ['structure', 'access'],
  ressourcen: ['resources', 'overview'], versicherungen: ['resources', 'insurance'], vertraege: ['resources', 'contracts'],
  fuhrpark: ['resources', 'fleet'], zuordnungen: ['resources', 'assets'],
};
describe('company expansion routes', () => {
  for (const [path, [tab, view]] of Object.entries(expected)) it(`${path} opens the intended company view and keeps a native fallback`, () => {
    const Web = routes[`../../../app/unternehmen/${path}.web.tsx`].default;
    const Native = routes[`../../../app/unternehmen/${path}.tsx`].default;
    expect(renderToStaticMarkup(<Web />)).toBe(`<main><span>${tab}:${view}</span></main>`);
    expect(renderToStaticMarkup(<Native />)).toContain('href="/unternehmen"');
    expect(getRouteByPath(`/unternehmen/${path}`)).toMatchObject({ requiresAuth: true, productKey: 'office' });
    expect(safeWebReturnPath(`/unternehmen/${path}?ansicht=${view}`)).toBe(`/unternehmen/${path}?ansicht=${view}`);
    expect(describeLiquidRoute(`/unternehmen/${path}`, 'office').areaId).toBe('company');
  });
});
