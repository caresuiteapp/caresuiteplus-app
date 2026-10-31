import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

it('resolves the full production release using the canonical app version before native compilation', () => {
  const version = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')).expo.version;
  const child = spawnSync(process.execPath, ['scripts/verify-healthos-full-production.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 30_000,
    env: {
      ...process.env,
      EXPO_TOKEN: '',
      EXPO_OFFLINE: '1',
      EXPO_NO_TELEMETRY: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://build-validation.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'build-validation-placeholder',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
    },
  });
  expect(child.status, child.stderr).toBe(0);
  expect(child.stdout).toContain(`CareSuite HealthOS ${version}, full, app.caresuitehealthos, Router app.`);
}, 35_000);
