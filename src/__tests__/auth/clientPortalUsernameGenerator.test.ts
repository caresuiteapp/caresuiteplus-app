import { describe, expect, it } from 'vitest';
import {
  generateClientPortalUsername,
  pickUniqueClientPortalUsername,
  sanitizePortalUsernameInput,
} from '@/lib/auth/clientPortalUsernameGenerator';

describe('clientPortalUsernameGenerator', () => {
  it('generates username from first and last name', () => {
    expect(generateClientPortalUsername('Heinz-Peter', 'Reinhardt')).toBe('hreinhardt');
    expect(generateClientPortalUsername('Maria', 'Schmidt')).toBe('maria.schmidt');
  });

  it('uses compact form when dotted username exceeds max length', () => {
    const username = generateClientPortalUsername('Alexander', 'Mustermann-Von-Longname');
    expect(username.length).toBeLessThanOrEqual(20);
    expect(username).toMatch(/^[a-z0-9.-]+$/);
  });

  it('resolves tenant collisions with numeric suffix', () => {
    const base = generateClientPortalUsername('Heinz-Peter', 'Reinhardt');
    const unique = pickUniqueClientPortalUsername('Heinz-Peter', 'Reinhardt', [base]);
    expect(unique).not.toBe(base);
    expect(unique.length).toBeLessThanOrEqual(20);
  });

  it('normalizes umlauts and compound last names', () => {
    expect(generateClientPortalUsername('Jürgen', 'Groß')).toBe('juergen.gross');
    expect(generateClientPortalUsername('Ana', 'Do Nascimento')).toBe('ana.nascimento');
  });

  it('sanitizePortalUsernameInput keeps trailing dot while typing dotted usernames', () => {
    expect(sanitizePortalUsernameInput('ellen.')).toBe('ellen.');
    expect(sanitizePortalUsernameInput('ellen.zacharias')).toBe('ellen.zacharias');
    expect(sanitizePortalUsernameInput('Ellen.Zacharias!')).toBe('ellen.zacharias');
    expect(sanitizePortalUsernameInput('heinz-peter.')).toBe('heinz-peter.');
  });
});
