// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpCenterView } from '@/components/help/HelpCenterView.web';
import type { HelpState } from '@/features/help/helpTypes';
let host: HTMLDivElement; let root: Root;
const navigate = vi.fn(); const open = vi.fn(); const close = vi.fn();
function Harness({ initial = {} }: { initial?: HelpState }) {
  const [state, setState] = useState<HelpState>(initial);
  return <HelpCenterView state={state} onNavigate={value => { navigate(value); setState(value); }} onOpenRoute={open} onClose={close}/>;
}
function button(text: string) { return Array.from(host.querySelectorAll('button')).find(node => node.textContent?.includes(text))!; }
async function click(text: string) { await act(async () => button(text).click()); }
async function render(initial: HelpState = {}) { await act(async () => root.render(<Harness initial={initial}/>)); }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('help reading experience', () => {
  it('opens search results, a relevant article and the existing application destination', async () => {
    await render(); await click('Logo hochladen');
    expect(host.textContent).toContain('Suchergebnisse');
    await click('Logo, Briefkopf und Dokumentlayout einstellen');
    expect(host.querySelector('h1')?.textContent).toBe('Logo, Briefkopf und Dokumentlayout einstellen');
    expect(host.textContent).toContain('Briefkopf & Layout');
    await click('Bereich öffnen'); expect(open).toHaveBeenCalledWith('/business/templates/ci-layout');
    await click('Zurück zur Arbeit'); expect(close).toHaveBeenCalledOnce();
  });
  it('retains filter context while reading and returning to a topic', async () => {
    await render({ category: 'planung', audience: 'verwaltung', q: 'Verfügbarkeiten' });
    await click('Verfügbarkeiten und Abwesenheiten im Kalender pflegen');
    await click('Zur Themenübersicht');
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'planung', audience: 'verwaltung', q: 'Verfügbarkeiten', article: undefined }));
    expect(host.querySelector<HTMLInputElement>('input[type=search]')?.value).toBe('Verfügbarkeiten');
  });
  it('opens direct links, keeps reading checkboxes local and resets them for another article', async () => {
    await render({ article: 'dokument-logo' });
    const checkbox = host.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    await act(async () => checkbox.click()); expect(checkbox.checked).toBe(true);
    expect(open).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    await click('Unternehmensdaten und Kontaktangaben pflegen');
    expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBe(false);
  });
  it('offers a recovery for unknown articles and empty searches', async () => {
    await render({ article: 'unknown-topic' }); expect(host.textContent).toContain('Anleitung nicht gefunden');
    await click('Hilfeübersicht öffnen'); expect(host.textContent).toContain('Was möchten Sie erledigen?');
  });
  it('does not leave the user with a dead end when no filters match', async () => {
    await render({ category: 'planung', audience: 'klienten', q: 'Verfügbarkeit' });
    expect(host.textContent).toContain('Keine passende Anleitung gefunden');
    await click('In allen Themen suchen');
    expect(host.textContent).toContain('Verfügbarkeiten und Abwesenheiten');
  });
  it('shows a selectable direct link when clipboard access is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await render({ article: 'dokument-logo' }); await click('Link kopieren');
    expect(host.querySelector<HTMLInputElement>('input[readonly]')?.value).toContain('/hilfe?artikel=dokument-logo');
    expect(host.textContent).toContain('Bitte den angezeigten Link');
  });
});
