// @vitest-environment happy-dom
import React, { act, useCallback, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Drawer } from 'vaul';
import { AssistLiveFilterSelect } from '@/components/assist/AssistLiveFilterSelect.web';

type Option = { value: string; label: string };
const OPTIONS: Option[] = [
  { value: '', label: 'Alle Mitarbeitenden' },
  { value: 'employee-a', label: 'Alex Beispiel' },
  { value: 'employee-b', label: 'Bea Muster' },
];
const changed = vi.fn();
let host: HTMLDivElement;
let root: Root;

// Expo's transparentModal uses this real Vaul/Radix focus trap. A plain mocked
// ScreenShell would miss interactions between the dropdown and its modal host.
function Workspace({ options }: { options: readonly Option[] }) {
  const [value, setValue] = useState('');
  const [ticks, setTicks] = useState(0);
  const onChange = useCallback((next: string) => { setValue(next); changed(next); }, []);
  useEffect(() => { const timer = setInterval(() => setTicks(count => count + 1), 1_000); return () => clearInterval(timer); }, []);
  return <Drawer.Root defaultOpen autoFocus dismissible={false}>
    <Drawer.Portal><Drawer.Content aria-describedby="filter-test-description">
      <Drawer.Title>Live-Status</Drawer.Title>
      <Drawer.Description id="filter-test-description">Einsätze und Filter</Drawer.Description>
      <output aria-label="Aktualisierungen">{ticks}</output>
      <AssistLiveFilterSelect className="ls-field" label="Mitarbeitende" ariaLabel="Mitarbeitende filtern" value={value} options={options} onChange={onChange} />
      <button type="button">Anderes Feld</button>
    </Drawer.Content></Drawer.Portal>
  </Drawer.Root>;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  changed.mockReset();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => { root.unmount(); vi.runOnlyPendingTimers(); });
  host.remove(); vi.useRealTimers(); vi.restoreAllMocks();
});
const render = async (options: readonly Option[] = OPTIONS) => {
  await act(async () => root.render(<Workspace options={options} />));
  await act(async () => vi.advanceTimersByTime(0));
};
const trigger = () => document.querySelector<HTMLButtonElement>('[role="combobox"][aria-label="Mitarbeitende filtern"]')!;
const list = () => document.querySelector<HTMLElement>('[role="listbox"]');
const option = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(element => element.textContent?.trim() === label)!;
const click = async (element: HTMLElement) => {
  expect(element).toBeTruthy();
  await act(async () => {
    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 });
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    element.dispatchEvent(pointerDown);
    if (!pointerDown.defaultPrevented) element.dispatchEvent(mouseDown);
    if (!pointerDown.defaultPrevented && !mouseDown.defaultPrevented) element.focus();
    element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
    element.click();
  });
};
const key = async (value: string) => {
  const target = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : trigger();
  await act(async () => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })));
};

describe('Live filter inside the real web modal focus boundary', () => {
  it('keeps the open list and focus usable through timer ticks and fresh options', async () => {
    await render();
    const control = trigger();
    await click(control);
    const openList = list();
    expect(openList).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')?.contains(openList)).toBe(true);
    await act(async () => vi.advanceTimersByTime(5_000));
    expect(document.querySelector('[aria-label="Aktualisierungen"]')?.textContent).toBe('5');
    expect(trigger()).toBe(control);
    expect(control.getAttribute('aria-expanded')).toBe('true');
    expect(list()).toBe(openList);
    await render(OPTIONS.map(entry => ({ ...entry })));
    expect(list()).toBe(openList);
    await render([OPTIONS[0], OPTIONS[1], { value: 'employee-b', label: 'Bea Umbenannt' }, { value: 'employee-c', label: 'Clara Neu' }]);
    expect(control.getAttribute('aria-expanded')).toBe('true');
    expect(option('Bea Umbenannt')).toBeTruthy();
    await click(option('Clara Neu'));
    expect(changed).toHaveBeenLastCalledWith('employee-c');
    expect(control.textContent).toContain('Clara Neu');
    expect(list()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('supports Arrow keys, Home, End, Enter and Space without dismissing the modal', async () => {
    await render();
    trigger().focus();
    await key('ArrowDown');
    expect(list()).toBeTruthy();
    await key('Home'); await key('ArrowDown'); await key('Enter');
    expect(changed).toHaveBeenLastCalledWith('employee-a');
    expect(list()).toBeNull();
    await key(' ');
    expect(list()).toBeTruthy();
    await key('End'); await key('ArrowUp'); await key(' ');
    expect(changed).toHaveBeenLastCalledWith('employee-a');
    expect(list()).toBeNull();
    await key('Enter'); await key('End'); await key('Enter');
    expect(changed).toHaveBeenLastCalledWith('employee-b');
    await key('ArrowUp'); await key('Home'); await key('Enter');
    expect(changed).toHaveBeenLastCalledWith('');
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
  });

  it('closes only the list on Escape and lets Tab or another field end the selection', async () => {
    await render();
    await click(trigger()); await key('Escape');
    expect(list()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(document.activeElement).toBe(trigger());
    expect(changed).not.toHaveBeenCalled();
    await click(trigger()); await key('Tab');
    expect(list()).toBeNull();
    await click(trigger());
    const other = [...document.querySelectorAll<HTMLButtonElement>('button')].find(element => element.textContent === 'Anderes Feld')!;
    await click(other);
    expect(list()).toBeNull();
    expect(document.activeElement).toBe(other);
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not cancel wheel scrolling or close the list while browsing many employees', async () => {
    const many = [OPTIONS[0], ...Array.from({ length: 40 }, (_, index) => ({ value: `employee-${index}`, label: `Mitarbeitende ${index}` }))];
    await render(many); await click(trigger());
    const openList = list()!;
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    await act(async () => {
      openList.dispatchEvent(wheel);
      openList.scrollTop = 120;
      openList.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(wheel.defaultPrevented).toBe(false);
    expect(list()).toBe(openList);
    expect(openList.scrollTop).toBe(120);
    await click(option('Mitarbeitende 39'));
    expect(changed).toHaveBeenLastCalledWith('employee-39');
  });
});
