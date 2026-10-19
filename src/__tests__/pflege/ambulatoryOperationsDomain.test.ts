import { describe, expect, it } from 'vitest';
import { admissionBlockers, calculateTariffAmount, isCalendarDate, parseEuroCents, validTariffs, validateShift, type CareTariff } from '@/lib/pflege/ambulatoryOperationsDomain';
describe('Ambulante Eingaben und Preisversionen', () => {
  it.each(['2026-02-30', '2026-13-01', '02.10.2026', '', '2025-02-29'])('rejects invalid calendar date %s', (value) => expect(isCalendarDate(value)).toBe(false));
  it.each([['32,75', 3275], ['32.7', 3270], ['0,01', 1], ['32', 3200]])('parses decimal money without losing cent precision', (value, expected) => expect(parseEuroCents(String(value))).toBe(expected));
  it.each(['-1', '1e5', '32,750', '1.000,00', '', 'NaN'])('rejects ambiguous or invalid amount %s', (value) => expect(parseEuroCents(value)).toBeNull());
  it('requires contract, cost information and valid payer evidence', () => expect(admissionBlockers({ startsOn: '2026-10-02', endsOn: '', basis: 'sgb_xi', payerName: '', payerIk: '', contractReference: '', costInformationReference: '' })).toHaveLength(4));
  it('does not demand a health insurance IK for private contracts', () => expect(admissionBlockers({ startsOn: '2026-10-02', endsOn: '', basis: 'private', payerName: '', payerIk: '', contractReference: 'Vertrag', costInformationReference: 'Kosteninformation' })).toEqual([]));
  it('selects tariffs by service day, legal basis and payer', () => {
    const tariff = { id: 'valid', basis: 'sgb_xi', validFrom: '2026-10-01', validUntil: '2026-10-31', payerIk: '123456789' } as CareTariff;
    expect(validTariffs([tariff, { ...tariff, id: 'other', payerIk: '987654321' }, { ...tariff, id: 'expired', validUntil: '2026-10-01' }], '2026-10-02', 'sgb_xi', '123456789').map((v) => v.id)).toEqual(['valid']);
  });
  it('rounds fractional units once at the total and rejects zero/overflow quantities', () => {
    expect(calculateTariffAmount({ unitPriceCents: 3275 }, '1,5')).toBe(4913);
    expect(calculateTariffAmount({ unitPriceCents: 3275 }, '0')).toBeNull();
    expect(calculateTariffAmount({ unitPriceCents: 999999999 }, '2')).toBeNull();
  });
  it('checks selected employee, maximum net duration and required breaks', () => {
    const input = { employeeId: 'person', shiftDate: '2026-10-02', startTime: '06:00', endTime: '14:00', breakMinutes: 30 };
    expect(validateShift(input)).toBeNull(); expect(validateShift({ ...input, employeeId: '' })).toMatch(/Pflegekraft/);
    expect(validateShift({ ...input, breakMinutes: 0 })).toMatch(/Pause/);
    expect(validateShift({ ...input, endTime: '18:00', breakMinutes: 45 })).toMatch(/zehn Stunden/);
  });
});
