// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';

const f = vi.hoisted(() => ({
  wizard: {} as ReturnType<typeof useClientIntakeWizard>, hook: vi.fn(), allowed: true, demo: true,
  validate: vi.fn(), cancel: vi.fn(), created: vi.fn(), updated: vi.fn(), closeRequest: null as (() => void) | null,
}));
vi.mock('@/hooks/useClientIntakeWizard', () => ({ useClientIntakeWizard: (options: unknown) => { f.hook(options); return f.wizard; } }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => f.allowed, isReadOnly: !f.allowed }) }));
vi.mock('@/lib/clients/clientBackend', () => ({ isDemoClientBackend: () => f.demo }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useAdaptiveContentStyles: () => ({}) }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() } }));
vi.mock('@/lib/clients/clientIntakeService', async () => {
  const { EMPTY_CLIENT_INTAKE_FORM } = await import('@/types/forms/clientIntakeForm');
  return { createEmptyIntakeForm: () => structuredClone(EMPTY_CLIENT_INTAKE_FORM) };
});
vi.mock('@/lib/clients/clientIntakeValidation', () => ({ validateIntakeStep: f.validate, hasIntakeErrors: (errors: object) => Object.keys(errors).length > 0 }));
vi.mock('@/components/office/ClientIntakeSections.web', () => ({ ClientIntakeSectionContent: ({ section, wizard }: { section: string; wizard: ReturnType<typeof useClientIntakeWizard> }) => (
  <div data-testid="intake-section"><span>{section}</span><input aria-label="Vorname" value={wizard.form.firstName} onChange={(event) => wizard.updateField('firstName', event.target.value)} /></div>
) }));
vi.mock('@/components/office/ClientIntakeWelcome.web', () => ({
  ClientIntakeServiceChoice: ({ wizard }: { wizard: ReturnType<typeof useClientIntakeWizard> }) => <button onClick={() => wizard.toggleCareContext('daily_assistance')}>Alltagsbegleitung auswählen</button>,
  ClientIntakeDossierPreview: () => <aside aria-label="Aufnahmevorschau" />,
}));
import { ClientIntakeWizardForm } from '@/components/office/clientintakewizardform.web';
import { ClientIntakeModal } from '@/components/office/clientintakemodal.web';
import { ClientFirstContact } from '@/components/office/ClientFirstContact.web';

