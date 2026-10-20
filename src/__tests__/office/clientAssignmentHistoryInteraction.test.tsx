// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssignmentListItem } from '@/types/modules/assist';

// These doubles test filter interaction; browser layout is checked separately with the real UI.
vi.mock('@/components/ui', () => ({
  SectionPanel: ({ title, subtitle, children }: any) => <section><h2>{title}</h2><p>{subtitle}</p>{children}</section>,
  PremiumCard: ({ children }: any) => <article>{children}</article>,
  PremiumBadge: ({ label }: any) => <span>{label}</span>,
  EmptyState: ({ title, message }: any) => <p>{title} {message}</p>,
  PremiumButton: ({ title, onPress, loading }: any) => <button disabled={loading} onClick={onPress}>{title}</button>,
  SegmentedTabs: ({ tabs, activeKey, onSelect }: any) => <div>{tabs.map((tab: any) => (
    <button key={tab.key} role="tab" aria-selected={activeKey === tab.key} onClick={() => onSelect(tab.key)}>{tab.label}</button>
  ))}</div>,
  ListFilterSelect: ({ value, options, onChange }: any) => <select aria-label="Monat" value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map((option: any) => <option key={option.key} value={option.key}>{option.label}</option>)}
  </select>,
}));

import { ClientAssignmentHistoryPanel } from '@/components/office/ClientAssignmentHistoryPanel';

let root: Root;
let host: HTMLDivElement;
const open = vi.fn();
const refresh = vi.fn();
function assignment(id: string, start: string, assignmentStatus: AssignmentListItem['assignmentStatus'] = 'geplant'): AssignmentListItem {
  return { id, tenantId: 'tenant-1', employeeId: 'employee-1', title: id,
    scheduledStart: start, scheduledEnd: new Date(Date.parse(start) + 3_600_000).toISOString(),
    status: 'aktiv', assignmentStatus, location: '', clientName: 'Testperson', employeeName: 'Begleitung', updatedAt: start };
}
const assignments = [
  assignment('Oktober abgeschlossen', '2026-10-10T08:00:00Z', 'abgeschlossen'),
  assignment('September Unterschrift offen', '2026-09-10T08:00:00Z', 'unterschrift_offen'),
  assignment('September Vorjahr', '2025-09-10T08:00:00Z', 'abgeschlossen'),
  assignment('Einsatz läuft', '2026-10-11T08:00:00Z', 'gestartet'),
  assignment('Geplant', '2026-10-12T08:00:00Z'),
];

async function render(items = assignments, scope = 'client-1') {
  await act(async () => root.render(<ClientAssignmentHistoryPanel key={scope} assignments={items} onOpenAssignment={open} onRefresh={refresh} />));
}
async function click(text: string) {
  const button = [...host.querySelectorAll('button')].find((entry) => entry.textContent?.includes(text));
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}

describe('Klientenakte: vergangene Einsätze nach Monat aufrufen', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T08:30:00Z'));
    vi.clearAllMocks();
    host = document.createElement('div');
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); });

  it('öffnet das vollständige Monatsarchiv, filtert ein Jahr und stellt alle Monate wieder her', async () => {
    await render();
    expect(host.querySelectorAll('article')).toHaveLength(2);
    await click('Vergangene Einsätze');
    expect(host.querySelectorAll('article')).toHaveLength(3);
    expect(host.textContent).toContain('Unterschrift offen');
    const select = host.querySelector('select')!;
    expect([...select.options].map((option) => option.value)).toEqual(['all', '2026-10', '2026-09', '2025-09']);
    await act(async () => { select.value = '2025-09'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect(host.querySelector('article')?.textContent).toContain('September Vorjahr');
    await act(async () => { select.value = 'all'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelectorAll('article')).toHaveLength(3);
    await click('Alle Einsätze');
    expect(host.querySelectorAll('article')).toHaveLength(5);
  });

  it('öffnet den gewählten historischen Einsatz und aktualisiert die Daten', async () => {
    await render();
    await click('Vergangene Einsätze');
    await click('Einsatz ansehen');
    expect(open).toHaveBeenCalledWith(assignments[0]);
    await click('Aktualisieren');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('setzt beim Wechsel der Klientenakte Ansicht und Monatsfilter zurück', async () => {
    await render();
    await click('Vergangene Einsätze');
    const select = host.querySelector('select')!;
    await act(async () => { select.value = '2025-09'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await render([assignments[4]], 'client-2');
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Aktuell & geplant');
    expect(host.querySelector('select')?.value).toBe('all');
    expect(host.querySelectorAll('article')).toHaveLength(1);
    expect(host.textContent).not.toContain('September Vorjahr');
  });

  it('zeigt einen verständlichen Leerzustand und hält die Archivfilter bedienbar', async () => {
    await render([]);
    await click('Vergangene Einsätze');
    expect(host.textContent).toContain('Keine vergangenen Einsätze');
    await click('Alle Einsätze');
    expect(host.textContent).toContain('noch keine Einsätze gespeichert');
  });
});
