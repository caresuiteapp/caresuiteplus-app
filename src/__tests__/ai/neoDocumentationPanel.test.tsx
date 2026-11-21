// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NeoDocumentationPanel } from '@/ai/neo/NeoDocumentationPanel';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const api = vi.hoisted(() => ({ callbacks: null as any, start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), check: vi.fn(), analyze: vi.fn(), read: vi.fn() }));
vi.mock('@/ai/neo/neoUi', () => ({
  PremiumButton: (p: any) => <button type="button" disabled={p.disabled} onClick={p.onPress}>{p.title}</button>,
  PremiumInput: (p: any) => <label>{p.label}<textarea value={p.value} disabled={p.editable === false} onChange={e => p.onChangeText?.(e.target.value)} /></label>,
}));
vi.mock('@/ai/neo/neoCapture', () => ({ createNeoCapture: (_: unknown, callbacks: any) => { api.callbacks = callbacks; return { start: api.start, stop: api.stop, cancel: api.cancel }; } }));
vi.mock('@/ai/neo/neoGateway', () => ({ checkNeoService: api.check, requestNeoModelDraft: api.analyze, transcribeNeoAudio: vi.fn() }));
vi.mock('@/ai/neo/neoRecording', () => ({ readNeoRecording: api.read }));
const scope = { tenantId: '11111111-1111-4111-8111-111111111111', actorId: '22222222-2222-4222-8222-222222222222', subjectId: '33333333-3333-4333-8333-333333333333' };
let root: Root, host: HTMLDivElement; const apply = vi.fn();
beforeEach(() => { vi.resetAllMocks(); api.check.mockResolvedValue(true); api.start.mockImplementation(async () => api.callbacks.onStatus('listening')); api.stop.mockResolvedValue(undefined); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(props: Record<string, unknown> = {}) { await act(async () => root.render(<NeoDocumentationPanel scope={scope} onApply={apply} {...props} />)); }
async function click(label: string) { const button = [...host.querySelectorAll('button,[role=button]')].find(el => el.textContent?.trim() === label || el.getAttribute('aria-label') === label) as HTMLButtonElement; expect(button, label).toBeTruthy(); await act(async () => button.click()); }
async function consent() { await act(async () => (host.querySelector('[role=checkbox]') as HTMLButtonElement).click()); }
describe('NEO quiet documentation interaction', () => {
  it('requires explicit consent and never applies unreviewed transcript', async () => {
    await render(); await click('NEO-Sprachbegleitung'); await click('Still zuhören'); expect(api.start).not.toHaveBeenCalled();
    await consent(); await click('Still zuhören'); expect(api.start).toHaveBeenCalledTimes(1);
    await act(async () => api.callbacks.onText('Ich habe keine Schmerzen.', 100, 200)); expect(apply).not.toHaveBeenCalled();
    await click('Aufnahme abschließen'); await click('Angaben zuordnen'); await click('Geprüfte Angaben in den Entwurf übernehmen'); expect(apply).not.toHaveBeenCalled();
    await click('Geprüft übernehmen'); await click('Geprüfte Angaben in den Entwurf übernehmen'); await click('Geprüfte Angaben in den Entwurf übernehmen');
    expect(apply).toHaveBeenCalledTimes(1); expect(apply.mock.calls[0][0].facts[0]).toMatchObject({ status: 'negated', decision: 'accepted', quote: 'Ich habe keine Schmerzen.' });
  });
  it('cancels capture on revoked consent, disabled access, subject change and unmount; late results are ignored', async () => {
    await render(); await click('NEO-Sprachbegleitung'); await consent(); await click('Still zuhören'); const old = api.callbacks;
    await click('Sofort stoppen / Freigabe widerrufen'); expect(api.cancel).toHaveBeenCalled();
    await act(async () => old.onText('Geheimer alter Wortlaut', 100, 200)); expect(host.textContent).not.toContain('Geheimer alter Wortlaut');
    await consent(); await click('Still zuhören'); await render({ disabled: true }); expect(api.cancel.mock.calls.length).toBeGreaterThan(1);
    await render({ scope: { ...scope, subjectId: scope.actorId } }); await click('NEO-Sprachbegleitung'); expect(host.textContent).not.toContain('Erkannter Wortlaut');
    expect((host.querySelector('[role=checkbox]') as HTMLElement).getAttribute('aria-checked')).toBe('false');
  });
  it('does not hide the active microphone when the panel heading is clicked', async () => {
    await render(); await click('NEO-Sprachbegleitung'); await consent(); await click('Still zuhören'); await click('NEO-Sprachbegleitung'); expect(host.textContent).toContain('Aufnahme abschließen');
  });
});
