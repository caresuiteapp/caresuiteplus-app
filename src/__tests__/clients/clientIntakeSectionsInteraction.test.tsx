// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { getVisibleSectionsForClientContext, type IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import type { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import type { ClientIntakeSectionContentProps } from '@/components/office/ClientIntakeSections.web';
import { PRIVACY_TEMPLATE_KEY } from '@/features/intakeDocuments/intakeDocumentTypes';
import { getSystemCatalog } from '@/lib/catalogs/systemCatalogs';

// Keep the existing input boundaries small; the section layout, field routing,
// review validation, service selection and evidence checks are real components.
vi.mock('@/components/ui/PremiumInput', () => ({ PremiumInput: ({ label, value, onChangeText, hint }: { label: string; value: string; onChangeText: (value: string) => void; hint?: string }) => <label>{label}<input aria-label={label} value={value} onInput={(event) => onChangeText(event.currentTarget.value)} />{hint ? <span>{hint}</span> : null}</label> }));
vi.mock('@/components/inputs/CareCatalogSelect', () => ({ CareCatalogSelect: ({ label, value }: { label: string; value: string }) => <label>{label}<input aria-label={label} value={value} readOnly /></label> }));
vi.mock('@/components/inputs/CareMultiCatalogSelect', () => ({ CareMultiCatalogSelect: ({ catalogKey, values, onChange }: { catalogKey: string; values: string[]; onChange: (values: string[]) => void }) => <button data-catalog={catalogKey} data-values={JSON.stringify(values)} onClick={() => onChange([...values, 'system-choice'])}>Systemauswahl ergänzen</button> }));
vi.mock('@/components/office/assistCatalog/AssistCatalogMultiSelect', () => ({ AssistCatalogMultiSelect: ({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) => <button data-catalog="tenant" data-values={JSON.stringify(values)} onClick={() => onChange([...values, 'tenant-choice'])}>Unternehmensauswahl ergänzen</button> }));
vi.mock('@/components/inputs/CareAddressSearch', () => ({ CareAddressSearch: () => <div>Adresssuche</div> }));
vi.mock('@/components/inputs/CareDateInput', () => ({ CareDateInput: ({ label, value }: { label: string; value: string }) => <label>{label}<input aria-label={label} value={value} readOnly /></label> }));
vi.mock('@/components/inputs/CareCostBearerTypeFields', () => ({ CareCostBearerTypeFields: ({ type }: { type: string }) => <div data-carrier={type}>Kostenträgerdaten</div> }));
vi.mock('@/components/inputs/CareIntakeDocumentsStepPanel', () => ({ CareIntakeDocumentsStepPanel: () => <div data-testid="contract-panel">Vertragspanel</div> }));
vi.mock('@/components/documents/DocumentModuleTemplatesPanel', () => ({ DocumentModuleTemplatesPanel: ({ clientId }: { clientId: string }) => <div data-template-client={clientId}>Dokumentvorlagen</div> }));
vi.mock('@/lib/clients/clientIntakeService', async () => {
  const { getVisibleSectionsForClientContext } = await import('@/lib/clients/clientIntakeFieldRules');
  return { getIntakeStepsForContexts: getVisibleSectionsForClientContext };
});
import { ClientIntakeSectionContent } from '@/components/office/ClientIntakeSections.web';

let host: HTMLDivElement;
let root: Root;
let wizard: ReturnType<typeof useClientIntakeWizard>;
const navigate = vi.fn();
async function render(section: IntakeSectionKey, props: Partial<ClientIntakeSectionContentProps> = {}) {
  await act(async () => root.render(<ClientIntakeSectionContent section={section} wizard={wizard} contentStyles={{} as ClientIntakeSectionContentProps['contentStyles']} onNavigateSection={navigate} {...props} />));
}
function text() { return [...host.children].map((element) => { const clone = element.cloneNode(true) as HTMLElement; clone.querySelectorAll('style').forEach((style) => style.remove()); return clone.textContent; }).join(' '); }
function group(title: string) { const header = [...host.querySelectorAll('h3')].find((element) => element.textContent === title); if (!header) throw new Error(`Abschnitt fehlt: ${title}`); return header.closest('section')!; }
async function click(element: HTMLElement | null) { if (!element) throw new Error('Element fehlt'); await act(async () => element.click()); }
function checkbox(label: string) { return [...host.querySelectorAll('label')].find((element) => element.textContent?.includes(label))?.querySelector<HTMLInputElement>('input[type=checkbox]') ?? null; }
function reviewValue(label: string) { return [...host.querySelectorAll('dt')].find((entry) => entry.textContent === label)?.nextElementSibling?.textContent; }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  const form = { ...structuredClone(EMPTY_CLIENT_INTAKE_FORM), careContexts: ['daily_assistance'] as typeof EMPTY_CLIENT_INTAKE_FORM.careContexts };
  wizard = { form, errors: {}, steps: getVisibleSectionsForClientContext(form.careContexts), tenantId: 'tenant-a', isEditMode: false, createdId: null, loading: false, submitting: false, discardingDraft: false,
    updateField: vi.fn(), updateFundingSources: vi.fn(), updateCostBearerTypes: vi.fn(), replaceForm: vi.fn(), toggleCareContext: vi.fn(),
  } as unknown as ReturnType<typeof useClientIntakeWizard>;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

describe('web intake sections', () => {
  it('keeps service selection functional when mounted by an existing section editor', async () => {
    await render('leistungsart');
    const choice = host.querySelector<HTMLInputElement>('input[value="ambulatory_care"]');
    expect(choice).not.toBeNull(); await click(choice);
    expect(wizard.toggleCareContext).toHaveBeenCalledWith('ambulatory_care');
  });

  it('allows status changes only for an existing record and labels a new intake honestly', async () => {
    wizard.form.status = 'aktiv'; await render('stammdaten');
    expect(host.querySelector('input[aria-label="Aufnahmestatus"]')).toBeNull();
    await render('pruefung'); expect(reviewValue('Aufnahmestatus')).toBe('In Aufnahme');
    wizard.isEditMode = true; await render('stammdaten');
    expect(host.querySelector('input[aria-label="Aufnahmestatus"]')).not.toBeNull();
  });

  it('places the saved insurance number directly inside the private insurer group and edits the actual field', async () => {
    wizard.form.costBearerTypes = ['privatversicherung']; wizard.form.insuranceNumber = 'P123456';
    await render('kostentraeger');
    const input = group('Privatversicherung').querySelector<HTMLInputElement>('input[aria-label="Versichertennummer"]')!;
    expect(input?.value).toBe('P123456');
    await act(async () => { input.value = 'P654321'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(wizard.updateField).toHaveBeenCalledWith('insuranceNumber', 'P654321');
  });

  it('shows a shared number below each insurer without creating competing editable values', async () => {
    wizard.form.costBearerTypes = ['pflegekasse', 'krankenkasse']; wizard.form.insuranceNumber = 'A123456789';
    await render('kostentraeger');
    expect(host.querySelectorAll('input[aria-label^="Versichertennummer"]')).toHaveLength(1);
    expect(group('Pflegekasse').querySelector('input[aria-label^="Versichertennummer"]')).not.toBeNull();
    expect(group('Krankenkasse').textContent).toContain('A123456789');
    expect(text()).toContain('Eine gemeinsame Versichertennummer');
  });

  it('routes financing changes through the synchronizing wizard method', async () => {
    wizard.form.fundingSources = ['entlastungsleistung']; await render('kostentraeger');
    await click(checkbox('Selbstzahler'));
    expect(wizard.updateFundingSources).toHaveBeenCalledWith(['entlastungsleistung', 'selbstzahler']);
    expect(wizard.updateField).not.toHaveBeenCalled();
  });

  it('preserves existing unknown work-area assignments when adding and removing a visible area', async () => {
    wizard.form.assignedModules = ['office', 'legacy_assignment']; await render('module');
    await click(checkbox('Alltag & Betreuung'));
    expect(wizard.updateField).toHaveBeenLastCalledWith('assignedModules', ['office', 'legacy_assignment', 'assist']);
    await click(checkbox('Verwaltung'));
    expect(wizard.updateField).toHaveBeenLastCalledWith('assignedModules', ['legacy_assignment']);
    expect(text()).toContain('Portal & Freigaben'); expect(text()).not.toContain('legacy_assignment');
    expect(text()).toContain('erstellt noch keinen Zugangscode');
  });

  it('passes the full shared wish list to both catalogs so neither drops values from the other', async () => {
    const wishes = ['system-existing', 'tenant-existing']; wizard.form.supportWishes = wishes; await render('versorgung');
    const system = host.querySelector<HTMLButtonElement>('[data-catalog="support_tasks"]')!;
    const tenant = host.querySelector<HTMLButtonElement>('[data-catalog="tenant"]')!;
    expect(JSON.parse(system.dataset.values!)).toEqual(wishes); expect(JSON.parse(tenant.dataset.values!)).toEqual(wishes);
    await click(system); expect(wizard.updateField).toHaveBeenLastCalledWith('supportWishes', [...wishes, 'system-choice']);
    await click(tenant); expect(wizard.updateField).toHaveBeenLastCalledWith('supportWishes', [...wishes, 'tenant-choice']);
  });

  it('does not instantiate a document action for a nonexistent record or portray filenames as uploads', async () => {
    wizard.form.documentCategories = ['Bescheid.pdf']; await render('dokumente');
    expect(host.querySelector('[data-template-client]')).toBeNull();
    expect(text()).toContain('Hier wird noch keine externe Datei hochgeladen');
    expect(text()).toContain('Bescheid.pdf'); expect(text()).toContain('Nur Dateinamen, keine gespeicherten Anhänge');
    await render('dokumente', { clientId: 'real-client-id' });
    expect(host.querySelector('[data-template-client]')?.getAttribute('data-template-client')).toBe('real-client-id');
    expect(text()).not.toContain('client-001');
  });

  it('reviews required sections even if the current navigation omits them and uses readable service labels', async () => {
    wizard.steps = ['leistungsart', 'pruefung']; await render('pruefung');
    expect(text()).toContain('Vorname ist erforderlich.'); expect(text()).toContain('Straße ist erforderlich.');
    expect(reviewValue('Leistungsarten')).toBe('Alltagsbegleitung'); expect(text()).not.toContain('daily_assistance');
    expect(host.querySelector('[aria-label="Persönliche Angaben korrigieren"]')).toBeNull();
    expect(text()).not.toContain('bereit zur Aktivierung');
  });

  it('shows available support-wish labels and counts saved company choices without exposing their keys', async () => {
    const known = getSystemCatalog('support_tasks').entries[0]!;
    wizard.form.supportWishes = [known.key, 'tenant-private-key'];
    await render('pruefung');
    expect(reviewValue('Unterstützungswünsche')).toBe(`${known.label} · 1 weiterer gespeicherter Wunsch`);
    expect(text()).not.toContain('tenant-private-key');
  });

  it('keeps each yes/no radio pair in its own named group', async () => {
    await render('notfall_zugang');
    const pairs = [...host.querySelectorAll('.cs-intake-bool')].map((fieldset) => [...fieldset.querySelectorAll<HTMLInputElement>('input')]);
    expect(pairs).toHaveLength(2);
    for (const pair of pairs) { expect(pair[0]!.name).not.toBe(''); expect(pair[0]!.name).toBe(pair[1]!.name); }
    expect(pairs[0]![0]!.name).not.toBe(pairs[1]![0]!.name);
    await click(pairs[0]![1]!);
    expect(wizard.updateField).toHaveBeenCalledWith('elevatorAvailable', true);
  });

  it('opens the correct editable section from review and keeps insurance below carrier data', async () => {
    wizard.form.costBearerTypes = ['krankenkasse']; wizard.form.healthInsurance = 'Beispielkasse'; wizard.form.insuranceNumber = 'A123';
    await render('pruefung');
    await click(host.querySelector<HTMLButtonElement>('[aria-label="Finanzierung & Versicherung korrigieren"]'));
    expect(navigate).toHaveBeenCalledWith('kostentraeger');
    const labels = [...group('Finanzierung & Versicherung').querySelectorAll('dt')].map((entry) => entry.textContent);
    expect(labels.slice(-2)).toEqual(['Kostenträger', 'Versichertennummer']); expect(reviewValue('Versichertennummer')).toBe('A123');
  });

  it('requires real signature evidence instead of trusting a finalized status', async () => {
    wizard.form.intakeDocuments = [{ templateKey: PRIVACY_TEMPLATE_KEY, title: 'Datenschutz', documentType: 'privacy_consent', status: 'finalized', source: 'system', isRequired: true, version: 1, signatures: {}, missingPlaceholders: [], unresolvedKeys: [], previewHtml: null, finalizedHtml: '<p>Text</p>', renderedPdfPath: null, previewOpenedAt: null, finalizedAt: null }];
    await render('pruefung');
    const documents = group('Verträge & Einwilligungen');
    expect(documents.textContent).toContain('Noch keine Unterschrift erfasst');
    expect(documents.querySelector('.cs-intake-document-checklist li')?.textContent).toMatch(/^Offen/);
  });

  it('reuses the existing contract editor and shows stationary and consulting fields only where needed', async () => {
    await render('vertraege_einwilligungen'); expect(host.querySelector('[data-testid="contract-panel"]')).not.toBeNull();
    await render('versorgung'); expect(text()).not.toContain('Beratungsanlass');
    wizard.form.careContexts = ['consulting']; await render('versorgung'); expect(text()).toContain('Beratungsanlass *');
    wizard.form.careContexts = ['stationary_care']; await render('notfall_zugang');
    expect(host.querySelector('input[aria-label="Einrichtung *"]')).not.toBeNull();
    expect(host.querySelector('details')?.hasAttribute('open')).toBe(false);
  });

  it('starts a new review while retaining the complete old signed original in readable sandboxed history', async () => {
    const original = { templateKey: PRIVACY_TEMPLATE_KEY, title: 'Datenschutz', documentType: 'privacy_consent' as const, status: 'finalized' as const, source: 'system' as const, isRequired: true, version: 1, signatures: { client: { role: 'client' as const, dataUrl: 'data:image/png;base64,b2xk', signedAt: '2026-10-14T10:00:00.000Z', signerName: 'Person' } }, missingPlaceholders: [], unresolvedKeys: [], previewHtml: '<p>Unverändertes Original</p>', finalizedHtml: '<p>Unverändertes Original</p>', renderedPdfPath: null, previewOpenedAt: null, finalizedAt: '2026-10-14T10:00:00.000Z' };
    wizard.form.intakeDocuments = [original];
    await render('vertraege_einwilligungen');
    await click([...host.querySelectorAll('button')].find((button) => button.textContent === 'Neue Fassung prüfen') ?? null);
    const next = vi.mocked(wizard.replaceForm).mock.calls[0]![0];
    expect(next.intakeDocumentHistory).toEqual([original]);
    expect(next.intakeDocumentHistory![0]).not.toBe(original);
    expect(next.intakeDocuments[0]?.status).toBe('not_started');
    expect(next.intakeDocuments[0]?.signatures).toEqual({});
    expect(original.finalizedHtml).toBe('<p>Unverändertes Original</p>');
    wizard.form = next;
    await render('vertraege_einwilligungen');
    const frame = host.querySelector('iframe');
    expect(frame?.getAttribute('srcdoc')).toBe(original.finalizedHtml);
    expect(frame?.getAttribute('sandbox')).toBe('');
    expect(text()).toContain('Frühere Originalfassungen');
  });

  it('does not offer replacement of signed originals while editing an existing record', async () => {
    wizard.isEditMode = true;
    wizard.form.intakeDocuments = [{ templateKey: PRIVACY_TEMPLATE_KEY, title: 'Datenschutz', documentType: 'privacy_consent', status: 'finalized', source: 'system', isRequired: true, version: 1, signatures: {}, missingPlaceholders: [], unresolvedKeys: [], previewHtml: '<p>Original</p>', finalizedHtml: '<p>Original</p>', renderedPdfPath: null, previewOpenedAt: null, finalizedAt: '2026-10-14T10:00:00.000Z' }];
    await render('vertraege_einwilligungen');
    expect(text()).not.toContain('Eine neue Dokumentfassung prüfen');
    expect(wizard.replaceForm).not.toHaveBeenCalled();
  });
});
