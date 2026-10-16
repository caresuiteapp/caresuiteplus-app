// @vitest-environment happy-dom
// These interactions verify state and persistence, not browser geometry.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceResult } from '@/types';
import type { TenantDocumentSettings, TenantDocumentSettingsForm } from '@/types/documents/tenantDocumentSettings';
import type { PreparedDocumentLogo } from '@/lib/documents/documentLogoUpload.web';
import { DocumentCiLayoutSettingsScreen } from '@/screens/documents/DocumentCiLayoutSettingsScreen.web';

const h = vi.hoisted(() => ({
  tenant: 'tenant-a', canEdit: true,
  profile: { id: 'profile-a', roleKey: 'business_admin' },
  fetch: vi.fn(), save: vi.fn(), prepare: vi.fn(), upload: vi.fn(), revoke: vi.fn(),
  order: [] as string[],
}));
vi.mock('@/hooks/useTenantId', () => ({ useServiceTenantId: () => h.tenant }));
vi.mock('@/lib/auth/context', () => ({ useAuth: () => ({ profile: h.profile }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({
  can: (key: string) => key === 'office.catalogs.edit' ? h.canEdit : true,
  check: () => ({ allowed: true, reason: null }),
}) }));
vi.mock('@/components/documents/DocumentsWorkspaceShell.web', () => ({ DocumentsWorkspaceShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/lib/documents', () => ({ fetchTenantDocumentSettings: h.fetch, saveTenantDocumentSettings: h.save }));
vi.mock('@/lib/documents/documentLogoUpload.web', () => ({ DOCUMENT_LOGO_ACCEPT: 'image/png,image/jpeg,image/webp', prepareDocumentLogo: h.prepare, uploadDocumentLogo: h.upload }));
vi.mock('react-native', () => ({ Platform: { OS: 'web' }, AppState: { currentState: 'active' } }));

const LOGO_URL = 'https://assets.example.org/tenant/tenant-a/document-logo.png';
const OLD_URL = 'https://assets.example.org/tenant/tenant-a/previous-logo.png';
const PREVIEW_URL = 'blob:document-logo-selection';
let root: Root;
let host: HTMLDivElement;
let stored: Map<string, TenantDocumentSettings>;
let prepared: PreparedDocumentLogo;

function settings(tenantId: string): TenantDocumentSettings {
  return {
    id: `settings-${tenantId}`, tenantId, updatedAt: '2026-10-16T09:00:00.000Z',
    logoUrl: null, logoWidthMm: 45, logoNaturalWidthPx: null, logoNaturalHeightPx: null,
    primaryColor: '#2457a6', secondaryColor: '#334155', accentColor: '#3b82f6', fontFamily: 'Arial, sans-serif',
    headerLayout: { logoPosition: 'left', showCompanyName: true, showBrandLine: true, showSlogan: false, showDocumentType: true, showAccentLine: true, showDocumentNumber: true, showPageNumber: false },
    footerLayout: { showPageNumber: true, showMandatoryDisclosures: true, byDocumentType: {} },
    pageLayout: { format: 'A4', orientation: 'portrait', widthMm: 210, heightMm: 297, marginLeftMm: 20, marginRightMm: 20, marginTopMm: 20, marginBottomMm: 20, baseFontSizePt: 11, headingFontSizePt: 16, lineHeight: 1.5, fontFamily: 'Arial, sans-serif' },
    defaultPaymentTermsDays: 14, defaultTaxNotice: '', defaultContractClauses: '', defaultDunningTerms: '', defaultDocumentLanguage: 'de-DE', bankName: '', iban: '', bic: '', ciEnforcementEnabled: true,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function button(label: string) {
  const found = [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label);
  expect(found, `Button "${label}" must be available`).toBeDefined();
  return found!;
}
function logoSources() { return [...host.querySelectorAll<HTMLImageElement>('img')].map(image => image.getAttribute('src')); }
async function render() { await act(async () => { root.render(<DocumentCiLayoutSettingsScreen />); }); }
async function pick(file = prepared.file) {
  const input = host.querySelector<HTMLInputElement>('input[type=file]');
  expect(input, 'The logo must be selectable as a local file').not.toBeNull();
  Object.defineProperty(input!, 'files', { configurable: true, value: [file] });
  await act(async () => { input!.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function submit() {
  const form = host.querySelector('form'); expect(form).not.toBeNull();
  await act(async () => { form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}
async function click(label: string) { await act(async () => { button(label).click(); }); }
function expectNoSuccess() { expect(host.textContent).not.toContain('Die Dokumentgestaltung wurde gespeichert.'); }

beforeEach(() => {
  vi.clearAllMocks(); h.tenant = 'tenant-a'; h.canEdit = true; h.order.length = 0;
  stored = new Map([['tenant-a', settings('tenant-a')], ['tenant-b', settings('tenant-b')]]);
  prepared = { file: new File(['image-content'], 'Unternehmenslogo.png', { type: 'image/png' }), previewUrl: PREVIEW_URL, width: 900, height: 300, uploadId: '123e4567-e89b-42d3-a456-426614174000' };
  h.fetch.mockImplementation(async (tenantId: string) => ({ ok: true, data: structuredClone(stored.get(tenantId)!) }));
  h.prepare.mockImplementation(async () => ({ ok: true, data: prepared }));
  h.upload.mockImplementation(async () => { h.order.push('upload'); return { ok: true, data: LOGO_URL }; });
  h.save.mockImplementation(async (tenantId: string, form: TenantDocumentSettingsForm) => {
    h.order.push('save');
    const data = { ...structuredClone(form), id: `settings-${tenantId}`, tenantId, updatedAt: '2026-10-16T10:00:00.000Z' };
    stored.set(tenantId, data); return { ok: true, data };
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(h.revoke);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => { root.unmount(); }); host.remove(); vi.restoreAllMocks(); });

describe('Document logo file upload', () => {
  it('offers a local file picker and preview instead of a URL input, without uploading on selection', async () => {
    await render();
    expect(host.querySelector('input[type=url]')).toBeNull();
    expect(host.textContent).not.toContain('Logo-Adresse');
    await pick();
    expect(h.prepare).toHaveBeenCalledWith(prepared.file);
    expect(logoSources()).toContain(PREVIEW_URL);
    expect(h.upload).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
  });

  it('uploads before saving the HTTPS URL and dimensions, and reloads the saved logo', async () => {
    await render(); await pick(); await submit();
    expect(h.upload).toHaveBeenCalledWith('tenant-a', prepared, 'business_admin');
    expect(h.order).toEqual(['upload', 'save']);
    expect(h.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ logoUrl: LOGO_URL, logoNaturalWidthPx: 900, logoNaturalHeightPx: 300 }), 'business_admin');
    expect(host.textContent).toContain('Die Dokumentgestaltung wurde gespeichert.');
    await click('Aktualisieren');
    expect(h.fetch).toHaveBeenCalledTimes(2);
    expect(logoSources()).toContain(LOGO_URL); expect(logoSources()).not.toContain(PREVIEW_URL);
  });

  it('blocks two submits in the same event turn while the logo upload is pending', async () => {
    const pending = deferred<ServiceResult<string>>(); h.upload.mockReturnValue(pending.promise);
    await render(); await pick();
    await act(async () => { const form = host.querySelector('form')!; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(h.upload).toHaveBeenCalledTimes(1); expect(h.save).not.toHaveBeenCalled(); expectNoSuccess();
    await act(async () => { pending.resolve({ ok: true, data: LOGO_URL }); });
    expect(h.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the draft and never saves or reports success when the logo upload fails', async () => {
    h.upload.mockResolvedValue({ ok: false, error: 'Logo konnte nicht hochgeladen werden.' });
    await render(); await pick(); await submit();
    expect(h.save).not.toHaveBeenCalled(); expectNoSuccess();
    expect(host.textContent).toContain('Logo konnte nicht hochgeladen werden.');
    expect(logoSources()).toContain(PREVIEW_URL);
    expect(button('Änderungen speichern').disabled).toBe(false);
  });

  it('reuses an uploaded URL after a settings failure rather than uploading the file again', async () => {
    h.save.mockResolvedValueOnce({ ok: false, error: 'Einstellungen konnten nicht gespeichert werden.' });
    await render(); await pick(); await submit();
    expectNoSuccess(); expect(host.textContent).toContain('Einstellungen konnten nicht gespeichert werden.');
    expect(h.upload).toHaveBeenCalledTimes(1); expect(h.save).toHaveBeenCalledTimes(1);
    await submit();
    expect(h.upload).toHaveBeenCalledTimes(1); expect(h.save).toHaveBeenCalledTimes(2);
    expect(h.save.mock.calls[1][1]).toMatchObject({ logoUrl: LOGO_URL, logoNaturalWidthPx: 900, logoNaturalHeightPx: 300 });
    expect(host.textContent).toContain('Die Dokumentgestaltung wurde gespeichert.');
  });

  it('discards the selected logo, restores the saved one and releases the local preview', async () => {
    stored.set('tenant-a', { ...settings('tenant-a'), logoUrl: OLD_URL, logoNaturalWidthPx: 600, logoNaturalHeightPx: 200 });
    await render(); await pick(); await click('Verwerfen');
    expect(logoSources()).toContain(OLD_URL); expect(logoSources()).not.toContain(PREVIEW_URL);
    expect(h.revoke).toHaveBeenCalledWith(PREVIEW_URL);
    expect(h.upload).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled();
    expect(button('Änderungen speichern').disabled).toBe(true);
  });

  it('removes the saved logo only when changes are saved, including its recorded dimensions', async () => {
    stored.set('tenant-a', { ...settings('tenant-a'), logoUrl: OLD_URL, logoNaturalWidthPx: 600, logoNaturalHeightPx: 200 });
    await render(); await click('Logo entfernen');
    expect(h.save).not.toHaveBeenCalled(); expect(logoSources()).not.toContain(OLD_URL);
    await submit();
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ logoUrl: null, logoNaturalWidthPx: null, logoNaturalHeightPx: null }), 'business_admin');
    await click('Aktualisieren'); expect(logoSources()).not.toContain(OLD_URL);
  });

  it('rejects an invalid selection without replacing the stored logo or saving anything', async () => {
    stored.set('tenant-a', { ...settings('tenant-a'), logoUrl: OLD_URL });
    h.prepare.mockResolvedValue({ ok: false, error: 'Bitte eine gültige PNG- oder JPEG-Datei auswählen.' });
    await render(); await pick();
    expect(logoSources()).toContain(OLD_URL);
    expect(host.textContent).toContain('Bitte eine gültige PNG- oder JPEG-Datei auswählen.');
    expect(h.upload).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled(); expectNoSuccess();
  });

  it('does not apply a preparation result after switching to another tenant', async () => {
    const pending = deferred<ServiceResult<PreparedDocumentLogo>>(); h.prepare.mockReturnValue(pending.promise);
    await render(); await pick(); h.tenant = 'tenant-b'; await render();
    await act(async () => { pending.resolve({ ok: true, data: prepared }); });
    expect(logoSources()).not.toContain(PREVIEW_URL);
    expect(h.revoke).toHaveBeenCalledWith(PREVIEW_URL);
    await submit(); expect(h.upload).not.toHaveBeenCalled(); expect(h.save).not.toHaveBeenCalled(); expectNoSuccess();
  });

  it('does not save the old tenant after switching before its upload finishes', async () => {
    const pending = deferred<ServiceResult<string>>(); h.upload.mockReturnValue(pending.promise);
    await render(); await pick(); await submit(); expect(h.upload).toHaveBeenCalledTimes(1);
    h.tenant = 'tenant-b'; await render();
    await act(async () => { pending.resolve({ ok: true, data: LOGO_URL }); });
    expect(h.save).not.toHaveBeenCalled(); expectNoSuccess();
    expect(logoSources()).not.toContain(PREVIEW_URL); expect(logoSources()).not.toContain(LOGO_URL);
  });
});
