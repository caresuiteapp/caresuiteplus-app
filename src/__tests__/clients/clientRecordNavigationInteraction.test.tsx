// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientRecordNavigation, ClientRecordMetrics } from '@/components/office/ClientRecordNavigation.web';
import { ClientRecordHero } from '@/components/office/ClientRecordHero.web';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
let host: HTMLDivElement;
function render(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
}
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

describe('Klientenakte web navigation', () => {
  it('changes panel and selection with keyboard and supports Home/End', () => {
    function Fixture() {
      const [tab, setTab] = useState<ClientRecordTabKey>('uebersicht');
      return <ClientRecordNavigation tabs={['uebersicht', 'dokumente', 'portal']} value={tab} onChange={setTab}><p data-testid="content">{tab}</p></ClientRecordNavigation>;
    }
    render(<Fixture />);
    const first = host.querySelector<HTMLButtonElement>('[role=tab]')!;
    act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(host.querySelector('[data-testid=content]')?.textContent).toBe('dokumente');
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true');
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(host.querySelector('[data-testid=content]')?.textContent).toBe('portal');
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(host.querySelector('[data-testid=content]')?.textContent).toBe('uebersicht');
  });
  it('provides unique tab-panel relationships for multiple open records', () => {
    render(<><ClientRecordNavigation tabs={['uebersicht']} value="uebersicht" onChange={vi.fn()}>A</ClientRecordNavigation><ClientRecordNavigation tabs={['uebersicht']} value="uebersicht" onChange={vi.fn()}>B</ClientRecordNavigation></>);
    const tabs = [...host.querySelectorAll('[role=tab]')];
    expect(new Set(tabs.map(tab => tab.id)).size).toBe(2);
    for (const tab of tabs) expect(document.getElementById(tab.getAttribute('aria-controls')!)?.getAttribute('aria-labelledby')).toBe(tab.id);
  });
  it('keeps unavailable destinations informational and uses the actual review count', () => {
    const onChange = vi.fn();
    render(<ClientRecordMetrics documents={8} appointments={2} assignments={19} openItems={3} tabs={['uebersicht', 'dokumente']} onChange={onChange} />);
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons).toHaveLength(2);
    expect(buttons[1].textContent).toContain('Prüfpunkte3');
    act(() => buttons[0].click());
    expect(onChange).toHaveBeenCalledWith('dokumente');
  });
  it('only exposes the edit action when permitted and renders a name as text', () => {
    const onEdit = vi.fn();
    const props = { clientId: 'record', firstName: '<script>', lastName: 'Beispiel', careLevel: null, city: null, status: 'aktiv' as const, careContexts: [], onEdit };
    render(<ClientRecordHero {...props} showEdit={false} />);
    expect(host.querySelector('button')).toBeNull();
    expect(host.querySelector('script')).toBeNull();
    act(() => root!.render(<ClientRecordHero {...props} showEdit />));
    act(() => host.querySelector('button')!.click());
    expect(onEdit).toHaveBeenCalledOnce();
  });
});
