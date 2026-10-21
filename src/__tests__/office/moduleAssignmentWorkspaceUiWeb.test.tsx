// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModuleAssignmentSection } from '@/lib/officeCore/types';
import type { ModuleAssignmentWorkspaceItem, ModuleAssignmentWorkspaceSnapshot } from '@/lib/officeModules/moduleAssignmentWorkspaceService.web';

// The real React DOM and event handlers are exercised. This is not a layout or
// visual acceptance test; only the image loader is replaced.
vi.mock('@/liquid-command/components/DesktopCatalogArtwork.web', () => ({
  DesktopCatalogArtwork: ({ route }: { route: string }) => <span data-artwork-route={route} aria-hidden="true" />,
}));
import { ModuleAssignmentsWorkspace, type ModuleAssignmentsWorkspaceProps } from '@/screens/business/office/ModuleAssignmentsWorkspace.web';

const sectionKeys: ModuleAssignmentSection[] = ['clients', 'employees', 'services', 'documents', 'templates', 'permissions', 'billing'];
const inventoryActions = {
  clients: { label: 'Klientenverwaltung öffnen', route: '/business/office/clients' },
  employees: { label: 'Personalverwaltung öffnen', route: '/office/employees' },
  services: { label: 'Leistungskatalog öffnen', route: '/office/catalogs' },
  documents: { label: 'Aktenunterlagen öffnen', route: '/business/office/documents' },
  templates: { label: 'Dokumentenkatalog öffnen', route: '/business/office/document-catalog' },
  permissions: { label: 'Personalakten & Rechte öffnen', route: '/office/employees' },
  billing: { label: 'Rechnungen öffnen', route: '/office/invoices' },
} as const;

