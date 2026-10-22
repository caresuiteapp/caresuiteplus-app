import { describe, expect, it } from 'vitest';
import { DESKTOP_AREAS, type DesktopAreaKey } from '@/liquid-command/navigation/desktopAreas';
import { suggestDesktopWidgets } from '@/liquid-command/navigation/desktopWidgetSuggestions';

type Widget = { id: string; route: string; source: DesktopAreaKey | null; label: string };
const widget = (id: string, route: string, source: DesktopAreaKey | null = 'office'): Widget => ({ id, route, source, label: id });
const clients = widget('clients', '/business/office/clients');
const notes = widget('notes', '/office/notizen');
const templates = widget('templates', '/business/office/document-catalog');
const messages = widget('messages', '/business/messages');
const people = widget('people', '/business/office/employees');
const calendar = widget('google-calendar', '/business/connect/google-workspace?service=calendar');
const documents = widget('documents', '/business/office/documents');
const inventory = widget('inventory', '/unternehmen/inventar');
const company = widget('company', '/unternehmen');
const billing = widget('billing', '/business/office/invoices');
const officeWidgets = [notes, messages, clients, templates, documents, people, calendar, inventory, company, billing];
const suggest = (available: readonly Widget[], pinned: readonly string[], area: DesktopAreaKey, limit?: number) =>
  suggestDesktopWidgets(available, pinned, area, route => available.find(item => item.route === route)?.source ?? null, limit);

describe('desktop widget suggestions', () => {
  it('matches the approved Beratung selection with its workspace first', () => {
    const workspace = widget('consultation', '/beratung/arbeitsplatz', 'beratung');
    const available = [...officeWidgets, workspace];
    expect(suggest(available, [], 'beratung')).toEqual([workspace, clients, calendar, templates, notes, messages]);
  });

  it.each(DESKTOP_AREAS)('supports $label without creating any catalog records', ({ key }) => {
    const suggestions = suggest(officeWidgets, [], key);
    expect(suggestions).toHaveLength(6);
    for (const suggestion of suggestions) expect(officeWidgets.includes(suggestion)).toBe(true);
    expect(new Set(suggestions.map(item => item.route)).size).toBe(suggestions.length);
  });

  it.each([
    ['assist', '/assist/assignments'], ['pflege', '/pflege/klienten'],
    ['stationaer', '/stationaer/bewohner'], ['beratung', '/beratung/arbeitsplatz'],
    ['akademie', '/akademie/kurse'], ['robotics', '/robotics?area=devices'],
    ['premium', '/business/subscription'], ['settings', '/settings/profile'],
  ] as const)('puts a permitted %s entry before shared Office suggestions', (area, route) => {
    const own = widget('own', route, area);
    expect(suggest([...officeWidgets, own], [], area)[0]).toBe(own);
  });

  it('uses existing permission filtering without replacing removed or unreleased widgets', () => {
    expect(suggest([], [], 'beratung')).toEqual([]);
    expect(suggest([notes], [], 'pflege')).toEqual([notes]);
    expect(suggest([notes], ['notes'], 'stationaer')).toEqual([]);
    expect(suggest([clients, messages], [], 'beratung')).toEqual([clients, messages]);
  });

  it('does not suggest other specialist areas or unclassified destinations', () => {
    const foreign = widget('assignments', '/assist/assignments', 'assist');
    const unknown = widget('unknown', '/unreviewed', null);
    expect(suggest([foreign, unknown, notes], [], 'beratung')).toEqual([notes]);
  });

  it('excludes all pinned widgets and every entry for their canonical route', () => {
    const duplicate = { ...clients, id: 'app-clients' };
    expect(suggest([clients, duplicate, notes, templates], ['app-clients', 'templates', 'unavailable-saved-id'], 'beratung')).toEqual([notes]);
  });

  it('deduplicates routes and ids without merging separate Google services', () => {
    const alias = { ...clients, id: 'client-alias' };
    const duplicateId = { ...clients, route: '/office/clients' };
    const tasks = widget('google-tasks', '/business/connect/google-workspace?service=tasks');
    const suggestions = suggest([clients, alias, duplicateId, calendar, tasks], [], 'office');
    expect(suggestions).toEqual([clients, calendar, tasks]);
    expect(suggest([calendar, tasks], ['google-calendar'], 'office')).toEqual([tasks]);
  });

  it('updates suggestions after adopting one without changing the original catalog or saved array', () => {
    const available = Object.freeze([...officeWidgets]);
    const pinned = Object.freeze(['clients']);
    const first = suggest(available, pinned, 'beratung');
    expect(first[0]).toBe(calendar);
    expect(suggest(available, [...pinned, calendar.id], 'beratung')[0]).toBe(templates);
    expect(pinned).toEqual(['clients']);
    expect(available).toEqual(officeWidgets);
    expect(first[0]).toBe(available.find(item => item.id === calendar.id));
  });

  it('keeps equally ranked own-area entries in catalog order and never recommends account deletion', () => {
    const first = widget('notifications', '/settings/tenant/notifications', 'settings');
    const second = widget('text-blocks', '/business/templates/text-blocks', 'settings');
    const deletion = widget('delete-account', '/settings/account-deletion?source=desktop', 'settings');
    expect(suggest([first, second, deletion, notes], [], 'settings')).toEqual([first, second, notes]);
  });

  it.each([
    [0, 0], [-1, 0], [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0], [2.9, 2], [20, 6],
  ])('limits recommendations for limit %s to %i cards', (limit, count) => {
    expect(suggest(officeWidgets, [], 'office', limit)).toHaveLength(count);
  });
});
