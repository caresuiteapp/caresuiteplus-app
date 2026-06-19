import { describe, expect, it } from 'vitest';
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
});

describe('capitalizeNamePart', () => {
  it('capitalizes lowercase name parts', () => {
    expect(capitalizeNamePart('ellen')).toBe('Ellen');
    expect(capitalizeNamePart('Zacharias')).toBe('Zacharias');
  });
});

describe('fetchClientPortalDisplayName', () => {
  it('resolves demo client name by clientId', async () => {
    const name = await fetchClientPortalDisplayName('demo-tenant', 'client-001');
    expect(name).toBe('Helga Schneider');
  });
});
