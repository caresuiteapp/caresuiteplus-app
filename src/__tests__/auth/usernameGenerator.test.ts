import { describe, expect, it } from 'vitest';
import {
  generateUsername,
  pickUniqueUsername,
  resolveUsernameCollision,
  sanitizeUsername,
  validateUsername,
} from '@/lib/auth/usernameGenerator';
import { USERNAME_MAX_LENGTH } from '@/lib/auth/auth.types';

describe('usernameGenerator', () => {
  it('generates spec examples', () => {
    expect(generateUsername('Helferhasen+ UG', 'Kevin', 'Reinhardt')).toBe('helfe.kevi.reinhar');
    expect(generateUsername('Pflege Müller GmbH', 'Maria', 'Schmidt')).toBe('pfle.mari.schmid');
    expect(generateUsername('CareSuite+ Technologies', 'Jacqueline', 'Limper')).toBe('care.jacq.limper');
    expect(generateUsername('Seniorenbetreuung Lala', 'Ana', 'Do Nascimento')).toBe('seni.ana.nascim');
  });

  it('keeps usernames at most 20 characters', () => {
    const username = generateUsername('Very Long Company Name GmbH', 'Alexander', 'Mustermann');
    expect(username.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it('replaces umlauts and removes special characters', () => {
    expect(generateUsername('Müller & Söhne GmbH', 'Jürgen', 'Groß')).toBe('muell.juerg.gross');
  });

  it('does not start or end with a dot', () => {
    const username = generateUsername('Test GmbH', 'Anna', 'Meier');
    expect(username.startsWith('.')).toBe(false);
    expect(username.endsWith('.')).toBe(false);
  });

  it('resolves collisions within 20 characters', () => {
    const base = 'helfe.kevi.reinhar';
    expect(resolveUsernameCollision(base, 2)).toBe('helfe.kevi.reinha2');
    expect(resolveUsernameCollision(base, 3)).toBe('helfe.kevi.reinha3');
    expect(resolveUsernameCollision(base, 2).length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it('picks a unique username when base exists', () => {
    const base = generateUsername('Helferhasen+ UG', 'Kevin', 'Reinhardt');
    const unique = pickUniqueUsername('Helferhasen+ UG', 'Kevin', 'Reinhardt', [base]);
    expect(unique).not.toBe(base);
    expect(unique.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
  });

  it('validates manual username edits', () => {
    expect(validateUsername('helfe.kevi.reinhar')).toBeNull();
    expect(validateUsername('.invalid')).toMatch(/beginnen|ende|Punkt/);
    expect(validateUsername('helfe.kevi.reinhar', ['helfe.kevi.reinhar'])).toMatch(/vergeben/);
  });

  it('sanitizes invalid characters', () => {
    expect(sanitizeUsername('Helfe.Kevi.Reinhar!')).toBe('helfe.kevi.reinhar');
  });
});
