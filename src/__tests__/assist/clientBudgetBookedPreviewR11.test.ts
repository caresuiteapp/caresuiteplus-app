import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('client budget booked and preview presentation R11', () => {
  const cards = readFileSync('src/components/office/ClientBudgetVisualCards.tsx', 'utf8');
  const selector = readFileSync('src/components/office/ClientFundingSourceSelector.tsx', 'utf8');

  it('separates booked services from expansion opportunities', () => {
    expect(cards).toContain('Gebuchte Leistungen');
    expect(cards).toContain('Noch nicht gebuchte Leistungen');
    expect(cards).toContain("model.bookingState === 'booked'");
    expect(cards).toContain("model.bookingState !== 'booked'");
  });

  it('marks preview values as non-binding and never as available budget', () => {
    expect(cards).toContain('VORSCHAU · NOCH NICHT GEBUCHT');
    expect(cards).toContain('Unverbindliche Vorschau');
    expect(cards).toContain("isPreview ? 'mögliches Leistungsbudget' : 'noch verfügbar'");
    expect(cards).toContain('welche zusätzliche Leistung bei einer Erweiterung möglich wäre');
  });

  it('shows the booking state directly in the funding selector', () => {
    expect(selector).toContain("selected ? '✓ LEISTUNG GEBUCHT' : 'NOCH NICHT GEBUCHT'");
  });

  it('labels reservations as planned assignments instead of an unclear bookmark', () => {
    expect(cards).toContain('Einsätze geplant');
    expect(cards).not.toContain('Vorgemerkt');
    expect(cards).not.toContain('vorgemerkt');
  });
});