let host: HTMLDivElement;
let root: Root;
let previousOverflow: string;
type FormProps = ComponentProps<typeof ClientIntakeWizardForm>;
const steps: IntakeSectionKey[] = ['leistungsart', 'stammdaten', 'dokumente', 'pruefung'];
function setStep(index: number) {
  f.wizard = { ...f.wizard, stepIndex: index, currentSection: steps[index]!, isFirstStep: index === 0, isLastStep: index === steps.length - 1,
    stepStatuses: steps.map((_, position) => position === index ? 'active' : position < index ? 'completed' : 'pending') };
}
function selectContext() { f.wizard = { ...f.wizard, form: { ...f.wizard.form, careContexts: ['daily_assistance'] }, hasPersistedDraft: true }; }
async function render(props: Partial<FormProps> = {}) {
  await act(async () => root.render(<ClientIntakeWizardForm onCancel={f.cancel} onCreated={f.created} onUpdated={f.updated} onCloseRequestChange={(handler) => { f.closeRequest = handler; }} {...props} />));
}
function button(label: string, scope: ParentNode = host) {
  const element = [...scope.querySelectorAll('button')].find((item) => item.textContent?.trim() === label || item.getAttribute('aria-label') === label);
  if (!element) throw new Error(`Button fehlt: ${label}; vorhanden: ${[...scope.querySelectorAll('button')].map((item) => item.textContent).join(' | ')}`);
  return element;
}
const hasButton = (label: string) => [...host.querySelectorAll('button')].some((item) => item.textContent?.trim() === label);
const click = async (label: string, scope?: ParentNode) => { await act(async () => button(label, scope).click()); };
const requestClose = async () => { await act(async () => f.closeRequest?.()); };
const progress = () => Number(host.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow'));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.clearAllMocks();
  f.allowed = true; f.demo = true; f.closeRequest = null; f.validate.mockReset().mockReturnValue({});
  f.wizard = {
    identityKey: 'tenant-a:actor-a:create', form: structuredClone(EMPTY_CLIENT_INTAKE_FORM), errors: {}, steps,
    stepLabels: ['Leistungsart', 'Stammdaten', 'Dokumente', 'Prüfung'], stepIndex: 0, currentSection: 'leistungsart', stepStatuses: ['active', 'pending', 'pending', 'pending'],
    tenantId: 'tenant-a', contextHint: '', submitting: false, submitError: null, createdId: null, loading: false, loadError: null, notFound: false,
    isEditMode: false, draftLoaded: true, draftRestored: false, draftSaveFeedback: null, draftSaving: false, draftConflict: false, draftClientId: null, reloadServerDraft: vi.fn().mockResolvedValue(true), draftIsSaved: false, discardingDraft: false, hasPersistedDraft: false,
    updateField: vi.fn(), updateBillingTypes: vi.fn(), updateFundingSources: vi.fn(), updateCostBearerTypes: vi.fn(), commitCostBearer: vi.fn(), removeCostBearer: vi.fn(), replaceForm: vi.fn(), toggleCareContext: vi.fn(), toggleArrayField: vi.fn(),
    nextStep: vi.fn().mockReturnValue(true), prevStep: vi.fn(), goToStep: vi.fn(), submit: vi.fn().mockResolvedValue('client-created'), discardDraft: vi.fn().mockResolvedValue(true), saveDraft: vi.fn().mockResolvedValue(true), saveFirstContact: vi.fn().mockResolvedValue(true), saveDocumentPackage: vi.fn().mockResolvedValue(true), resetWizard: vi.fn(), retryLoad: vi.fn(),
    isFirstStep: true, isLastStep: false, isSuccess: false,
  };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  previousOverflow = document.body.style.overflow;
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); document.querySelector('[data-test-intake-opener]')?.remove(); document.body.style.overflow = previousOverflow; });

