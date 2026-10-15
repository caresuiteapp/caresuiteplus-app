// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantCenterSectionModals } from '@/components/tenant/TenantCenterSectionModals.web';
import {
  DEFAULT_TENANT_MODULES, EMPTY_TENANT_BRANDING, EMPTY_TENANT_COMPANY, EMPTY_TENANT_LEGAL,
  EMPTY_TENANT_PAYMENT, EMPTY_TENANT_REGISTER, EMPTY_TENANT_TAX,
  type TenantCenterSectionKey, type TenantCenterSnapshot,
} from '@/types/tenant/tenantCenter';
import type { TenantLogoValue } from '@/lib/tenant/tenantLogoService';

const h = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn(), branding: vi.fn(), allowed: true }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', can: () => h.allowed }) }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: ({ children, footerContent, title, onClose }: { children: ReactNode; footerContent: ReactNode; title: string; onClose: () => void }) =>
  <section role="dialog" aria-label={title}><button onClick={onClose}>Fenster schließen</button>{children}<footer>{footerContent}</footer></section> }));
vi.mock('@/components/tenant/TenantLogoPicker', () => ({ TenantLogoPicker: ({ onChange, disabled }: { onChange: (value: TenantLogoValue) => void; disabled: boolean }) =>
  <button type="button" disabled={disabled} onClick={() => onChange({ displayUri: null, removed: true, pending: null })}>Logo entfernen</button> }));
vi.mock('@/lib/tenant/tenantCenterService', () => ({
  fetchTenantCenter: (...args: unknown[]) => h.load(...args),
  saveTenantBankAccounts: (...args: unknown[]) => h.save('bank', ...args),
  saveTenantCompanyProfile: (...args: unknown[]) => h.save('company', ...args),
  saveTenantContactProfile: (...args: unknown[]) => h.save('contact', ...args),
  saveTenantLegalProfile: (...args: unknown[]) => h.save('legal', ...args),
  saveTenantModuleSettings: (...args: unknown[]) => h.save('modules', ...args),
  saveTenantPaymentTerms: (...args: unknown[]) => h.save('payment', ...args),
  saveTenantRegisterProfile: (...args: unknown[]) => h.save('register', ...args),
  saveTenantRepresentatives: (...args: unknown[]) => h.save('representatives', ...args),
  saveTenantTaxProfile: (...args: unknown[]) => h.save('tax', ...args),
}));
vi.mock('@/lib/tenant/tenantBrandingService', () => ({ saveTenantBrandingProfile: (...args: unknown[]) => h.branding(...args) }));
vi.mock('@/lib/tenant/tenantLogoService', () => ({ EMPTY_TENANT_LOGO: { displayUri: null, pending: null, removed: false },
  hasTenantLogoChanges: (logo: TenantLogoValue, current: string) => !!logo.pending || (!!logo.removed && !!current) }));

