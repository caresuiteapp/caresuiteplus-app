import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  resolvePlatformAddonRowKey,
  resolvePlatformPlanRowKey,
} from '@/lib/platformConsole/platformRowKeys';

const root = path.join(__dirname, '..', '..', '..');

describe('Platform operator UI components', () => {
  it('exports PlatformAuditLink from platformConsole barrel', () => {
    const indexSource = readFileSync(
      path.join(root, 'src/components/platformConsole/index.ts'),
      'utf8',
    );
    expect(indexSource).toContain("export { PlatformAuditLink } from './PlatformAuditLink'");
  });

  it('resolvePlatformAddonRowKey prefers addon_key then id', () => {
    expect(resolvePlatformAddonRowKey({ addon_key: 'sms' }, 0)).toBe('sms');
    expect(resolvePlatformAddonRowKey({ id: 'abc' }, 1)).toBe('legacy-addon:abc');
    expect(resolvePlatformAddonRowKey({}, 3)).toBe('legacy-addon-index:3');
  });

  it('resolvePlatformPlanRowKey prefers plan_key then id', () => {
    expect(resolvePlatformPlanRowKey({ plan_key: 'starter' }, 0)).toBe('starter');
    expect(resolvePlatformPlanRowKey({ id: 'pv1' }, 2)).toBe('legacy-plan:pv1');
  });
});
