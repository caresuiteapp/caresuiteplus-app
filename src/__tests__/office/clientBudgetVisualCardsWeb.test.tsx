// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientBudgetVisualCards } from '@/components/office/ClientBudgetVisualCards.web';
import type { ClientBudgetVisualModel } from '@/lib/assist/clientBudgetVisuals.web';

vi.mock('@/components/layout/platform/AppGlassModal', () => ({
  AppGlassModal: ({ visible, title, children, onClose, footerActions }: {
    visible: boolean; title: string; children: ReactNode; onClose: () => void;
    footerActions: { title: string; onPress: () => void }[];
  }) => visible ? <div role="dialog" aria-label={title}><button onClick={onClose}>Dialog schließen</button>{children}{footerActions.map((action) => <button key={action.title} onClick={action.onPress}>{action.title}</button>)}</div> : null,
}));

function model(overrides: Partial<ClientBudgetVisualModel> = {}): ClientBudgetVisualModel {
  return {
    id: 'entlastung', title: 'Entlastungsbetrag', legalLabel: '§ 45b SGB XI',
    totalCents: 30_000, usedCents: 10_000, reservedCents: 10_000, availableCents: 10_000,
    availableHours: 3.05, hourlyRateCents: 3275, usedPercent: 33, reservedPercent: 33, availablePercent: 33,
    periodLabel: 'Vorhandene Budgetkonten', expiryLabel: 'Frist laut Budgetkonto',
    eligible: true, enabled: true, bookingState: 'booked', statusLabel: 'Leistung gebucht', careGrade: 'pg2',
    fullCareAllowanceCents: null, remainingCareAllowanceCents: null, externalSachleistungCents: 0,
    explanation: ['Dies ist die Erklärung zum persönlichen Budget.'], ...overrides,
  };
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (models: ClientBudgetVisualModel[]) => act(async () => root.render(<ClientBudgetVisualCards models={models} />));
const click = async (node: Element) => act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));