describe('web intake entry and completion boundaries', () => {
  it('blocks a denied intake before mounting the data hook', async () => {
    f.allowed = false; await render();
    expect(f.hook).not.toHaveBeenCalled(); expect(host.querySelector('input')).toBeNull(); expect(f.wizard.submit).not.toHaveBeenCalled();
  });

  it('starts at zero and cannot submit an empty service selection even when it is the only available step', async () => {
    f.wizard = { ...f.wizard, steps: ['leistungsart'], stepLabels: ['Leistungsart'], stepStatuses: ['active'], isLastStep: true };
    await render(); expect(progress()).toBe(0); expect(hasButton('Klient:in aufnehmen')).toBe(false);
    await click('Alltagsbegleitung auswählen'); expect(f.wizard.toggleCareContext).toHaveBeenCalledWith('daily_assistance');
    expect(f.wizard.submit).not.toHaveBeenCalled();
  });

  it('does not offer completion before review even if the hook reports a last step', async () => {
    selectContext(); setStep(1); f.wizard = { ...f.wizard, isLastStep: true }; await render();
    expect(hasButton('Klient:in aufnehmen')).toBe(false); expect(f.wizard.submit).not.toHaveBeenCalled();
  });

  it('does not turn a direct jump into completed work', async () => {
    selectContext(); await render(); const start = progress();
    const navigation = host.querySelector('nav')!;
    expect([...navigation.querySelectorAll('button')].slice(2).every((item) => item.disabled)).toBe(true);
    setStep(3); await render();
    expect(progress()).toBeLessThan(100); expect(progress()).toBeLessThanOrEqual(start + 25);
    expect(f.wizard.submit).not.toHaveBeenCalled();
  });

  it('only counts valid visited sections and removes completion when their data becomes invalid', async () => {
    selectContext(); await render(); const start = progress();
    setStep(1); await render(); const completedPersonalDetails = progress(); expect(completedPersonalDetails).toBeGreaterThan(start);
    f.validate.mockImplementation((section: IntakeSectionKey) => section === 'stammdaten' ? { firstName: 'Vorname fehlt' } : {});
    setStep(0); await render(); expect(progress()).toBe(start);
    f.validate.mockReturnValue({}); await render(); expect(progress()).toBe(completedPersonalDetails);
  });

  it('keeps forward navigation on the current section when its validation fails and exposes the error summary', async () => {
    selectContext(); vi.mocked(f.wizard.nextStep).mockReturnValue(false); await render();
    const nextSection = host.querySelectorAll<HTMLButtonElement>('nav button')[1]!;
    await act(async () => nextSection.click()); expect(f.wizard.nextStep).toHaveBeenCalledOnce(); expect(f.wizard.goToStep).not.toHaveBeenCalled();
    f.wizard = { ...f.wizard, errors: { careContexts: 'Bitte Unterstützung auswählen' } }; await render();
    const summary = [...host.querySelectorAll('[role="alert"]')].find((item) => item.textContent?.includes('Bitte Unterstützung auswählen'));
    expect(summary).toBeDefined(); expect(document.activeElement).toBe(summary);
  });

  it('does not show editable fields while loading or after load failure and exposes a real retry', async () => {
    f.wizard = { ...f.wizard, loading: true }; await render(); expect(host.querySelector('input')).toBeNull(); expect(host.querySelector('[role="status"]')).not.toBeNull();
    f.wizard = { ...f.wizard, loading: false, loadError: 'Entwurf nicht lesbar' }; await render();
    expect(host.querySelector('input')).toBeNull(); expect(host.querySelector('[role="alert"]')?.textContent).toContain('Entwurf nicht lesbar');
    await click('Erneut laden'); expect(f.wizard.retryLoad).toHaveBeenCalledOnce();
  });

  it('offers the existing record when an older lead has no full server snapshot', async () => {
    f.wizard = { ...f.wizard, loadError: 'Diese frühere Aufnahme enthält noch keinen vollständigen Serverentwurf.' };
    await render({ clientId: '11111111-1111-4111-8111-111111111111' });
    const recordLink = host.querySelector<HTMLAnchorElement>('a');
    expect(recordLink?.textContent).toBe('Klientenakte öffnen');
    expect(recordLink?.getAttribute('href')).toContain('11111111-1111-4111-8111-111111111111');
    expect(f.wizard.submit).not.toHaveBeenCalled();
  });
  it('submits only on review in demo mode and reports the confirmed created id once', async () => {
    selectContext(); setStep(3); const pending = deferred<string | null>(); vi.mocked(f.wizard.submit).mockReturnValueOnce(pending.promise); await render();
    await act(async () => { const submit = button('Klient:in aufnehmen'); submit.click(); submit.click(); });
    expect(f.wizard.submit).toHaveBeenCalledOnce(); expect(f.created).not.toHaveBeenCalled();
    await act(async () => pending.resolve('client-confirmed'));
    expect(f.created).toHaveBeenCalledExactlyOnceWith('client-confirmed'); expect(f.updated).not.toHaveBeenCalled();
  });

  it('offers live completion on review and calls the confirmed backend path', async () => {
    f.demo = false; selectContext(); setStep(3); await render();
    expect(hasButton('Klient:in aufnehmen')).toBe(true); await click('Klient:in aufnehmen');
    expect(f.wizard.submit).toHaveBeenCalledOnce(); expect(f.created).toHaveBeenCalledExactlyOnceWith('client-created');
    expect(host.textContent).not.toContain('nicht verfügbar');
  });

  it('blocks completion on a revision conflict and explains explicit server-version adoption', async () => {
    f.demo = false; selectContext(); setStep(3); f.wizard = { ...f.wizard, draftConflict: true }; await render();
    expect(button('Klient:in aufnehmen').disabled).toBe(true);
    expect(host.textContent).toContain('ungesicherten Änderungen werden dabei verworfen');
    await click('Server- und Aktenangaben übernehmen'); expect(f.wizard.reloadServerDraft).toHaveBeenCalledOnce();
    expect(f.wizard.submit).not.toHaveBeenCalled();
  });

  it('routes a confirmed edit to onUpdated and never calls the creation callback', async () => {
    selectContext(); setStep(3); f.wizard = { ...f.wizard, isEditMode: true, identityKey: 'tenant-a:actor-a:edit:client-a' }; await render({ mode: 'edit', clientId: 'client-a' });
    await click('Änderungen speichern'); expect(f.hook).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'edit', clientId: 'client-a' }));
    expect(f.updated).toHaveBeenCalledExactlyOnceWith('client-created'); expect(f.created).not.toHaveBeenCalled();
  });
});

