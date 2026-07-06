import { describe, expect, it } from 'vitest';
import {
  CLIENT_PORTAL_GREETING,
  resolveClientPortalHeroLines,
} from '@/lib/portal/clientPortalGreeting';

describe('clientPortalGreeting', () => {
  it('uses Hallo and separates name from tenant module line', () => {
    const lines = resolveClientPortalHeroLines({
      displayName: 'Erika Mustermann',
      tenantName: 'Test Pflege GmbH',
      moduleLabel: 'Assist',
    });

    expect(lines.greetingLine).toBe(CLIENT_PORTAL_GREETING);
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