let host: HTMLDivElement;
let root: Root;
let snapshot: TenantCenterSnapshot;
let section: TenantCenterSectionKey | null;
const close = vi.fn();
const saved = vi.fn();
const reloaded = vi.fn();
const render = async () => { await act(async () => root.render(<TenantCenterSectionModals activeSection={section} snapshot={snapshot} tenantId={snapshot.tenantId} onClose={close} onSaved={saved} onReloaded={reloaded} />)); };
const button = (text: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => node.textContent === text)!;
const click = async (node: HTMLElement) => { await act(async () => node.click()); };
const field = (label: string) => {
  const labelNode = Array.from(host.querySelectorAll('label')).find(node => node.textContent?.replace(/\s*\*$/, '') === label)!;
  return document.getElementById(labelNode.htmlFor) as HTMLInputElement;
};
const change = async (label: string, next: string) => {
  await act(async () => {
    const node = field(label);
    const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(node, next);
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); h.allowed = true; section = 'company';
  snapshot = {
    tenantId: 'tenant-one', updatedAt: '2026-10-15T05:00:00Z', company: { ...EMPTY_TENANT_COMPANY, name: 'Beispiel GmbH', email: 'info@example.test' },
    legal: { ...EMPTY_TENANT_LEGAL }, tax: { ...EMPTY_TENANT_TAX }, register: { ...EMPTY_TENANT_REGISTER },
    contact: { billingEmail: '', supportEmail: 'info@example.test', supportPhone: '', contactPersons: [] },
    representatives: [], bankAccounts: [], payment: { ...EMPTY_TENANT_PAYMENT }, branding: { ...EMPTY_TENANT_BRANDING, logoUrl: 'https://example.test/logo.png' },
    modules: { ...DEFAULT_TENANT_MODULES }, catalogSummary: '', catalogItems: [], customFields: [], auditLogs: [], sections: [], assistDefaultHourlyRate: '',
  };
  h.save.mockImplementation(async () => ({ ok: true, data: snapshot }));
  h.load.mockImplementation(async () => ({ ok: true, data: snapshot }));
  h.branding.mockImplementation(async () => ({ ok: true, data: { ...snapshot.branding, logoUrl: '' } }));
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('company Web editor', () => {
  it('starts from the saved record, preserves a draft after cancelled close, then resets on reopening', async () => {
    await render(); expect(button('Änderungen speichern').disabled).toBe(true);
    await change('Firmenname', 'Entwurf'); await click(button('Abbrechen'));
    expect(close).not.toHaveBeenCalled(); expect(host.textContent).toContain('Ungespeicherte Änderungen verwerfen?');
    await click(button('Weiter bearbeiten')); expect(field('Firmenname').value).toBe('Entwurf');
    await click(button('Fenster schließen')); await click(button('Änderungen verwerfen'));
    expect(close).toHaveBeenCalledOnce(); expect(h.save).not.toHaveBeenCalled();
    section = null; await render(); section = 'company'; await render();
    expect(field('Firmenname').value).toBe('Beispiel GmbH');
  });

  it('rejects invalid fields without a request and keeps valid values when the server rejects a save', async () => {
    await render(); await change('Firmenname', ''); await click(button('Änderungen speichern'));
    expect(field('Firmenname').getAttribute('aria-invalid')).toBe('true'); expect(h.save).not.toHaveBeenCalled();
    await change('Firmenname', 'Neue Firma'); h.save.mockResolvedValue({ ok: false, error: 'Keine Schreibberechtigung.' });
    await click(button('Änderungen speichern'));
    expect(host.textContent).toContain('Keine Schreibberechtigung.'); expect(field('Firmenname').value).toBe('Neue Firma');
    expect(saved).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(button('Änderungen speichern').disabled).toBe(false);
  });

  it('recovers from a rejected request and delivers the saved snapshot to the parent', async () => {
    await render(); await change('Firmenname', 'Neue Firma'); h.save.mockRejectedValueOnce(new Error('network'));
    await click(button('Änderungen speichern')); expect(host.textContent).toContain('Ihre Eingaben bleiben erhalten');
    expect(button('Änderungen speichern').disabled).toBe(false);
    const result = { ...snapshot, company: { ...snapshot.company, name: 'Neue Firma' } };
    h.save.mockResolvedValueOnce({ ok: true, data: result }); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenLastCalledWith('company', 'tenant-one', expect.objectContaining({ name: 'Neue Firma' }), 'business_admin');
    expect(saved).toHaveBeenCalledWith(result, 'company'); expect(close).toHaveBeenCalledOnce();
  });

  it('prevents duplicate saves and closing while the request is pending', async () => {
    let resolve: (value: unknown) => void = () => {};
    h.save.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render(); await change('Firmenname', 'Neue Firma');
    await act(async () => { button('Änderungen speichern').click(); button('Änderungen speichern').click(); });
    expect(h.save).toHaveBeenCalledOnce(); expect(field('Firmenname').closest('fieldset')?.disabled).toBe(true);
    await click(button('Fenster schließen')); expect(close).not.toHaveBeenCalled();
    await act(async () => resolve({ ok: true, data: snapshot })); expect(saved).toHaveBeenCalledOnce();
  });

  it('does not apply an old request after switching the company', async () => {
    let resolve: (value: unknown) => void = () => {};
    h.save.mockImplementation(() => new Promise(done => { resolve = done; }));
    await render(); await change('Firmenname', 'Alte Firma'); await click(button('Änderungen speichern'));
    snapshot = { ...snapshot, tenantId: 'tenant-two', company: { ...snapshot.company, name: 'Andere Firma' } }; await render();
    await act(async () => resolve({ ok: true, data: snapshot }));
    expect(saved).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(field('Firmenname').value).toBe('Andere Firma');
  });

  it('passes only explicitly removed existing contact IDs, preserving unrelated refreshes', async () => {
    section = 'contact'; snapshot.contact.contactPersons = [{ id: 'contact-one', firstName: 'Anna', lastName: 'Test', role: '', email: '', phone: '', isPrimary: true }];
    await render(); await click(button('Ansprechperson entfernen'));
    snapshot = { ...snapshot, contact: { ...snapshot.contact, contactPersons: [...snapshot.contact.contactPersons, { id: 'contact-two', firstName: 'Neue', lastName: 'Person', role: '', email: '', phone: '', isPrimary: false }] } }; await render();
    await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenCalledWith('contact', 'tenant-one', expect.objectContaining({ contactPersons: [] }), 'business_admin', { removedIds: ['contact-one'] });
  });

  it('chooses a new main bank account when removing the current one and preserves the survivor ID', async () => {
    section = 'bank'; snapshot.bankAccounts = [
      { id: 'bank-one', label: 'Erstes Konto', accountHolder: 'Beispiel GmbH', bankName: '', iban: 'DE89370400440532013000', bic: '', isPrimary: true, sortOrder: 0 },
      { id: 'bank-two', label: 'Zweites Konto', accountHolder: 'Beispiel GmbH', bankName: '', iban: 'DE89370400440532013000', bic: '', isPrimary: false, sortOrder: 1 },
    ];
    await render(); await click(button('Konto entfernen')); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenCalledWith('bank', 'tenant-one', [expect.objectContaining({ id: 'bank-two', isPrimary: true })], 'business_admin', { removedIds: ['bank-one'] });
  });

  it('validates payment values before saving and preserves an explicitly entered zero-day deadline', async () => {
    section = 'payment'; await render(); await change('Zahlungsziel in Tagen', '-3'); await click(button('Änderungen speichern'));
    expect(h.save).not.toHaveBeenCalled(); expect(field('Zahlungsziel in Tagen').getAttribute('aria-invalid')).toBe('true');
    await change('Zahlungsziel in Tagen', '0'); await change('Mahngebühr in Euro', '2,555'); await click(button('Änderungen speichern'));
    expect(h.save).not.toHaveBeenCalled(); expect(field('Mahngebühr in Euro').getAttribute('aria-invalid')).toBe('true');
    await change('Mahngebühr in Euro', '2,50'); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenCalledWith('payment', 'tenant-one', expect.objectContaining({ paymentTermsDays: '0', dunningFee: '2,50' }), 'business_admin');
  });

  it('creates an editable main contact without changing the saved snapshot before submission', async () => {
    section = 'contact'; await render(); await click(button('+ Ansprechperson hinzufügen'));
    await change('Vorname', 'Anna'); await change('Nachname', 'Muster'); await change('E-Mail', 'anna@example.test');
    expect(snapshot.contact.contactPersons).toEqual([]); expect(h.save).not.toHaveBeenCalled();
    await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenCalledWith('contact', 'tenant-one', expect.objectContaining({ contactPersons: [expect.objectContaining({ firstName: 'Anna', lastName: 'Muster', email: 'anna@example.test', isPrimary: true })] }), 'business_admin', { removedIds: [] });
  });

  it('keeps blocked modules disabled and requires explicit selection for the active area', async () => {
    section = 'modules'; await render();
    const locked = host.querySelector<HTMLInputElement>('input[aria-label="Ambulante Pflege"]')!;
    expect(locked.disabled).toBe(true); await click(locked); expect(h.save).not.toHaveBeenCalled();
    await click(host.querySelector<HTMLInputElement>('input[aria-label="Alltagsbegleitung"]')!); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenCalledWith('modules', 'tenant-one', { assistEnabled: false, pflegeEnabled: false, stationaerEnabled: false, beratungEnabled: false }, 'business_admin');
  });

  it('shows no save action when permission is missing and disables form controls', async () => {
    h.allowed = false; await render(); expect(button('Änderungen speichern')).toBeUndefined();
    expect(field('Firmenname').closest('fieldset')?.disabled).toBe(true); expect(h.save).not.toHaveBeenCalled();
  });

  it('keeps logo changes until an explicit save and forwards the updated branding', async () => {
    section = 'branding'; await render(); await click(button('Logo entfernen')); expect(h.branding).not.toHaveBeenCalled();
    await click(button('Änderungen speichern')); expect(h.branding).toHaveBeenCalledOnce();
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ branding: expect.objectContaining({ logoUrl: '' }) }), 'branding');
  });

  it('blocks direct retry after a partial multi-row save and confirms a reload that restores saved IDs and baseline', async () => {
    section = 'contact'; await render(); await click(button('+ Ansprechperson hinzufügen'));
    await change('Vorname', 'Anna'); await change('Nachname', 'Entwurf');
    h.save.mockResolvedValueOnce({ ok: false, error: 'Die Änderungen wurden nicht vollständig gespeichert. Zweite Anfrage fehlgeschlagen.' });
    await click(button('Änderungen speichern'));
    expect(button('Änderungen speichern').disabled).toBe(true); expect(field('Vorname').closest('fieldset')?.disabled).toBe(true);
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(h.save).toHaveBeenCalledOnce(); expect(h.load).not.toHaveBeenCalled();
    await click(button('Gespeicherten Stand neu laden'));
    expect(host.textContent).toContain('noch nicht gespeicherten Eingaben verworfen'); expect(h.load).not.toHaveBeenCalled();
    await click(button('Zurück zum Entwurf')); expect(field('Nachname').value).toBe('Entwurf');
    await click(button('Gespeicherten Stand neu laden'));
    const restored = { ...snapshot, contact: { ...snapshot.contact, contactPersons: [{ id: 'server-contact-id', firstName: 'Anna', lastName: 'Gespeichert', role: '', email: '', phone: '', isPrimary: true }] } };
    h.load.mockResolvedValueOnce({ ok: true, data: restored });
    await click(button('Neu laden und Eingaben verwerfen'));
    expect(h.load).toHaveBeenCalledWith('tenant-one', 'business_admin'); expect(reloaded).toHaveBeenCalledWith(restored, 'contact');
    expect(saved).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled(); expect(field('Nachname').value).toBe('Gespeichert');
    expect(button('Änderungen speichern').disabled).toBe(true);
    await change('Nachname', 'Korrigiert'); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenLastCalledWith('contact', 'tenant-one', expect.objectContaining({ contactPersons: [expect.objectContaining({ id: 'server-contact-id', lastName: 'Korrigiert' })] }), 'business_admin', { removedIds: [] });
  });

  it('uses the reloaded rows as the deletion baseline so a recovered entry can be removed explicitly', async () => {
    section = 'contact'; await render(); await click(button('+ Ansprechperson hinzufügen')); await change('Vorname', 'Anna');
    h.save.mockResolvedValueOnce({ ok: false, error: 'Die Änderungen wurden nicht vollständig gespeichert.' }); await click(button('Änderungen speichern'));
    h.load.mockResolvedValueOnce({ ok: true, data: { ...snapshot, contact: { ...snapshot.contact, contactPersons: [{ id: 'recovered-id', firstName: 'Anna', lastName: '', role: '', email: '', phone: '', isPrimary: true }] } } });
    await click(button('Gespeicherten Stand neu laden')); await click(button('Neu laden und Eingaben verwerfen'));
    await click(button('Ansprechperson entfernen')); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenLastCalledWith('contact', 'tenant-one', expect.objectContaining({ contactPersons: [] }), 'business_admin', { removedIds: ['recovered-id'] });
  });

  it.each(['contact', 'representatives', 'bank'] as const)('requires recovery after an ambiguous network interruption in %s', async target => {
    section = target; await render();
    if (target === 'bank') { await click(button('+ Konto hinzufügen')); await change('Kontoinhaber', 'Test GmbH'); await change('IBAN', 'DE89370400440532013000'); }
    else { await click(button(target === 'contact' ? '+ Ansprechperson hinzufügen' : '+ Person hinzufügen')); await change('Vorname', 'Anna'); }
    h.save.mockRejectedValueOnce(new Error('network'));
    await click(button('Änderungen speichern'));
    expect(host.textContent).toContain('Einige Änderungen könnten bereits gespeichert sein.'); expect(button('Änderungen speichern').disabled).toBe(true);
    expect(button('Gespeicherten Stand neu laden')).toBeTruthy(); await click(button('Änderungen speichern')); expect(h.save).toHaveBeenCalledOnce();
  });

  it('keeps ordinary validation failures in multi-row sections editable and directly retryable', async () => {
    section = 'contact'; await render(); await click(button('+ Ansprechperson hinzufügen')); await change('Vorname', 'Anna');
    h.save.mockResolvedValueOnce({ ok: false, error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
    await click(button('Änderungen speichern'));
    expect(button('Gespeicherten Stand neu laden')).toBeUndefined(); expect(button('Änderungen speichern').disabled).toBe(false);
    expect(field('Vorname').closest('fieldset')?.disabled).toBe(false); await change('Vorname', 'Anne'); await click(button('Änderungen speichern'));
    expect(h.save).toHaveBeenCalledTimes(2);
  });

  it('retains the draft and recovery lock when reloading fails, and prevents parallel recovery requests or close', async () => {
    section = 'contact'; await render(); await click(button('+ Ansprechperson hinzufügen')); await change('Vorname', 'Anna');
    h.save.mockResolvedValueOnce({ ok: false, error: 'Die Änderungen wurden nicht vollständig gespeichert.' }); await click(button('Änderungen speichern'));
    await click(button('Gespeicherten Stand neu laden'));
    let resolve!: (result: unknown) => void; h.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await act(async () => { button('Neu laden und Eingaben verwerfen').click(); button('Neu laden und Eingaben verwerfen')?.click(); });
    await click(button('Fenster schließen')); expect(close).not.toHaveBeenCalled(); expect(h.load).toHaveBeenCalledOnce();
    await act(async () => resolve({ ok: false, error: 'Verbindung unterbrochen.' }));
    expect(field('Vorname').value).toBe('Anna'); expect(button('Änderungen speichern').disabled).toBe(true);
    expect(host.textContent).toContain('Ihre bisherigen Eingaben bleiben erhalten.'); expect(reloaded).not.toHaveBeenCalled();
  });

  it('ignores recovered data after a company switch or revoked permission', async () => {
    section = 'contact'; await render(); await click(button('+ Ansprechperson hinzufügen')); await change('Vorname', 'Anna');
    h.save.mockResolvedValueOnce({ ok: false, error: 'Die Änderungen wurden nicht vollständig gespeichert.' }); await click(button('Änderungen speichern'));
    await click(button('Gespeicherten Stand neu laden'));
    let resolve!: (result: unknown) => void; h.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await click(button('Neu laden und Eingaben verwerfen')); h.allowed = false; await render();
    await act(async () => resolve({ ok: true, data: snapshot }));
    expect(reloaded).not.toHaveBeenCalled(); expect(field('Vorname').value).toBe('Anna');
    h.allowed = true; await render(); h.load.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await click(button('Neu laden und Eingaben verwerfen'));
    snapshot = { ...snapshot, tenantId: 'tenant-two' }; await render();
    await act(async () => resolve({ ok: true, data: snapshot })); expect(reloaded).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
  });
});
