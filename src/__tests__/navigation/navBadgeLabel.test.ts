import { describe, expect, it } from 'vitest';
import { formatNavBadgeLabel } from '@/lib/navigation/navBadgeLabel';

describe('formatNavBadgeLabel', () => {
  it('liefert keine Badge bei 0', () => {
    expect(formatNavBadgeLabel(0)).toBeUndefined();
    expect(formatNavBadgeLabel(-1)).toBeUndefined();
  });

  it('formatiert Einzahl und Mehrzahl auf Deutsch', () => {
    expect(formatNavBadgeLabel(1)).toBe('1 Neu');
    expect(formatNavBadgeLabel(3)).toBe('3 Neu');
    expect(formatNavBadgeLabel(12)).toBe('12 Neu');
  });
});
