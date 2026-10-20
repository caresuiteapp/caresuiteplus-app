import { describe, it, expect } from 'vitest';
import { berlinEventCandidates, validateMedicationAdministration as check, validateMedicationFollowUp, validEventInstant } from '@/lib/pflege/medicationAdministrationDomain';
const order = { status: 'active', startDate: '2026-01-01', endDate: '2026-12-31', isPrn: true, isControlledSubstance: true };
const input = { status: 'late' as const, occurredAt: '2026-10-08T08:00:00+02:00', dose: '1 Tablette', route: 'oral', deviationReason: 'Einsatz verspätet', prnReason: 'Ärztlich festgelegter Bedarf', witnessProfileId: 'witness', painScoreBefore: 0 };
const now = new Date('2026-10-08T10:00:00Z');
describe('Medikationsereignisse', () => {
 it('prüft verspätete tatsächliche Gaben einschließlich Bedarf und Gegenkontrolle', () => {
 expect(check(order, 'actor', input, now)).toBeNull();
 expect(check(order, 'actor', { ...input, prnReason: '' }, now)).toMatch(/Bedarfsindikation/);
 expect(check(order, 'actor', { ...input, witnessProfileId: 'actor' }, now)).toMatch(/andere Person/);
 });
 it('erfindet keine tatsächlich verabreichte Dosis bei Nichtgaben', () => {
 expect(check(order, 'actor', { ...input, status: 'refused' }, now)).toMatch(/Nichtgabe/);
 expect(check(order, 'actor', { status: 'refused', occurredAt: input.occurredAt, deviationReason: 'Ablehnung dokumentiert' }, now)).toBeNull();
 });
 it('prüft ausdrückliche Dosis und Applikation', () => {
 expect(check(order, 'actor', { ...input, dose: '' }, now)).toMatch(/ausdrücklich/);
 expect(check(order, 'actor', { ...input, route: '' }, now)).toMatch(/ausdrücklich/);
 });
 it('verweigert ungültige Zeitpunkte und zukünftige Ereignisse', () => {
 for (const occurredAt of ['2026-02-30T08:00:00Z', '2026-10-08T24:00:00Z', '0000-10-08T08:00:00Z', '2026-10-08T08:00:00', '2026-10-09T08:00:00Z']) expect(check(order, 'actor', { ...input, occurredAt }, now)).not.toBeNull();
 expect(validEventInstant('2026-10-08T08:00:00+25:00')).toBe(false);
 });
 it('prüft die Gültigkeit am deutschen Ereignistag', () => {
 expect(check({ ...order, endDate: '2026-10-07' }, 'actor', { ...input, occurredAt: '2026-10-07T22:30:00Z' }, now)).toMatch(/gültigkeit/i);
 });
 it('unterscheidet Zeitumstellungslücke und doppelte Uhrzeit', () => {
 expect(berlinEventCandidates('2026-03-29', '02:30')).toEqual([]);
 expect(berlinEventCandidates('2026-10-25', '02:30')).toHaveLength(2);
 expect(berlinEventCandidates('2026-02-30', '10:00')).toEqual([]);
 });
 it('akzeptiert Schmerz null oder null Punkte, aber keine Bruchteile', () => {
 expect(check(order, 'actor', input, now)).toBeNull();
 for (const painScoreBefore of [-1, 11, .5, NaN, Infinity]) expect(check(order, 'actor', { ...input, painScoreBefore }, now)).toMatch(/Schmerzskala/);
 });
 it('verlangt eine zeitlich gültige ergänzende Wirkungskontrolle', () => {
 expect(validateMedicationFollowUp(input.occurredAt, '2026-10-08T09:00:00+02:00', 'Wirkung beobachtet', 'Weitere Kontrolle geplant', 0, now)).toBeNull();
 expect(validateMedicationFollowUp(null, input.occurredAt, 'Text', 'Text', null, now)).not.toBeNull();
 expect(validateMedicationFollowUp(input.occurredAt, '2026-10-08T07:00:00+02:00', 'Text', 'Text', null, now)).not.toBeNull();
 expect(validateMedicationFollowUp(input.occurredAt, input.occurredAt, '', 'Text', null, now)).not.toBeNull();
 });
});
