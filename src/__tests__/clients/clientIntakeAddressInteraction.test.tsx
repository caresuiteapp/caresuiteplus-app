// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ search: vi.fn(), changed: vi.fn() }));
vi.mock('@/lib/geo/addressAutocompleteService', () => ({ ADDRESS_SEARCH_MIN_QUERY_LENGTH: 3, searchGermanAddresses: h.search }));
vi.mock('@/theme', () => ({ colors: {}, radius: {}, spacing: {}, typography: {} }));
vi.mock('react-native', async () => {
  const react = await import('react'); const Container = ({ children }: any) => react.createElement('div', null, children);
  return { View: Container, Text: Container, ScrollView: Container, StyleSheet: { create: (s: any) => s }, ActivityIndicator: () => null,
    Pressable: ({ children, onPress }: any) => react.createElement('button', { onClick: onPress }, children) };
});
vi.mock('@/components/ui', () => ({ PremiumInput: ({ label, value, onChangeText, onFocus, onBlur }: any) => <input aria-label={label} value={value} onInput={(e: any) => onChangeText(e.target.value)} onFocus={onFocus} onBlur={onBlur} /> }));
import { CareAddressSearch } from '@/components/inputs/CareAddressSearch';
let host: HTMLDivElement, root: Root;
const address = { street: '', houseNumber: '', zip: '', city: '' };
function deferred() { let resolve!: (value: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; }
async function query(value: string) { await act(async () => { const input = host.querySelector('input')!; input.focus(); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }); }
beforeEach(async () => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); vi.clearAllMocks(); h.search.mockResolvedValue({ ok: true, data: [] }); host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(<CareAddressSearch values={address} onChange={h.changed} />)); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); });
describe('address search real input lifecycle', () => {
  it('immediately cancels an old request when the query changes before the next debounce', async () => {
    const old = deferred(); h.search.mockReturnValueOnce(old.promise); await query('Berlin');
    await act(async () => vi.advanceTimersByTime(350)); const signal = h.search.mock.calls[0][1].signal;
    await query('Bonn'); expect(signal.aborted).toBe(true);
    await act(async () => old.resolve({ ok: true, data: [{ id: 'old', label: 'Alt Berlin', ...address }] }));
    expect(host.textContent).not.toContain('Alt Berlin');
  });
  it('recovers from unexpected search rejection and keeps manual entry usable', async () => {
    h.search.mockRejectedValueOnce(new Error('network')); await query('Berlin'); await act(async () => vi.advanceTimersByTime(350));
    expect(host.textContent).toContain('manuell ausgefüllt');
    const street = host.querySelector('[aria-label="Straße *"]') as HTMLInputElement;
    await act(async () => { street.value = 'Manuell'; street.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(h.changed).toHaveBeenLastCalledWith({ ...address, street: 'Manuell' });
  });
  it('copies all four fields of the actually selected suggestion', async () => {
    const selected = { id: 'chosen', label: 'Hauptstraße 12, 10115 Berlin', street: 'Hauptstraße', houseNumber: '12', zip: '10115', city: 'Berlin' };
    h.search.mockResolvedValue({ ok: true, data: [selected] }); await query('Haupt'); await act(async () => vi.advanceTimersByTime(350));
    await act(async () => (host.querySelector('button') as HTMLButtonElement).click());
    expect(h.changed).toHaveBeenLastCalledWith({ street: selected.street, houseNumber: selected.houseNumber, zip: selected.zip, city: selected.city });
  });
});
