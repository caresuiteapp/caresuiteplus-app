// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CompanyRegistrationSelect } from '@/liquid-command/components/CompanyRegistrationSelect.web';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
function Form({ initial = '', kind = 'legal_form' }: { initial?: string; kind?: 'legal_form' | 'contact_function' }) {
  const [value, setValue] = useState(initial);
  return <><CompanyRegistrationSelect kind={kind} label={kind === 'contact_function' ? 'Funktion' : 'Rechtsform'} value={value} onChange={setValue} /><output>{value}</output></>;
}
async function select(key: string) {
  await act(async () => { const el = host.querySelector('select')!; el.value = key; el.dispatchEvent(new Event('change', { bubbles: true })); });
}
it('starts without a preselected legal form and binds its accessible label to the real select', async () => {
  await act(async () => root.render(<Form />));
  expect(host.querySelector('select')!.value).toBe('');
  expect(host.querySelector('label')!.htmlFor).toBe(host.querySelector('select')!.id);
  await select('ug');
  expect(host.querySelector('output')!.textContent).toBe('UG (haftungsbeschränkt)');
});
it('restores known old spellings while requiring an explicit decision for unknown drafts', async () => {
  await act(async () => root.render(<Form initial="UG" />));
  expect(host.querySelector('select')!.value).toBe('ug');
  await act(async () => root.render(<Form key="legacy" initial="Alte individuelle Rechtsform" />));
  expect(host.querySelector('select')!.value).toBe('');
  expect(host.textContent).toContain('Bisherige Angabe: Alte individuelle Rechtsform');
});
it('requires a separate explanation for other and removes it after a catalog selection', async () => {
  await act(async () => root.render(<Form />));
  await select('sonstige');
  expect(host.querySelector('input')!.required).toBe(true);
  expect(host.querySelector('output')!.textContent).toBe('Sonstige: ');
  await select('gmbh');
  expect(host.querySelector('input')).toBeNull();
  expect(host.querySelector('output')!.textContent).toBe('GmbH');
});

it('uses the existing contact function and writes the selected canonical label', async () => {
  await act(async () => root.render(<Form kind="contact_function" initial="Geschäftsführung" />));
  expect(host.querySelector('select')!.value).toBe('geschaeftsfuehrung');
  expect(host.querySelector('label')!.textContent).toContain('Funktion');
  await select('pflegedienstleitung');
  expect(host.querySelector('output')!.textContent).toBe('Pflegedienstleitung (PDL)');
});
it('provides a function-specific description for other and retains old unclassified text', async () => {
  await act(async () => root.render(<Form kind="contact_function" initial="Frühere individuelle Funktion" />));
  expect(host.textContent).toContain('Frühere individuelle Funktion');
  await select('sonstige');
  expect(host.textContent).toContain('Andere Funktion angeben');
  expect(host.querySelector('input')!.value).toBe('');
});
