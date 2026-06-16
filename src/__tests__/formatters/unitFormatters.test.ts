import { describe, expect, it } from 'vitest';
import { formatCareLevel, formatSalutation } from '@/lib/formatters/unitFormatters';

describe('unitFormatters — deutsche Großschreibung', () => {
  describe('formatCareLevel', () => {
    it('formatiert pg3 als PG 3', () => {
      expect(formatCareLevel('pg3')).toBe('PG 3');
    });

    it('formatiert PG 3 unverändert', () => {
      expect(formatCareLevel('PG 3')).toBe('PG 3');
    });

    it('formatiert numerische Werte', () => {
      expect(formatCareLevel('3')).toBe('PG 3');
      expect(formatCareLevel(3)).toBe('PG 3');
    });

    it('formatiert none/kein', () => {
      expect(formatCareLevel('none')).toBe('kein Pflegegrad');
      expect(formatCareLevel('kein')).toBe('kein Pflegegrad');
    });
  });

  describe('formatSalutation', () => {
    it('formatiert herr als Herr', () => {
      expect(formatSalutation('herr')).toBe('Herr');
    });

    it('formatiert frau als Frau', () => {
      expect(formatSalutation('frau')).toBe('Frau');
    });

    it('belässt bereits korrekte Anrede', () => {
      expect(formatSalutation('Herr')).toBe('Herr');
    });
  });
});
