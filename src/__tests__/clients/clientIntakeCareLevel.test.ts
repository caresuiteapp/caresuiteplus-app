import { describe, expect, it } from 'vitest';
import { normalizeIntakeCareLevelForDb } from '@/lib/clients/clientIntakeCareLevel';

describe('normalizeIntakeCareLevelForDb', () => {
  it.each([
    ['', null],
    ['kein', 'none'],
    ['unbekannt', 'unknown'],
    ['pg1', 'pg1'],
    ['pg5', 'pg5'],
    ['beantragt', null],
    ['abgelehnt', null],
    ['unerwartet', null],
  ])('normalisiert %s ohne ungültigen Enumwert', (input, expected) => {
    expect(normalizeIntakeCareLevelForDb(input)).toBe(expected);
  });
});
