import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

describe('employee portal runtime unblock R20.6', () => {
  it('binds the store build to production and refuses a cache-only AAB', () => {
    const eas = JSON.parse(read('eas.json'));
    const appConfig = read('app.config.ts');
    const verifier = read('scripts/verify-portal-production-env.mjs');

    expect(eas.build['portal-only-aab'].environment).toBe('production');
    expect(appConfig).toContain("process.env.EAS_BUILD === 'true'");
    expect(appConfig).toContain('Portal-only AAB abgebrochen');
    expect(verifier).toContain('EXPO_PUBLIC_SUPABASE_URL');
    expect(verifier).toContain('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  });

  it('tolerates legacy live-context fields during the server refresh', () => {
    const hook = read('src/hooks/useEmployeePortalVisitExecution.ts');

    expect(hook).not.toMatch(/liveContext\?\.consentStatus\.(granted|grantedAt|explainedAt)/);
    expect(hook).not.toContain('executionContext.diagnostics.repairHint');
  });

  it('makes the installed build and concrete runtime error supportable', () => {
    const boundary = read('src/components/portal/EmployeePortalExecutionErrorBoundary.tsx');

    expect(boundary).toContain('runtimeLabel()');
    expect(boundary).toContain('technicalMessage');
    expect(boundary).toContain('Live-Konfiguration: fehlt');
    expect(boundary).toContain('Einsatz:');
  });
});