describe('Web budget cards', () => {
  it('shows real booked values with a proportional breakdown even when rounded percentages sum to 99', async () => {
    await render([model()]);
    expect(host.querySelector('section')?.getAttribute('aria-label')).toBe('Gebuchte Leistungen');
    const track = host.querySelector('[role="img"]')!;
    expect(track.getAttribute('aria-label')).toContain('Gesamt 300,00');
    expect(track.getAttribute('aria-label')).toContain('verbraucht 100,00');
    expect(track.getAttribute('aria-label')).toContain('geplant 100,00');
    const proportions = Array.from(track.children).map(node => parseFloat((node as HTMLElement).style.width));
    expect(proportions.reduce((sum, width) => sum + width, 0)).toBeCloseTo(100, 8);
  });

  it('shows an overplanned budget with the signed amount and actual commitments', async () => {
    await render([model({ usedCents: 25_000, reservedCents: 15_000, availableCents: -10_000, availableHours: 0 })]);
    expect(host.querySelector('.cbv-amount')?.textContent).toContain('-100,00');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('überschreiten das Budget um 100,00');
    expect(host.querySelector('.cbv-breakdown')?.textContent).toContain('250,00');
    expect(host.querySelector('.cbv-breakdown')?.textContent).toContain('150,00');
    const proportions = Array.from(host.querySelector('[role="img"]')!.children).map(node => parseFloat((node as HTMLElement).style.width));
    expect(proportions).toEqual([62.5, 37.5, 0]);
  });

  it('keeps unbooked potential separate and collapsed with a clear preview notice', async () => {
    await render([model(), model({ id: 'umwandlung', title: '40-%-Umwandlung', bookingState: 'preview', enabled: false })]);
    expect(host.querySelectorAll('[aria-label="Gebuchte Leistungen"] article')).toHaveLength(1);
    const opportunity = host.querySelector('details')!;
    expect(opportunity.open).toBe(false);
    expect(opportunity.querySelector('summary')?.textContent).toContain('Nicht gebucht');
    expect(opportunity.querySelector('summary')?.textContent).toContain('mögliches Gesamtbudget');
    await click(opportunity.querySelector('summary')!);
    expect(opportunity.open).toBe(true);
    expect(opportunity.querySelector('.cbv-preview-notice')?.textContent).toContain('noch nicht vereinbart');
    await click(opportunity.querySelector('summary')!);
    expect(opportunity.open).toBe(false);
  });

  it.each(['loading', 'not_eligible'] as const)('does not show placeholder money or hours for %s', async (bookingState) => {
    await render([model({ bookingState, totalCents: 13100, availableCents: 13100, availableHours: 4, statusLabel: 'Daten fehlen', explanation: bookingState === 'loading' ? ['131 € als veralteter Platzhalter'] : ['Voraussetzungen prüfen.'] })]);
    expect(host.querySelector('article')?.textContent).not.toContain('€');
    expect(host.querySelector('summary')?.textContent ?? '').not.toContain('€');
    expect(host.querySelector('.cbv-amount')).toBeNull();
    expect(host.querySelector('.cbv-hours')).toBeNull();
    await click(host.querySelector('button')!);
    expect(host.querySelector('[role="dialog"]')?.textContent).not.toContain('€');
  });

  it('distinguishes a missing usable account from a confirmed zero balance', async () => {
    await render([model({ balanceKnown: false, totalCents: 0, availableCents: 0, availableHours: null, statusLabel: 'Kein Budgetkonto für diesen Zeitraum' })]);
    expect(host.querySelector('.cbv-amount')).toBeNull(); expect(host.querySelector('.cbv-track')).toBeNull();
    expect(host.querySelector('article')?.textContent).toContain('Kein verfügbares Budget bestätigt');
    expect(host.querySelector('article')?.textContent).not.toContain('€');
    await render([model({ balanceKnown: true, totalCents: 0, availableCents: 0, usedCents: 0, reservedCents: 0, availableHours: 0 })]);
    expect(host.querySelector('.cbv-amount')?.textContent).toContain('0,00');
  });

  it('uses a neutral explanation when no unique hourly forecast can be calculated', async () => {
    await render([model({ availableHours: null, hourlyRateCents: null })]);
    expect(host.querySelector('.cbv-hours')?.textContent).toContain('Keine Stundenprognose');
    expect(host.querySelector('.cbv-hours')?.textContent).toContain('Kein eindeutiger Stundensatz');
    expect(host.querySelector('.cbv-hours')?.textContent).not.toContain('hinterlegen');
  });

  it('keeps explanation dialogs functional and preserves source messages', async () => {
    await render([model({ enabled: false, statusLabel: 'Kein Budgetkonto für diesen Zeitraum' })]);
    expect(host.querySelector('.cbv-badge')?.textContent).toBe('Aktivierung offen');
    expect(host.querySelector('.cbv-status')?.textContent).toContain('Kein Budgetkonto');
    await click(host.querySelector('[aria-label="Entlastungsbetrag erklären"]')!);
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Erklärung zum persönlichen Budget');
    const close = Array.from(host.querySelectorAll('button')).find(node => node.textContent === 'Schließen')!;
    await click(close);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('does not invent money or opportunity cards when data is empty', async () => {
    await render([]);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Budgetdaten derzeit nicht verfügbar');
    expect(host.querySelector('article')).toBeNull();
    expect(host.querySelector('details')).toBeNull();
  });

  it('labels the allowance forecast separately from planning', async () => {
    await render([model({ id: 'umwandlung', remainingCareAllowanceCents: 20820 })]);
    expect(host.querySelector('.cbv-allowance')?.textContent).toContain('ohne geplante Einsätze');
    expect(host.querySelector('.cbv-allowance')?.textContent).toContain('208,20');
  });
});
