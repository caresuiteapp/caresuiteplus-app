// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpCenterScreen } from '@/screens/help/HelpCenterScreen.web';
const api = vi.hoisted(() => ({ params: {} as Record<string, string | string[]>, setParams: vi.fn(), push: vi.fn(), close: vi.fn() }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => api.params, useRouter: () => ({ setParams: api.setParams, push: api.push }) }));
vi.mock('@/components/layout/ScreenShell.web', () => ({ ScreenShell: ({ children }: React.PropsWithChildren) => children }));
vi.mock('@/hooks/useWebBackNavigation.web', () => ({ useWebBackNavigation: () => api.close }));
let host: HTMLDivElement; let root: Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); api.params = {}; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function click(text: string) { await act(async () => [...host.querySelectorAll('button')].find(node => node.textContent?.includes(text))!.click()); }
describe('help route integration', () => {
  it('restores a directly linked article and uses the existing close history', async () => {
    api.params = { artikel: ['dokument-logo'] };
    await act(async () => root.render(<HelpCenterScreen/>));
    expect(host.querySelector('h1')?.textContent).toBe('Logo, Briefkopf und Dokumentlayout einstellen');
    await click('Zurück zur Arbeit'); expect(api.close).toHaveBeenCalledOnce();
  });
  it('updates topic parameters in the same help entry instead of pushing another work window', async () => {
    await act(async () => root.render(<HelpCenterScreen/>)); await click('Logo hochladen');
    expect(api.setParams).toHaveBeenCalledWith({ artikel: '', thema: '', zielgruppe: '', q: 'Logo hochladen' });
    expect(api.push).not.toHaveBeenCalled();
  });
  it('prints a complete standalone article with expanded answers', async () => {
    const print = vi.fn(); const popup = { document: document.implementation.createHTMLDocument(), focus: vi.fn(), print, opener: window };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    api.params = { artikel: 'dokument-logo' };
    await act(async () => root.render(<HelpCenterScreen/>)); await click('Drucken / PDF');
    expect(popup.document.querySelector('h1')?.textContent).toBe('Logo, Briefkopf und Dokumentlayout einstellen');
    expect(popup.document.querySelector('details')?.open).toBe(true);
    expect(popup.document.querySelector('button')).toBeNull();
    expect(print).toHaveBeenCalledOnce(); open.mockRestore();
  });
});
