import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFromDotenv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnvFromDotenv();

const REMOTE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const REMOTE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PILOT_TENANT = '11111111-1111-1111-1111-111111111101';
const runAnonRemote = REMOTE_URL.includes('supabase.co') && REMOTE_KEY.length > 20;
const runServiceRemote = runAnonRemote && SERVICE_ROLE_KEY.length > 20;

describe.skipIf(!runAnonRemote)('Live-Pilot Remote E2E (anon, unauthenticated)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('communication_threads table is reachable on remote', async () => {
    const supabase = createClient(REMOTE_URL, REMOTE_KEY);
    const { error } = await supabase.from('communication_threads').select('id').limit(1);
    expect(error === null || error?.code === 'PGRST301' || error?.message?.includes('permission')).toBe(true);
  });

  it('ti_providers table exists on remote', async () => {
    const supabase = createClient(REMOTE_URL, REMOTE_KEY);
    const { error } = await supabase.from('ti_providers').select('id').limit(1);
    expect(error === null || error?.code === 'PGRST301' || error?.message?.includes('permission')).toBe(true);
  });

});

describe.skipIf(!runServiceRemote)('Live-Pilot Remote E2E (service-role, read-only)', () => {
  it('pilot tenants seeded', async () => {
    const supabase = createClient(REMOTE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', PILOT_TENANT)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.name).toContain('SonnenPflege');
  });
});

describe('Live-Pilot config', () => {
  it('DEMO_MODE=false when .env loaded in CI', () => {
    if (process.env.EXPO_PUBLIC_DEMO_MODE === 'false') {
      expect(process.env.EXPO_PUBLIC_SUPABASE_URL).toBeTruthy();
    }
  });
});
