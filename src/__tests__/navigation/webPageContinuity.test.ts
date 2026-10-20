// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canGoBackWebPage, goBackWebPage, recordWebPage } from '@/lib/navigation/webNavigationHistory';
import { webPageHref } from '@/lib/navigation/webPageHref';
import { readWebModalSnapshot, saveWebModalSnapshot } from '@/lib/navigation/webModalSnapshot';
import { resolveHealthOSPopupFallbackPath } from '@/lib/navigation/healthosRoutePresentation';

function page(id: string, path: string) { window.history.replaceState({ id }, '', path); recordWebPage('account-a'); }
beforeEach(() => { window.sessionStorage.clear(); vi.restoreAllMocks(); });

describe('actual Web continuity helpers', () => {
  it('preserves the original work page when help topics change and the help page reloads', () => {
    page('record', '/business/office/clients?client=one');
    page('help', '/hilfe?artikel=klienten-akte');
    page('help', '/hilfe?artikel=dokument-katalog');
    expect(canGoBackWebPage('account-a')).toBe(true);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    expect(goBackWebPage('account-a')).toBe(true);
    expect(back).toHaveBeenCalledOnce();
    const saved = JSON.parse(window.sessionStorage.getItem('caresuite.web.page-history.v1')!);
    expect(saved.entries.map((entry: { path: string }) => entry.path)).toEqual(['/business/office/clients?client=one', '/hilfe?artikel=dokument-katalog']);
  });
  it('uses the browser entry before reload when Expo no longer has a memory stack', () => {
    page('desktop', '/Desktop'); page('list', '/business/office/clients'); page('record', '/business/office/clients?client=one');
    expect(canGoBackWebPage('account-a')).toBe(true);
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    expect(goBackWebPage('account-a')).toBe(true); expect(back).toHaveBeenCalledOnce();
    expect(goBackWebPage('account-b')).toBe(false);
  });
  it('parameter replacements keep the previous page and Back reconciles its real history ID', () => {
    page('desktop', '/Desktop'); page('list', '/office/clients'); page('record', '/office/clients?client=one');
    page('record', '/office/clients?client=one&tab=dokumente');
    page('list', '/office/clients');
    expect(canGoBackWebPage('account-a')).toBe(true);
    page('desktop', '/Desktop'); expect(canGoBackWebPage('account-a')).toBe(false);
  });
  it('a new branch after Back discards the inaccessible forward trail', () => {
    page('home', '/'); page('a', '/office/clients'); page('b', '/office/documents');
    page('a', '/office/clients'); page('c', '/assist/assignments');
    const persisted = JSON.parse(window.sessionStorage.getItem('caresuite.web.page-history.v1')!);
    expect(persisted.entries.map((entry: { id: string }) => entry.id)).toEqual(['home', 'a', 'c']);
  });
  it('does not Back into login, a different identity, or an untracked browser entry', () => {
    page('home', '/'); page('a', '/office/clients');
    window.history.replaceState({ id: 'foreign' }, '', '/office/clients');
    expect(canGoBackWebPage('account-a')).toBe(false);
    window.history.replaceState({ id: 'a' }, '', '/auth/business-login');
    expect(goBackWebPage('account-a')).toBe(false);
  });
  it('preserves unrelated parameters while encoding and closing an in-page record', () => {
    expect(webPageHref('/office/clients', { month: '2026-10', client: 'old' }, { client: 'a&b', tab: 'dokumente' })).toBe('/office/clients?month=2026-10&client=a%26b&tab=dokumente');
    expect(webPageHref('/office/clients', { month: '2026-10', client: 'a' }, { client: undefined })).toBe('/office/clients?month=2026-10');
  });
  it('restores registered stacked windows only to the same account and tenant', () => {
    const entries = [{ id: 'a', title: 'Profil', modalKey: 'settings.profile' }, { id: 'b', title: 'Unternehmen', modalKey: 'settings.tenant' }];
    const token = saveWebModalSnapshot('account-a', entries)!;
    expect(readWebModalSnapshot('account-a', token)).toEqual(entries);
    expect(readWebModalSnapshot('account-b', token)).toEqual([]);
    expect(readWebModalSnapshot('account-a', ['bad'])).toEqual([]);
  });
  it('restores windows from session storage in a fresh module instance', async () => {
    const entry = { id: 'a', title: 'Profil', modalKey: 'settings.profile' };
    const token = saveWebModalSnapshot('account-a', [entry])!;
    vi.resetModules();
    const fresh = await import('@/lib/navigation/webModalSnapshot');
    expect(fresh.readWebModalSnapshot('account-a', token)).toEqual([entry]);
  });
  it.each([
    ['/business/office/clients/record-1', '/business/office/clients'],
    ['/office/employees/one/personnel', '/office/employees/one'],
    ['/assist/assignments/one/edit', '/assist/assignments/one'],
    ['/pflege/medikation/one', '/pflege/medikation'],
    ['/portal/employee/assignments/one', '/portal/employee/assignments'],
  ])('direct %s has a parent without existing history', (path, parent) => {
    expect(resolveHealthOSPopupFallbackPath(path)).toBe(parent);
  });
});