function item(index: number, overrides: Partial<ModuleAssignmentWorkspaceItem> = {}): ModuleAssignmentWorkspaceItem {
  return { id: `assignment-${index}`, title: `Person ${String(index).padStart(2, '0')}`, subtitle: 'Gespeicherte Zuordnung', moduleKey: 'assist', status: 'aktiv', active: true,
    actions: [{ label: 'Klientenakte öffnen', route: `/office/clients/client-${index}?tab=portal` }], ...overrides };
}
function snapshot(section: ModuleAssignmentSection | null = null, items: ModuleAssignmentWorkspaceItem[] = []): ModuleAssignmentWorkspaceSnapshot {
  return { tenantId: 'tenant-a', tenantName: 'Unternehmen Sonnenweg', source: 'live', loadedAt: '2026-10-21T10:00:00Z', section, items, warnings: [],
    sections: sectionKeys.map(key => ({ key, state: 'ready', count: key === section ? items.length : 0, activeCount: key === section ? items.filter(row => row.active).length : 0,
      action: key === 'clients' ? { label: 'Klientenverwaltung öffnen', route: '/business/office/clients' } : null,
      inventory: { state: 'ready', count: key === 'documents' ? 100 : key === 'templates' ? 450 : key === 'clients' ? 12 : 0, action: inventoryActions[key] } })),
  };
}
let host: HTMLDivElement, root: Root, props: ModuleAssignmentsWorkspaceProps;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  props = { data: snapshot(), loading: false, error: null, roleLabel: 'Verwaltung', onRefresh: vi.fn(), onOpen: vi.fn() };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(overrides: Partial<ModuleAssignmentsWorkspaceProps> = {}) { props = { ...props, ...overrides }; await act(async () => root.render(<ModuleAssignmentsWorkspace {...props} />)); }
function button(label: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(node => node.getAttribute('aria-label') === label || node.textContent?.trim() === label);
  expect(found, `Button: ${label}`).toBeTruthy(); return found!;
}
function select(label: string) {
  const found = [...host.querySelectorAll('label')].find(node => node.querySelector('span')?.textContent === label)?.querySelector<HTMLSelectElement>('select');
  expect(found, `Select: ${label}`).toBeTruthy(); return found!;
}
function search() { return host.querySelector<HTMLInputElement>('input[type=search]')!; }
function rows() { return [...host.querySelectorAll<HTMLTableRowElement>('tbody tr')]; }
async function click(node: HTMLElement) { await act(async () => node.click()); }
async function change(node: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => {
    const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
function card(title: string) {
  const found = [...host.querySelectorAll('article')].find(node => node.querySelector('h3')?.textContent === title);
  expect(found, `Card: ${title}`).toBeTruthy(); return found!;
}

describe('module assignment hub interactions', () => {
  it('shows seven artwork cards and keeps saved zeroes distinct from unreadable counts', async () => {
    const data = snapshot();
    data.sections[0] = { ...data.sections[0], count: 1240, activeCount: 1234 };
    data.sections[2] = { ...data.sections[2], state: 'error', count: null, activeCount: null, action: null, error: 'Leistungen nicht abrufbar.', inventory: { state: 'error', count: null, error: 'Bestand nicht abrufbar.', action: null } };
    data.sections[5] = { ...data.sections[5], state: 'restricted', count: null, activeCount: null, action: null, inventory: { state: 'restricted', count: null, action: null } };
    await render({ data });
    expect(host.querySelectorAll('article')).toHaveLength(7);
    expect(host.querySelectorAll('[data-artwork-route]')).toHaveLength(7);
    expect(card('Leistungskatalog').querySelector('[data-artwork-route]')?.getAttribute('data-artwork-route')).toBe('/business/office/catalogs');
    expect(card('Klient:innen-Zuordnung').textContent).toContain('1.234 aktiv');
    expect(card('Klient:innen-Zuordnung').textContent).toContain('1.240 gespeichert');
    expect(card('Mitarbeitende-Zuordnung').textContent).toContain('0 gespeichert');
    expect(card('Leistungskatalog').textContent).toContain('Leistungen nicht abrufbar.');
    expect(card('Leistungskatalog').textContent).not.toContain('0 gespeichert');
    expect(card('Berechtigungsprofile').textContent).toContain('Bestand geschützt');
    expect(card('Leistungskatalog').querySelector('.ma-inventory-count strong')?.textContent).toBe('—');
    expect(card('Berechtigungsprofile').querySelector('.ma-inventory-count strong')?.textContent).toBe('—');
    expect(card('Berechtigungsprofile').textContent).not.toContain('0 gespeichert');
    expect(host.querySelector('.ma-overview-facts')?.textContent).toContain('geladene Bereiche');
    await click(button('Klient:innen-Zuordnung öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/modules/clients');
    expect(button('Berechtigungsprofile öffnen').disabled).toBe(true);
    expect(button('Leistungskatalog öffnen').disabled).toBe(true);
    await click(button('Berechtigungsprofile öffnen')); await click(button('Leistungskatalog öffnen'));
    expect(props.onOpen).toHaveBeenCalledTimes(1);
    await click(button('Zuordnungen erneut laden')); expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the actual document and template inventories when no module assignments exist', async () => {
    await render({ data: snapshot() });
    const documents = card('Dokument-Sichtbarkeit');
    expect(documents.querySelector('.ma-inventory-count strong')?.textContent).toBe('100');
    expect(documents.querySelector('.ma-inventory-count')?.textContent).toContain('Aktenunterlagen');
    expect(documents.querySelector('.ma-card-assignments')?.textContent).toContain('0 gespeichert');
    expect(documents.textContent).not.toContain('Keine aktive Zuordnung');
    expect(card('Vorlagen-Zuordnung').querySelector('.ma-inventory-count strong')?.textContent).toBe('450');
    await click(button('Aktenunterlagen öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/documents');
    await click(button('Dokumentenkatalog öffnen'));
    expect(props.onOpen).toHaveBeenLastCalledWith('/business/office/document-catalog');
  });

  it('keeps template inventory usable when module assignments are restricted', async () => {
    const data = snapshot();
    data.sections[4] = { ...data.sections[4], state: 'restricted', count: null, activeCount: null, action: null };
    await render({ data });
    expect(card('Vorlagen-Zuordnung').querySelector('.ma-inventory-count strong')?.textContent).toBe('450');
    expect(button('Vorlagen-Zuordnung öffnen').disabled).toBe(true);
    expect(button('Dokumentenkatalog öffnen').disabled).toBe(false);
    await click(button('Dokumentenkatalog öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/document-catalog');
  });

  it('keeps module assignments available when inventory cannot be read and never shows a fake source zero', async () => {
    const data = snapshot();
    data.sections[3] = { ...data.sections[3], count: 2, activeCount: 2, inventory: { state: 'error', count: null, error: 'Unterlagen sind gerade nicht abrufbar.', action: null } };
    await render({ data });
    expect(card('Dokument-Sichtbarkeit').querySelector('.ma-inventory-count strong')?.textContent).toBe('—');
    expect(card('Dokument-Sichtbarkeit').textContent).toContain('Unterlagen sind gerade nicht abrufbar.');
    expect(card('Dokument-Sichtbarkeit').querySelector('.ma-source-action')).toBeNull();
    expect(button('Dokument-Sichtbarkeit öffnen').disabled).toBe(false);
    await click(button('Dokument-Sichtbarkeit öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/modules/documents');
    await click(button('Bestand erneut laden'));
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
  });

  it('filters section names case-insensitively and restores an empty search', async () => {
    await render(); await change(search(), '  vOrLaGeN  ');
    expect(host.querySelectorAll('article')).toHaveLength(2); expect(card('Vorlagen-Zuordnung')).toBeTruthy(); expect(card('Berechtigungsprofile')).toBeTruthy();
    await change(search(), '  kAtAlOgVoRlAgEn  ');
    expect(host.querySelectorAll('article')).toHaveLength(1); expect(card('Vorlagen-Zuordnung')).toBeTruthy();
    await change(search(), 'Nichtvorhandener Bereich');
    expect(host.querySelectorAll('article')).toHaveLength(0); expect(host.textContent).toContain('Kein passender Bereich');
    await click(button('Suche zurücksetzen'));
    expect(search().value).toBe(''); expect(host.querySelectorAll('article')).toHaveLength(7);
  });

  it.each(['loading', 'error'] as const)('prevents opening a card while the snapshot is %s', async mode => {
    await render({ loading: mode === 'loading', error: mode === 'error' ? 'Verbindung unterbrochen.' : null });
    for (const node of host.querySelectorAll<HTMLButtonElement>('.ma-open, .ma-assignment-action')) { expect(node.disabled).toBe(true); await click(node); }
    expect(props.onOpen).not.toHaveBeenCalled();
    if (mode === 'loading') {
      expect(host.querySelector('[data-testid="module-assignments-workspace"]')?.getAttribute('aria-busy')).toBe('true');
      expect(button('Wird aktualisiert…').disabled).toBe(true);
    } else {
      expect(host.querySelector('[role=alert]')?.textContent).toContain('letzten erfolgreichen Abruf');
      await click(button('Aktualisieren')); expect(props.onRefresh).toHaveBeenCalledTimes(1);
    }
  });
});

describe('module assignment list filtering and pagination', () => {
  const mixedItems = () => [
    item(1, { title: 'Anna Adler', meta: 'Route Nord' }),
    item(2, { title: 'Berta Berg', moduleKey: 'pflege' }),
    item(3, { title: 'Clara Bach', active: false, status: 'archiviert' }),
    item(4, { title: 'Dora Engel', moduleKey: 'pflege', active: false, status: 'gesperrt', actions: [] }),
  ];

  it('combines active/inactive, module and search filters, then restores active defaults', async () => {
    await render({ data: snapshot('clients', mixedItems()) });
    expect(rows()).toHaveLength(2); expect(select('Aktivität').value).toBe('active');
    await change(search(), '  route nORD  ');
    expect(rows()).toHaveLength(1); expect(rows()[0].textContent).toContain('Anna Adler');
    await change(search(), ''); await change(select('Aktivität'), 'inactive'); await change(select('Arbeitsbereich'), 'assist');
    expect(rows()).toHaveLength(1); expect(rows()[0].textContent).toContain('Clara Bach');
    await change(search(), 'ARCHIVIERT'); expect(rows()).toHaveLength(1);
    await click(button('Filter zurücksetzen'));
    expect(search().value).toBe(''); expect(select('Arbeitsbereich').value).toBe('all'); expect(select('Aktivität').value).toBe('active');
    expect(rows()).toHaveLength(2);
    await change(select('Aktivität'), 'all'); expect(rows()).toHaveLength(4);
  });

  it.each([
    { status: 'in_bearbeitung' as const, label: 'In Bearbeitung', variant: 'orange' },
    { status: 'archiviert' as const, label: 'Archiviert', variant: 'muted' },
  ])('keeps an explicitly active client assignment visible without changing its $status workflow badge', async ({ status, label, variant }) => {
    await render({ data: snapshot('clients', [item(1, { active: true, status }), item(2, { active: false, status: 'archiviert' })]) });
    expect(select('Aktivität').value).toBe('active');
    expect(rows()).toHaveLength(1); expect(rows()[0].textContent).toContain('Person 01');
    const badge = rows()[0].querySelector('[data-label="Status"] .ma-badge');
    expect(badge?.textContent).toBe(label);
    expect(badge?.classList.contains(`ma-badge--${variant}`)).toBe(true);
    expect(badge?.classList.contains('ma-badge--green')).toBe(false);
    expect(rows()[0].querySelector('.ma-assignment-active')?.textContent).toBe('Zuordnung aktiv');
    await change(select('Aktivität'), 'inactive');
    expect(rows()).toHaveLength(1); expect(rows()[0].textContent).toContain('Person 02');
    expect(rows()[0].textContent).not.toContain('Zuordnung aktiv');
  });

  it('distinguishes no filter matches from an actually empty saved list', async () => {
    await render({ data: snapshot('clients', mixedItems()) }); await change(search(), 'Niemand');
    expect(rows()).toHaveLength(0); expect(host.textContent).toContain('Keine passenden Zuordnungen');
    expect(host.textContent).not.toContain('Keine zusätzlichen Modulzuordnungen gespeichert');
    await click(button('Alle Zuordnungen anzeigen'));
    expect(rows()).toHaveLength(4); expect(select('Aktivität').value).toBe('all'); expect(search().value).toBe('');
    await render({ data: snapshot('clients') });
    expect(host.textContent).toContain('Keine zusätzlichen Modulzuordnungen gespeichert');
    expect(host.textContent).not.toContain('Keine passenden Zuordnungen');
    expect(host.querySelector('[role=alert]')).toBeNull();
  });

  it('makes records after 25 reachable and searches across the full list rather than only the current page', async () => {
    await render({ data: snapshot('clients', Array.from({ length: 52 }, (_, index) => item(index + 1))) });
    expect(rows()).toHaveLength(25); expect(rows()[0].textContent).toContain('Person 01'); expect(button('Zurück').disabled).toBe(true);
    await click(button('Weiter'));
    expect(rows()).toHaveLength(25); expect(rows()[0].textContent).toContain('Person 26');
    await click(button('Weiter'));
    expect(rows()).toHaveLength(2); expect(rows()[1].textContent).toContain('Person 52'); expect(button('Weiter').disabled).toBe(true);
    await click(button('Zurück')); expect(rows()[0].textContent).toContain('Person 26');
    await change(search(), 'Person 01');
    expect(rows()).toHaveLength(1); expect(rows()[0].textContent).toContain('Person 01');
    await click(button('Filter zurücksetzen'));
    expect(rows()).toHaveLength(25); expect(host.querySelector('.ma-pagination')?.textContent).toContain('Seite 1 von 3');
    await change(search(), 'Person 52'); expect(rows()[0].textContent).toContain('Person 52');
  });

  it('keeps a valid page when a refreshed list becomes shorter', async () => {
    await render({ data: snapshot('clients', Array.from({ length: 52 }, (_, index) => item(index + 1))) });
    await click(button('Weiter')); await click(button('Weiter'));
    await render({ data: snapshot('clients', [item(1), item(2)]) });
    expect(rows()).toHaveLength(2); expect(host.textContent).not.toContain('Keine passenden Zuordnungen');
    expect(host.querySelector('.ma-pagination')).toBeNull();
  });
});

describe('module assignment management actions and access states', () => {
  it('shows the usable document inventory before the empty module-assignment list', async () => {
    await render({ data: snapshot('documents') });
    const inventory = host.querySelector('.ma-inventory-summary')!;
    const assignments = host.querySelector('.ma-list')!;
    expect(inventory.querySelector('.ma-inventory-total')?.textContent).toBe('100Aktenunterlagen');
    expect(inventory.compareDocumentPosition(assignments) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(assignments.textContent).toContain('Keine zusätzlichen Modulzuordnungen gespeichert');
    expect(host.querySelector('.ma-toolbar')).toBeNull();
    await click(button('Aktenunterlagen öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/documents');
  });

  it('opens a permitted template inventory on a detail page even when its assignment section is restricted', async () => {
    const data = snapshot('templates');
    data.sections[4] = { ...data.sections[4], state: 'restricted', count: null, activeCount: null, action: null };
    await render({ data });
    expect(host.querySelector('.ma-inventory-total')?.textContent).toBe('450Katalogvorlagen');
    expect(host.querySelector('.ma-list')).toBeNull();
    expect(host.querySelector('[role=alert]')?.textContent).toContain('Modulzuordnungen sind für Ihre Rolle nicht freigegeben');
    await click(button('Dokumentenkatalog öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/document-catalog');
  });

  it('does not turn a restricted source into a management action supplied only by the assignment section', async () => {
    const data = snapshot('clients', [item(1)]);
    data.sections[0].inventory = { state: 'restricted', count: null, action: null, error: 'Bestand geschützt.' };
    await render({ data });
    expect(host.querySelector('.ma-inventory-summary button')).toBeNull();
    expect(host.querySelector('.ma-inventory-unavailable')?.textContent).toContain('Bestand geschützt.');
    expect(rows()).toHaveLength(1);
    await click(button('Klientenakte öffnen: Person 01'));
    expect(props.onOpen).toHaveBeenCalledWith('/office/clients/client-1?tab=portal');
  });

  it('passes real management and record destinations to navigation without inventing actions for view-only rows', async () => {
    await render({ data: snapshot('clients', [item(1), item(2, { actions: [] })]) });
    await click(button('Klientenverwaltung öffnen')); await click(button('Klientenakte öffnen: Person 01')); await click(button('Alle Modulzuordnungen'));
    expect(props.onOpen).toHaveBeenNthCalledWith(1, '/business/office/clients');
    expect(props.onOpen).toHaveBeenNthCalledWith(2, '/office/clients/client-1?tab=portal');
    expect(props.onOpen).toHaveBeenNthCalledWith(3, '/business/office/modules');
    expect(rows()[1].textContent).toContain('Nur Ansicht'); expect(rows()[1].querySelector('button')).toBeNull();
  });

  it.each(['restricted', 'error'] as const)('hides assignment rows for a %s section while retaining independently permitted inventory', async state => {
    const data = snapshot('clients', [item(1)]);
    data.sections[0] = { ...data.sections[0], state, count: null, activeCount: null, error: state === 'restricted' ? 'Zugriff fehlt.' : 'Abfrage fehlgeschlagen.' };
    await render({ data });
    expect(rows()).toHaveLength(0); expect(search()).toBeNull();
    expect(host.querySelector('.ma-inventory-summary button')).not.toBeNull();
    expect(button('Klientenverwaltung öffnen').disabled).toBe(false);
    expect(host.textContent).not.toContain('Person 01'); expect(host.textContent).not.toContain('Keine zusätzlichen Modulzuordnungen gespeichert');
    expect(host.querySelector('[role=alert]')?.textContent).toContain(data.sections[0].error!);
    if (state === 'error') { await click(button('Erneut versuchen')); expect(props.onRefresh).toHaveBeenCalledTimes(1); }
    else expect([...host.querySelectorAll('button')].some(node => node.textContent === 'Erneut versuchen')).toBe(false);
    expect(props.onOpen).not.toHaveBeenCalled();
    await click(button('Klientenverwaltung öffnen'));
    expect(props.onOpen).toHaveBeenCalledWith('/business/office/clients');
  });

  it.each(['loading', 'error'] as const)('locks management and row navigation while the snapshot is %s', async mode => {
    await render({ data: snapshot('clients', [item(1)]), loading: mode === 'loading', error: mode === 'error' ? 'Verbindung unterbrochen.' : null });
    for (const label of ['Alle Modulzuordnungen', 'Klientenverwaltung öffnen', 'Klientenakte öffnen: Person 01']) {
      expect(button(label).disabled).toBe(true); await click(button(label));
    }
    expect(props.onOpen).not.toHaveBeenCalled(); expect(rows()).toHaveLength(1);
    if (mode === 'error') { await click(button('Aktualisieren')); expect(props.onRefresh).toHaveBeenCalledTimes(1); }
    else expect(host.querySelector('.ma-results')?.textContent).toContain('Wird aktualisiert');
  });

  it('announces partial-data warnings and labels demo data without rendering an invalid timestamp', async () => {
    const data = snapshot('clients'); data.source = 'demo'; data.loadedAt = 'invalid'; data.warnings = ['Nicht alle Bereiche konnten gelesen werden.'];
    await render({ data, roleLabel: null });
    expect(host.textContent).toContain('Nicht alle Bereiche konnten gelesen werden.');
    expect(host.textContent).toContain('Demo'); expect(host.textContent).toContain('Beispieldaten'); expect(host.textContent).toContain('Angemeldetes Konto');
    expect(host.textContent).not.toContain('Invalid Date');
  });
});
