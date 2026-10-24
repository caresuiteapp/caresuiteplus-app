// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Platform: { OS: 'android' }, StyleSheet: { create: (s: unknown) => s }, View: ({ children }: any) => <div>{children}</div>, ScrollView: ({ children }: any) => <div>{children}</div>, Text: ({ children }: any) => <span>{children}</span>,
  TextInput: (p: any) => <input aria-label={p.accessibilityLabel} value={p.value} onInput={event => p.onChangeText(event.currentTarget.value)} />,
  Pressable: (p: any) => <button aria-label={p.accessibilityLabel} role={p.accessibilityRole} aria-checked={p.accessibilityState?.checked} disabled={p.disabled} onClick={p.onPress}>{p.children}</button>,
}));
import { CalendarEmployeeMultiSelect } from '@/components/calendar/CalendarEmployeeMultiSelect';
const options = [{ value: 'one', label: 'Anna Beispiel' }, { value: 'two', label: 'Tom Team' }];
const changed = vi.fn();
function Form({ disabled = false }: { disabled?: boolean }) { const [values, setValues] = useState<string[]>([]); return <CalendarEmployeeMultiSelect values={values} options={options} disabled={disabled} onChange={next => { changed(next); setValues(next); }} />; }
let host: HTMLDivElement, root: Root;
const click = async (label: string) => { await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click()); };
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; changed.mockClear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('native calendar participant selection', () => {
  it('retains multiple selected IDs and removes a person independently', async () => {
    await act(async () => root.render(<Form />)); await click('Anna Beispiel'); await click('Tom Team'); expect(changed).toHaveBeenLastCalledWith(['one', 'two']);
    await click('Anna Beispiel aus Auswahl entfernen'); expect(changed).toHaveBeenLastCalledWith(['two']); expect(host.textContent).toContain('1 Person ausgewählt');
  });
  it('adds the complete team without duplicates and clears it', async () => {
    await act(async () => root.render(<Form />)); await click('Anna Beispiel'); await click('Alle Mitarbeitenden auswählen'); expect(changed).toHaveBeenLastCalledWith(['one', 'two']);
    await click('Mitarbeitendenauswahl aufheben'); expect(changed).toHaveBeenLastCalledWith([]);
  });
  it('does not change a locked form', async () => { await act(async () => root.render(<Form disabled />)); await click('Tom Team'); await click('Alle Mitarbeitenden auswählen'); expect(changed).not.toHaveBeenCalled(); });
});
