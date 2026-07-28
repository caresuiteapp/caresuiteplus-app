import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  liquidGlobalShortcuts,
  liquidModules,
  liquidWorkAreas,
} from '@/liquid-command/navigation/moduleCatalog';
import {
  getLiquidPrimaryActionLabel,
  getLiquidPrimaryWorkflowRoute,
  getLiquidRecordRoute,
} from '@/liquid-command/navigation/workflowRoutes';
import { inferLiquidArea } from '@/liquid-command/navigation/routeContext';
import {
  liquidPortalNavigation,
  liquidPortalRoots,
} from '@/liquid-command/navigation/portalCatalog';

const root = process.cwd();

function stripUrlState(route: string): string {
  return route.split(/[?#]/, 1)[0] || '/';
}

function collectRoutePatterns(directory: string, routeSegments: string[] = []): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) {
      const next = entry.name.startsWith('(') && entry.name.endsWith(')')
        ? routeSegments
        : [...routeSegments, entry.name];
      return collectRoutePatterns(absolute, next);
    }
    if (!entry.name.endsWith('.tsx') || entry.name.startsWith('_') || entry.name.startsWith('+')) {
      return [];
    }
    const segment = entry.name === 'index.tsx' ? null : entry.name.slice(0, -4);
    return [`/${[...routeSegments, ...(segment ? [segment] : [])].join('/')}`];
  });
}

const routePatterns = collectRoutePatterns(join(root, 'app'));

function patternMatchesRoute(pattern: string, route: string): boolean {
  const patternSegments = pattern.split('/').filter(Boolean);
  const routeSegments = stripUrlState(route).split('/').filter(Boolean);
  if (patternSegments.length !== routeSegments.length) return false;
  return patternSegments.every(
    (segment, index) =>
      (segment.startsWith('[') && segment.endsWith(']')) || segment === routeSegments[index],
  );
}

function routeExists(route: string): boolean {
  return routePatterns.some((pattern) => patternMatchesRoute(pattern, route));
}

describe('Liquid Command route integrity', () => {
  it('keeps every global shortcut and module destination reachable', () => {
    for (const item of [...liquidGlobalShortcuts, ...liquidModules]) {
      expect(routeExists(item.route), `${item.label}: ${item.route}`).toBe(true);
    }
  });

  it('keeps every work-area destination reachable and uniquely identified', () => {
    for (const module of liquidModules) {
      const areas = liquidWorkAreas[module.key];
      expect(new Set(areas.map((area) => area.id)).size).toBe(areas.length);
      for (const area of areas) {
        expect(routeExists(area.route), `${module.key}.${area.id}: ${area.route}`).toBe(true);
      }
    }
  });

  it('keeps all configured primary actions connected to real routes', () => {
    for (const module of liquidModules) {
      for (const area of liquidWorkAreas[module.key]) {
        const route = getLiquidPrimaryWorkflowRoute(module.key, area.id);
        if (!route) continue;
        expect(getLiquidPrimaryActionLabel(module.key, area.id)).toBeTruthy();
        expect(routeExists(route), `${module.key}.${area.id}: ${route}`).toBe(true);
      }
    }
  });

  it('keeps configured record links connected to dynamic detail routes', () => {
    for (const module of liquidModules) {
      for (const area of liquidWorkAreas[module.key]) {
        const route = getLiquidRecordRoute(module.key, area.id, '00000000-0000-0000-0000-000000000000');
        if (!route) continue;
        expect(routeExists(route), `${module.key}.${area.id}: ${route}`).toBe(true);
      }
    }
  });

  it('does not ship no-op interactions inside the Greenfield runtime', () => {
    const liquidRoot = join(root, 'src', 'liquid-command');
    const stack = [liquidRoot];
    const files: string[] = [];
    while (stack.length) {
      const directory = stack.pop();
      if (!directory) continue;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) stack.push(path);
        else if (/\.[jt]sx?$/.test(entry.name)) files.push(path);
      }
    }
    for (const path of files) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/on(?:Press|ChangeText)=\{\(\)\s*=>\s*(?:undefined|null|\{\})\}/);
    }
  });

  it('highlights the correct work area for canonical and detail routes', () => {
    expect(inferLiquidArea('/business/office/clients/abc', 'office')).toBe('clients');
    expect(inferLiquidArea('/business/office/payroll', 'office')).toBe('payroll');
    expect(inferLiquidArea('/assist/assignments/abc', 'assist')).toBe('assignments');
    expect(inferLiquidArea('/pflege/wunddokumentation/abc', 'pflege')).toBe('wounds');
    expect(inferLiquidArea('/stationaer/uebergabebericht/abc', 'stationaer')).toBe('handover');
    expect(inferLiquidArea('/beratung/protokolle/abc', 'beratung')).toBe('proofs');
    expect(inferLiquidArea('/akademie/zertifikate/abc', 'akademie')).toBe('certificates');
    expect(inferLiquidArea('/platform/feature-flags', 'platform')).toBe('flags');
    expect(inferLiquidArea('/settings/appearance', 'settings')).toBe('branding');
  });

  it('keeps every portal navigation item connected and unique', () => {
    for (const kind of Object.keys(liquidPortalNavigation) as (keyof typeof liquidPortalNavigation)[]) {
      const navigation = liquidPortalNavigation[kind];
      expect(routeExists(liquidPortalRoots[kind]), `${kind} root`).toBe(true);
      expect(new Set(navigation.map((item) => item.id)).size).toBe(navigation.length);
      for (const item of navigation) {
        expect(routeExists(item.route), `${kind}.${item.id}: ${item.route}`).toBe(true);
      }
    }
  });
});
