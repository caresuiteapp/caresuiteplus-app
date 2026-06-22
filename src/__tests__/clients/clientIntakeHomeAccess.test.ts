import { describe, expect, it } from 'vitest';
import {
  parseHomeAccessStoredValue,
  serializeHomeAccessValues,
} from '@/lib/clients/clientIntakeHomeAccess';

describe('clientIntakeHomeAccess', () => {
  it('parses comma-separated catalog keys', () => {
    expect(parseHomeAccessStoredValue('klingel,schluessel,tresor')).toEqual([
      'klingel',
      'schluessel',
      'tresor',
    ]);
  });

  it('parses a single legacy value', () => {
    expect(parseHomeAccessStoredValue('klingel')).toEqual(['klingel']);
  });

  it('parses JSON array strings', () => {
    expect(parseHomeAccessStoredValue('["klingel","tuercode"]')).toEqual(['klingel', 'tuercode']);
  });

  it('returns empty array for blank values', () => {
    expect(parseHomeAccessStoredValue(null)).toEqual([]);
    expect(parseHomeAccessStoredValue('')).toEqual([]);
    expect(parseHomeAccessStoredValue('   ')).toEqual([]);
  });

  it('serializes selected values as comma-separated string', () => {
    expect(serializeHomeAccessValues(['klingel', 'schluessel'])).toBe('klingel,schluessel');
  });

  it('returns null when nothing is selected', () => {
    expect(serializeHomeAccessValues([])).toBeNull();
    expect(serializeHomeAccessValues(['', '  '])).toBeNull();
  });
});
