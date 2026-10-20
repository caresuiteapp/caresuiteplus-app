import { describe, expect, it } from 'vitest';
import {
  resolveClientPortalHeroLines,
  resolveClientPortalGreetingLine,
} from '@/lib/portal/clientPortalGreeting';

describe('clientPortalGreeting', () => {
  it('uses time-based greeting and separates name from tenant module line', () => {
    const lines = resolveClientPortalHeroLines({
      displayName: 'Erika Mustermann',
      tenantName: 'Test Pflege GmbH',
      moduleLabel: 'Assist',
    });

    expect(lines.greetingLine).toBe(resolveClientPortalGreetingLine());
    expect(lines.nameLine).toBe('Erika Mustermann');
    expect(lines.providerLine).toBe('Test Pflege GmbH · Assist');
  });

  it('never uses tenant name as person name', () => {
    const lines = resolveClientPortalHeroLines({
      displayName: 'AVENTA',
      tenantName: 'AVENTA',
      moduleLabel: 'Assist',
    });

    expect(lines.nameLine).not.toBe('AVENTA');
    expect(lines.providerLine).toBe('AVENTA · Assist');
  });
});
