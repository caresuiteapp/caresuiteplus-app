import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  capitalizeNamePart,
  fetchClientPortalDisplayName,
  formatClientPortalDisplayName,
  isPortalUsernameLabel,
} from '@/lib/portal/clientPortalDisplayName';

describe('formatClientPortalDisplayName', () => {
  it('formats first and last name with capitalization', () => {
    expect(
      formatClientPortalDisplayName({
        firstName: 'ellen',
        lastName: 'zacharias',
      }),
    ).toBe('Ellen Zacharias');
  });

  it('prefixes Herr/Frau when salutation is set', () => {
    expect(
      formatClientPortalDisplayName({
        firstName: 'Ellen',
        lastName: 'Zacharias',
        salutation: 'frau',
      }),
    ).toBe('Frau Ellen Zacharias');
  });
});

describe('isPortalUsernameLabel', () => {
  it('detects generated portal usernames', () => {
    expect(isPortalUsernameLabel('ellen.zacharias')).toBe(true);
    expect(isPortalUsernameLabel('Ellen Zacharias')).toBe(false);
  });

  it('detects duplicated portal username labels', () => {
    expect(isPortalUsernameLabel('ellen.zacharias ellen.zacharias')).toBe(true);
  });
});

describe('capitalizeNamePart', () => {
  it('capitalizes lowercase name parts', () => {
    expect(capitalizeNamePart('ellen')).toBe('Ellen');
    expect(capitalizeNamePart('Zacharias')).toBe('Zacharias');
  });
});

describe('fetchClientPortalDisplayName', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves demo client name by clientId', async () => {
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');
    const name = await fetchClientPortalDisplayName('demo-tenant', 'client-001');
    expect(name).toBe('Helga Schneider');
  });
});
