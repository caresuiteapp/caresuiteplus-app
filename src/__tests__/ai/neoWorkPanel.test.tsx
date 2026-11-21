// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NeoWorkPanel, type NeoWorkPanelProps } from '@/ai/neo/NeoWorkPanel';
import type { NeoSegment } from '@/ai/neo/neoDomain';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const api = vi.hoisted(() => ({ push: vi.fn(), can: true }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => api.can }) }));
vi.mock('@/ai/neo/neoUi', () => ({ PremiumButton: (p: any) => <button type="button" disabled={p.disabled} onClick={p.onPress}>{p.title}</button>, PremiumInput: (p: any) => <input aria-label={p.label} value={p.value} disabled={p.editable === false} onChange={e => p.onChangeText(e.target.value)} /> }));
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
const segments: NeoSegment[] = [{ id: '44444444-4444-4444-8444-444444444444', text: 'Ich habe keine Schmerzen.', role: 'person', speaker: 'Klient', startedAt: 1, endedAt: 2 }];
let host: HTMLDivElement, root: Root, props: NeoWorkPanelProps;
beforeEach(async () => { vi.resetAllMocks(); api.can = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); props = { scope, segments }; await render(); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(change: Partial<NeoWorkPanelProps> = {}) { props = { ...props, ...change }; await act(async () => root.render(<NeoWorkPanel {...props} />)); }
async function click(label: string) { const button = [...host.querySelectorAll('button')].find(item => item.textContent === label); expect(button, label).toBeTruthy(); await act(async () => button!.click()); }
describe('NEO workbench review interactions', () => {
  it('requires review before handing an exact handover draft to documentation and clears only after acceptance', async () => {
    const prepared = vi.fn(), pending = vi.fn(); await render({ onPrepared: prepared, onPendingChange: pending });
    await click('Übergabe'); await click('Entwurf aus Gespräch vorbereiten'); expect(host.textContent).toContain('Ich habe keine Schmerzen.');
    expect(host.textContent).not.toContain('Geprüften Entwurf übernehmen'); expect(prepared).not.toHaveBeenCalled();
    await click('Entwurf nach Sichtprüfung bestätigen'); await click('Geprüften Entwurf übernehmen');
    expect(prepared).toHaveBeenCalledOnce(); expect(prepared.mock.calls[0][1]).toContain('Ich habe keine Schmerzen.'); expect(pending).toHaveBeenLastCalledWith(false);
  });
  it('keeps a changed quotation from being confirmed or handed off', async () => {
    const prepared = vi.fn(); await render({ onPrepared: prepared }); await click('Übergabe'); await click('Entwurf aus Gespräch vorbereiten');
    await render({ segments: [{ ...segments[0], text: 'Ich habe Schmerzen.' }] }); await click('Entwurf nach Sichtprüfung bestätigen');
    expect(host.textContent).toContain('Gesprächsbeleg wurde geändert'); expect(prepared).not.toHaveBeenCalled();
  });
  it('takes a directed request into preparation without creating or confirming work automatically', async () => {
    await render({ directedCommand: { id: 'command-1', text: 'NEO, fasse das Gespräch zusammen' } });
    expect(host.textContent).toContain('Auftrag erkannt'); expect(host.querySelector('[aria-label="Zuständige Person, ausdrücklich bestätigt"]')).toBeNull();
    expect(host.textContent).not.toContain('Entwurf nach Sichtprüfung bestätigen'); expect(api.push).not.toHaveBeenCalled();
  });
  it('prefills only explicitly stated fields from a directed task request', async () => {
    await render({ directedCommand: { id: 'fields-1', text: 'NEO, erstelle eine Aufgabe: Rollator besorgen. Zuständig: Pflegekraft. Fällig: 25.11.2026' } });
    expect((host.querySelector('[aria-label="Titel des Entwurfs"]') as HTMLInputElement).value).toBe('Rollator besorgen');
    expect((host.querySelector('[aria-label="Zuständige Person, ausdrücklich bestätigt"]') as HTMLInputElement).value).toBe('Pflegekraft');
    expect((host.querySelector('[aria-label="Fällig am (JJJJ-MM-TT)"]') as HTMLInputElement).value).toBe('2026-11-25');
    expect(host.textContent).not.toContain('Entwurf nach Sichtprüfung bestätigen');
  });
  it('preserves current fields until the queued request is selected, then clears omitted fields', async () => {
    await render({ directedCommand: { id: 'fields-1', text: 'Aufgabe: Arztbericht prüfen. Zuständig: Maria. Fällig: 25.11.2026' } });
    await render({ directedCommand: { id: 'fields-2', text: 'Erstelle eine Aufgabe: Rollator für Peter besorgen' } });
    expect((host.querySelector('[aria-label="Zuständige Person, ausdrücklich bestätigt"]') as HTMLInputElement).value).toBe('Maria');
    await click('Arbeitsentwurf verwerfen'); await click('Nächsten Arbeitsauftrag vorbereiten');
    expect((host.querySelector('[aria-label="Titel des Entwurfs"]') as HTMLInputElement).value).toBe('Rollator für Peter besorgen');
    expect((host.querySelector('[aria-label="Zuständige Person, ausdrücklich bestätigt"]') as HTMLInputElement).value).toBe('');
    expect((host.querySelector('[aria-label="Fällig am (JJJJ-MM-TT)"]') as HTMLInputElement).value).toBe('');
  });
  it('queues further requests without destroying the current evidence draft and deduplicates command events', async () => {
    await click('Übergabe'); await click('Entwurf aus Gespräch vorbereiten');
    const next = { id: 'command-2', text: 'NEO, bereite eine Wiedervorlage vor' };
    await render({ directedCommand: next }); await render({ directedCommand: { ...next } });
    expect(host.textContent).toContain('1 weiterer Arbeitsauftrag wartet'); expect(host.textContent).toContain('Ich habe keine Schmerzen.');
    await click('Nächsten Arbeitsauftrag vorbereiten'); expect(host.textContent).toContain('Entwurf nach Sichtprüfung bestätigen');
    await click('Arbeitsentwurf verwerfen'); await click('Nächsten Arbeitsauftrag vorbereiten');
    expect(host.textContent).toContain(next.text); expect(host.textContent).not.toContain('Entwurf nach Sichtprüfung bestätigen');
    expect(host.querySelector('[aria-label="Zuständige Person, ausdrücklich bestätigt"]')).toBeTruthy();
  });
  it('clears previous case evidence and drafts on a subject change', async () => {
    await click('Übergabe'); await click('Entwurf aus Gespräch vorbereiten');
    await render({ scope: { ...scope, subjectId: '55555555-5555-4555-8555-555555555555' }, segments: [] });
    expect(host.textContent).not.toContain('Ich habe keine Schmerzen.'); expect(host.textContent).not.toContain('Entwurf nach Sichtprüfung bestätigen');
  });
  it('opens only the known tasks route with a case ID and no source text, after rechecking permission', async () => {
    await click('Vorhandene Aufgabenplanung öffnen'); expect(api.push).toHaveBeenCalledWith({ pathname: '/pflege/aufgaben', params: { clientId: scope.subjectId } });
    api.can = false; await click('Vorhandene Aufgabenplanung öffnen'); expect(api.push).toHaveBeenCalledOnce();
    await render(); expect(host.textContent).not.toContain('Vorhandene Aufgabenplanung öffnen');
  });
});
