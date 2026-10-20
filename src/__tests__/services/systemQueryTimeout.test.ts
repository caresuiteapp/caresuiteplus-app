import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getServiceQueryTimeoutMs,
  SERVICE_QUERY_TIMEOUT_MS,
} from '@/lib/services/queryTimeout';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');
}

describe('systemweite Datenabfragezeit', () => {
  it('uses 120 seconds as the single central query timeout', () => {
    expect(SERVICE_QUERY_TIMEOUT_MS).toBe(120_000);
    expect(getServiceQueryTimeoutMs()).toBe(120_000);
  });

  it('applies the central timeout to standard async queries and dashboards', () => {
    const asyncQuery = source('src/hooks/core/useAsyncQuery.ts');
    const officeDashboard = source('src/lib/office/officeDashboardRequestCache.ts');
    const assistDashboard = source('src/hooks/useAssistDashboard.ts');

    expect(asyncQuery).toContain('withServiceQueryTimeout(fetcher())');
    expect(officeDashboard).toContain('withServiceQueryTimeout(');
    expect(assistDashboard).toContain('withServiceQueryTimeout(');
  });

  it('uses the same 120-second limit while resolving portal data', () => {
    const portalContext = source('src/hooks/usePortalContext.ts');

    expect(portalContext).toContain("import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';");
    expect(source('src/hooks/core/useAsyncQuery.ts')).toContain('withServiceQueryTimeout(fetcher())');
    expect(portalContext).not.toContain('PORTAL_CONTEXT_TIMEOUT_MS = 25_000');
  });
});
