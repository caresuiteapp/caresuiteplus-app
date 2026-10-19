// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantServiceCatalogModal, type TenantServiceCatalogModalProps } from '@/components/tenant/TenantServiceCatalogModal.web';
import type { ServiceCatalogCategory, TenantServiceCatalogItem } from '@/types/tenant/tenantCenter';
const f = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), seed: vi.fn(), history: vi.fn(), allowed: true }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ roleKey: 'business_admin', can: () => f.allowed }) }));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: ({ children, footerContent, onClose }: { children: ReactNode; footerContent: ReactNode; onClose: () => void }) => <section role="dialog"><button onClick={onClose}>Fenster schließen</button>{children}<footer>{footerContent}</footer></section> }));
vi.mock('@/lib/tenant/tenantServiceCatalogService', () => ({ fetchTenantServiceCatalog: f.fetch, saveTenantServiceCatalogItem: f.save, seedTenantServiceCatalogIfEmpty: f.seed, fetchTenantServicePriceHistory: f.history }));
const item: TenantServiceCatalogItem = { id: 'item-a', moduleKey: 'assist', serviceKey: 'assist.support', name: 'Alltagsbegleitung', description: '', category: 'service', unit: 'hour', isActive: true, sortOrder: 10, defaultPriceNet: 32.75, defaultTaxMode: 'none' };
const travel: TenantServiceCatalogItem = { ...item, id: 'travel', serviceKey: 'assist.travel', name: 'Fahrtkosten', category: 'travel', unit: 'km' };
let host: HTMLDivElement, root: Root;
const close = vi.fn(), saved = vi.fn();
async function render(category?: ServiceCatalogCategory, tenantId = 'tenant-a', options: Partial<TenantServiceCatalogModalProps> = {}) { await act(async () => root.render(<TenantServiceCatalogModal visible tenantId={tenantId} initialCategory={category} onClose={close} onSaved={saved} {...options} />)); }
const button = (text: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((node) => node.textContent === text)!;
const click = async (node: HTMLElement) => { expect(node).toBeTruthy(); await act(async () => node.click()); };
const field = (label: string) => Array.from(host.querySelectorAll('label')).find((node) => node.firstElementChild?.textContent === label)?.querySelector('input,textarea,select') as HTMLInputElement;
async function change(label: string, value: string) { const node = field(label); await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); }); }
async function selectFirst() { await click(host.querySelector<HTMLButtonElement>('.tscm-position')!); }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks(); f.allowed = true;
  f.fetch.mockResolvedValue({ ok: true, data: { items: [item, travel], prices: [] } });
  f.save.mockImplementation(async (_tenant: string, value: { name: string; priceNet: number }) => ({ ok: true, data: { items: [{ ...item, name: value.name, defaultPriceNet: value.priceNet }], prices: [] } }));
  f.history.mockResolvedValue({ ok: true, data: [] });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('company catalogue interactions (DOM, not visual acceptance)', () => {
  it('opens read-only at the requested travel category and exposes actual travel controls', async () => {
    await render('travel'); expect(f.seed).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.tscm-position')).toHaveLength(1); await selectFirst();
    expect(field('Bezeichnung *').value).toBe('Fahrtkosten'); expect(host.textContent).toContain('Fahrtkostenregel');
    expect(host.textContent).toContain('Klient:innen in Rechnung stellen');
  });
  it('protects draft selection and closing until changes are explicitly discarded', async () => {
    await render(); await selectFirst(); await change('Bezeichnung *', 'Entwurf'); await click(button('Fenster schließen'));
    expect(close).not.toHaveBeenCalled(); expect(host.getElementsByClassName('tscm-confirm')).toHaveLength(1);
    await click(button('Weiter bearbeiten')); expect(field('Bezeichnung *').value).toBe('Entwurf');
    await click(button('Fenster schließen')); await click(button('Änderungen verwerfen')); expect(close).toHaveBeenCalledOnce();
  });
  it('keeps invalid and rejected values available and reports success only after a confirmed save', async () => {
    await render(); await selectFirst(); await change('Nettopreis (€)', '32,75abc'); await click(button('Änderungen speichern'));
    expect(f.save).not.toHaveBeenCalled(); expect(host.textContent).toContain('gültigen Betrag');
    await change('Nettopreis (€)', '35,20'); f.save.mockResolvedValueOnce({ ok: false, error: 'Preis wurde nicht gespeichert.' });
    await click(button('Änderungen speichern')); expect(saved).not.toHaveBeenCalled(); expect(field('Nettopreis (€)').value).toBe('35,20');
    await click(button('Änderungen speichern')); expect(saved).toHaveBeenCalledOnce(); expect(f.save).toHaveBeenLastCalledWith('tenant-a', expect.objectContaining({ priceNet: 35.2, serviceKey: 'assist.support' }), 'business_admin');
  });
  it('prevents duplicate requests and ignores a completed request for the previous tenant', async () => {
    let resolve: (value: unknown) => void = () => {};
    f.save.mockImplementation(() => new Promise((done) => { resolve = done; }));
    await render(); await selectFirst(); await change('Bezeichnung *', 'Entwurf');
    await act(async () => { button('Änderungen speichern').click(); button('Änderungen speichern').click(); });
    expect(f.save).toHaveBeenCalledOnce(); await click(button('Fenster schließen')); expect(close).not.toHaveBeenCalled();
    await render(undefined, 'tenant-b'); await act(async () => resolve({ ok: true, data: { items: [item], prices: [] } }));
    expect(saved).not.toHaveBeenCalled(); expect(host.textContent).not.toContain('wurde gespeichert');
  });
  it('keeps write controls disabled without company edit permission', async () => {
    f.allowed = false; await render(); expect(button('+ Neue Position').disabled).toBe(true);
    await selectFirst(); expect(field('Bezeichnung *').closest('fieldset')?.disabled).toBe(true); expect(f.save).not.toHaveBeenCalled();
  });
  it('opens the requested position with its saved validity and keeps it on a description edit', async () => {
    const prices = [{ id: 'price-a', catalogId: item.id, priceNet: 32.75, taxMode: 'none', taxRate: 0, validFrom: '2027-01-01', validTo: '2027-12-31', isDefault: true }];
    f.fetch.mockResolvedValue({ ok: true, data: { items: [item, travel], prices } });
    await render(undefined, 'tenant-a', { initialItemId: item.id });
    expect(field('Bezeichnung *').value).toBe(item.name);
    expect(field('Preis gültig ab').value).toBe('2027-01-01');
    expect(field('Preis gültig bis').value).toBe('2027-12-31');
    await change('Bezeichnung *', 'Begleitung'); await click(button('Änderungen speichern'));
    expect(f.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ validFrom: '2027-01-01', validTo: '2027-12-31' }), 'business_admin');
  });
  it('opens a new position draft without writing or seeding data', async () => {
    await render('travel', 'tenant-a', { startCreating: true });
    expect(field('Bezeichnung *').value).toBe('');
    expect(field('Kategorie').value).toBe('travel');
    expect(field('Abrechnungseinheit').value).toBe('km');
    expect(f.save).not.toHaveBeenCalled(); expect(f.seed).not.toHaveBeenCalled();
    await click(button('Fenster schließen')); expect(close).not.toHaveBeenCalled();
  });
  it('never substitutes Assist when a locked module is requested', async () => {
    await render(undefined, 'tenant-a', { initialModuleKey: 'pflege', startCreating: true });
    expect(f.fetch).not.toHaveBeenCalled(); expect(f.save).not.toHaveBeenCalled();
    expect(button('+ Neue Position').disabled).toBe(true);
    expect(host.textContent).toContain('noch nicht freigegeben');
  });
  it('does not populate an item from a different module through a stale deep link', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: { items: [item, { ...travel, moduleKey: 'pflege' }], prices: [] } });
    await render(undefined, 'tenant-a', { initialItemId: travel.id });
    expect(host.querySelectorAll('.tscm-position')).toHaveLength(1);
    expect(host.textContent).toContain('nicht mehr verfügbar');
    expect(field('Bezeichnung *')).toBeUndefined();
  });

  it('opens all six standard templates without creating or seeding positions', async () => {
    await render(undefined, 'tenant-a', { startWithTemplates: true });
    expect(host.querySelectorAll('.tscm-template-card')).toHaveLength(6);
    expect(field('Bezeichnung *')).toBeUndefined();
    expect(f.save).not.toHaveBeenCalled(); expect(f.seed).not.toHaveBeenCalled();
    await click(button('Schließen')); expect(close).toHaveBeenCalledOnce();
  });

  it('creates an editable template draft with an open price and saves only on confirmation', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: { items: [], prices: [] } });
    f.save.mockImplementation(async (_tenant: string, value: TenantServiceCatalogItem & { priceNet?: number }) => ({ ok: true, data: {
      items: [{ ...value, id: 'new-position', defaultPriceNet: value.priceNet ?? null }], prices: [],
    } }));
    await render(undefined, 'tenant-a', { startWithTemplates: true });
    await click(host.querySelector<HTMLButtonElement>('button[aria-label="Alltagsbegleitung: Vorlage verwenden"]')!);
    expect(field('Bezeichnung *').value).toBe('Alltagsbegleitung');
    expect(field('Abrechnungseinheit').value).toBe('hour');
    expect(field('Nettopreis (€)').value).toBe('');
    expect(field('Steuerregel').value).toBe('');
    expect(f.save).not.toHaveBeenCalled();
    await change('Bezeichnung *', 'Individuelle Alltagsbegleitung');
    await click(button('Position anlegen'));
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({
      id: undefined, serviceKey: expect.stringMatching(/^assist\.alltagsbegleitung\.template_/),
      name: 'Individuelle Alltagsbegleitung', priceNet: undefined, taxMode: 'none', unit: 'hour',
    }), 'business_admin');
    expect(saved).toHaveBeenCalledOnce();
    await click(button('Standardvorlagen'));
    expect(host.querySelector('button[aria-label="Alltagsbegleitung: Vorhandene Position öffnen"]')).not.toBeNull();
  });

  it('requires an explicit tax rule before saving a template with a price', async () => {
    f.fetch.mockResolvedValue({ ok: true, data: { items: [], prices: [] } });
    await render(undefined, 'tenant-a', { startWithTemplates: true });
    await click(host.querySelector<HTMLButtonElement>('button[aria-label="Alltagsbegleitung: Vorlage verwenden"]')!);
    await change('Nettopreis (€)', '40,00');
    await click(button('Position anlegen'));
    expect(f.save).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Bitte eine Steuerregel für diesen Preis auswählen.');
    expect(field('Nettopreis (€)').value).toBe('40,00');
    await act(async () => {
      const select = field('Steuerregel');
      select.value = 'standard_19';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(button('Position anlegen'));
    expect(f.save).toHaveBeenCalledOnce();
    expect(f.save).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ priceNet: 40, taxMode: 'standard_19', taxRate: 19 }), 'business_admin');
  });

  it('opens an existing inactive standard position with its own values and price period unchanged', async () => {
    const existing = { ...item, serviceKey: 'assist.alltagsbegleitung', name: 'Eigene Begleitung', isActive: false };
    f.fetch.mockResolvedValue({ ok: true, data: { items: [existing], prices: [{ catalogId: item.id, validFrom: '2027-02-01', validTo: '2027-03-31' }] } });
    await render(undefined, 'tenant-a', { startWithTemplates: true });
    expect(host.textContent).toContain('Bereits im Katalog · inaktiv');
    await click(host.querySelector<HTMLButtonElement>('button[aria-label="Alltagsbegleitung: Vorhandene Position öffnen"]')!);
    expect(field('Bezeichnung *').value).toBe('Eigene Begleitung');
    expect(field('Nettopreis (€)').value).toBe('32,75');
    expect(field('Preis gültig ab').value).toBe('2027-02-01');
    expect(host.querySelector<HTMLInputElement>('.tscm-active input')?.checked).toBe(false);
    expect(button('Änderungen speichern').disabled).toBe(true);
    expect(f.save).not.toHaveBeenCalled();
  });

  it('protects edited values when switching to another template and returns to the editor on cancel', async () => {
    await render(); await selectFirst(); await change('Bezeichnung *', 'Mein Entwurf');
    await click(button('Standardvorlagen'));
    const choose = () => host.querySelector<HTMLButtonElement>('button[aria-label="Fahrtkosten (Kilometer): Vorlage verwenden"]')!;
    await click(choose()); expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(f.save).not.toHaveBeenCalled();
    await click(button('Weiter bearbeiten')); expect(field('Bezeichnung *').value).toBe('Mein Entwurf');
    await click(button('Standardvorlagen')); await click(choose()); await click(button('Änderungen verwerfen'));
    expect(field('Bezeichnung *').value).toBe('Fahrtkosten (Kilometer)');
    expect(field('Kategorie').value).toBe('travel'); expect(field('Abrechnungseinheit').value).toBe('km');
    expect(f.save).not.toHaveBeenCalled();
  });

  it('blocks template use without edit permission or a successfully loaded catalogue', async () => {
    f.allowed = false; await render(undefined, 'tenant-a', { startWithTemplates: true });
    expect(Array.from(host.querySelectorAll<HTMLButtonElement>('.tscm-template-card button')).every(node => node.disabled)).toBe(true);
    expect(f.save).not.toHaveBeenCalled();
    f.allowed = true; f.fetch.mockResolvedValue({ ok: false, error: 'Katalog nicht erreichbar.' });
    await render(undefined, 'tenant-b', { startWithTemplates: true });
    expect(host.textContent).toContain('Katalog nicht erreichbar.');
    expect(host.querySelectorAll('.tscm-template-card')).toHaveLength(0);
    expect(f.save).not.toHaveBeenCalled(); expect(f.seed).not.toHaveBeenCalled();
  });
});