describe('web intake modal integration', () => {
  async function modal(visible = true) {
    await act(async () => root.render(<ClientIntakeModal visible={visible} onClose={f.cancel} onCreated={f.created} onUpdated={f.updated} />));
  }
  async function escape() {
    await act(async () => document.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  }

  it('routes both Escape and the header close action through the same unsaved-work guard', async () => {
    selectContext(); await modal(); await escape();
    expect(f.cancel).not.toHaveBeenCalled(); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    await click('Weiter bearbeiten', document.body); expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    await click('Aufnahme schließen', document.body);
    expect(f.cancel).not.toHaveBeenCalled(); expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('does not let Escape close the modal while saving a draft for a requested close', async () => {
    selectContext(); const pending = deferred<boolean>(); vi.mocked(f.wizard.saveDraft).mockReturnValueOnce(pending.promise);
    await modal(); await click('Aufnahme schließen', document.body); await click('Speichern und schließen', document.body); await escape();
    expect(f.cancel).not.toHaveBeenCalled(); expect(f.wizard.saveDraft).toHaveBeenCalledOnce();
    await act(async () => pending.resolve(false)); expect(f.cancel).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it('restores the opener focus and original page scroll setting after the modal closes', async () => {
    const opener = document.createElement('button'); opener.setAttribute('data-test-intake-opener', ''); opener.textContent = 'Neuaufnahme öffnen'; document.body.append(opener); opener.focus();
    document.body.style.overflow = 'scroll'; await modal(); expect(document.body.style.overflow).toBe('hidden');
    expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    await modal(false); expect(document.body.style.overflow).toBe('scroll'); expect(document.activeElement).toBe(opener);
  });
});

describe('web intake draft and close guards', () => {
  it('closes an untouched intake directly but asks before closing a changed intake', async () => {
    await render(); expect(f.closeRequest).not.toBeNull(); await requestClose(); expect(f.cancel).toHaveBeenCalledOnce();
    f.cancel.mockClear(); selectContext(); await render(); await requestClose();
    expect(f.cancel).not.toHaveBeenCalled(); expect(hasButton('Speichern und schließen')).toBe(true);
    await click('Weiter bearbeiten'); expect(f.wizard.saveDraft).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled();
  });

  it('retains the close prompt after a failed save and closes only after a confirmed retry', async () => {
    selectContext(); vi.mocked(f.wizard.saveDraft).mockResolvedValueOnce(false); await render(); await requestClose(); await click('Speichern und schließen');
    expect(f.cancel).not.toHaveBeenCalled(); expect(hasButton('Weiter bearbeiten')).toBe(true);
    await click('Speichern und schließen'); expect(f.wizard.saveDraft).toHaveBeenCalledTimes(2); expect(f.cancel).toHaveBeenCalledOnce();
  });

  it('allows a deliberate close after failed saving only through the explicitly warned alternative', async () => {
    selectContext(); vi.mocked(f.wizard.saveDraft).mockResolvedValue(false); await render(); await requestClose(); await click('Speichern und schließen');
    expect(f.cancel).not.toHaveBeenCalled(); expect(f.wizard.saveDraft).toHaveBeenCalledOnce();
    const confirmation = host.querySelector('[role="alertdialog"]')!;
    expect(confirmation.textContent).toContain('ungesicherte Änderungen verloren gehen');
    await click('Ohne erneute Sicherung schließen', confirmation);
    expect(f.cancel).toHaveBeenCalledOnce(); expect(f.wizard.saveDraft).toHaveBeenCalledOnce();
    expect(f.wizard.discardDraft).not.toHaveBeenCalled(); expect(f.wizard.submit).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before discarding the current draft', async () => {
    selectContext(); await render(); await click('Entwurf löschen'); expect(f.wizard.discardDraft).not.toHaveBeenCalled();
    await click('Weiter bearbeiten'); expect(f.wizard.discardDraft).not.toHaveBeenCalled();
    await click('Entwurf löschen'); await click('Entwurf löschen bestätigen'); expect(f.wizard.discardDraft).toHaveBeenCalledOnce(); expect(f.cancel).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('keeps the reset confirmation, entered data and progress when draft removal is not confirmed', async () => {
    selectContext(); setStep(1); f.wizard = { ...f.wizard, form: { ...f.wizard.form, firstName: 'Beibehalten' } };
    vi.mocked(f.wizard.discardDraft).mockResolvedValueOnce(false); await render(); const previousProgress = progress();
    await click('Entwurf löschen'); await click('Entwurf löschen bestätigen');
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect([...host.querySelectorAll('[role="alert"]')].some((element) => element.textContent?.includes('Die Löschung ist noch nicht bestätigt'))).toBe(true);
    expect(host.querySelector<HTMLInputElement>('[aria-label="Vorname"]')!.value).toBe('Beibehalten'); expect(progress()).toBe(previousProgress);
    expect(f.wizard.resetWizard).not.toHaveBeenCalled(); expect(f.cancel).not.toHaveBeenCalled();
  });

  it('does not reuse a previous identity close request or a pending save result', async () => {
    selectContext(); const pending = deferred<boolean>(); vi.mocked(f.wizard.saveDraft).mockReturnValueOnce(pending.promise);
    await render(); await requestClose(); await click('Speichern und schließen');
    f.wizard = { ...f.wizard, identityKey: 'tenant-b:actor-b:create', form: structuredClone(EMPTY_CLIENT_INTAKE_FORM), hasPersistedDraft: false }; await render();
    await act(async () => pending.resolve(true)); expect(f.cancel).not.toHaveBeenCalled();
    expect(hasButton('Speichern und schließen')).toBe(false);
  });
});


describe('first-contact workspace', () => {
  it('allows removing an unscheduled appointment request after calendar permission is lost', async () => {
    f.allowed = false;
    f.wizard = { ...f.wizard, form: { ...f.wizard.form, intakeStage: 'first_contact', intakeAppointmentRequested: true } };
    await act(async () => root.render(<ClientFirstContact wizard={f.wizard} />));
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.disabled).toBe(false);
    await act(async () => checkbox.click());
    expect(f.wizard.updateField).toHaveBeenCalledWith('intakeAppointmentRequested', false);
  });
  it('shows basic contact fields and a save action without requiring the full intake', async () => {
    f.wizard = { ...f.wizard, form: { ...f.wizard.form, intakeWorkflowVersion:2,intakeStage:'first_contact',lastName:'Beispiel',phone:'03012345' } };
    await render();
    expect(host.querySelector('[aria-label="Erstkontakt erfassen"]')).not.toBeNull();
    expect(host.textContent).toContain('Geburtsdatum, Versorgung, Kostenträger und Unterschriften ergänzen');
    expect(hasButton('Klient:in aufnehmen')).toBe(false);
    await click('Erstkontakt speichern');
    expect(f.wizard.saveFirstContact).toHaveBeenCalledOnce(); expect(f.wizard.submit).not.toHaveBeenCalled();
    await click('Aufnahme vervollständigen →');
    expect(f.wizard.updateField).toHaveBeenCalledWith('intakeStage','full_intake');
  });
  it('confirms a requested calendar appointment before moving into the complete intake', async () => {
    f.wizard = { ...f.wizard, form: { ...f.wizard.form,intakeStage:'first_contact',intakeAppointmentRequested:true } };
    vi.mocked(f.wizard.saveFirstContact).mockResolvedValueOnce(false);
    await render(); await click('Aufnahme vervollständigen →');
    expect(f.wizard.updateField).not.toHaveBeenCalledWith('intakeStage','full_intake');
    expect(host.textContent).toContain('Bitte zuerst die Erstkontaktdaten und den Termin prüfen');
    await click('Aufnahme vervollständigen →');
    expect(f.wizard.updateField).toHaveBeenCalledWith('intakeStage','full_intake');
  });
});
