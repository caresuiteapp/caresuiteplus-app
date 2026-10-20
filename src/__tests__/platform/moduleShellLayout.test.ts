import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

function readSrc(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

const MODULES = [
  { key: 'assist', area: 'assist' },
  { key: 'office', area: 'office' },
  { key: 'akademie', area: 'akademie' },
  { key: 'pflege', area: 'pflege' },
  { key: 'beratung', area: 'beratung' },
  { key: 'stationaer', area: 'stationaer' },
] as const;

describe('Module root shell layout (LiquidCommand wraps all routes)', () => {
  for (const { key, area } of MODULES) {
    it(`${key} root layout delegates to LiquidModuleRouteLayout`, () => {
      const layout = readSrc(`app/${key}/_layout.tsx`);
      expect(layout).toContain('LiquidModuleRouteLayout');
      expect(area).toBe(key);
    });

    it(`${key} tabs layout does not nest a second ShellLayout`, () => {
      const layout = readSrc(`app/${key}/(tabs)/_layout.tsx`);
      expect(layout).not.toContain('ShellLayout');
      expect(layout).toContain(`Shell lives in app/${key}/_layout.tsx`);
    });
  }
});
