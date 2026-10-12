// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ platform: 'android', wizard: {} as any, scroll: vi.fn(), wrapper: {} as any }));
vi.mock('@/hooks/useClientIntakeWizard', () => ({ useClientIntakeWizard: () => h.wizard }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24, top: 18 }) }));
vi.mock('react-native', async () => {
  const react = await import('react'); const Box = ({ children }: any) => react.createElement('div', null, children);
  return { View: Box, Text: Box, Platform: { get OS() { return h.platform; } },
    KeyboardAvoidingView: (props: any) => { h.wrapper = props; return react.createElement('div', null, props.children); },
    ScrollView: react.forwardRef(({ children }: any, ref) => { react.useImperativeHandle(ref, () => ({ scrollTo: h.scroll })); return react.createElement('div', null, children); }),
    StyleSheet: { create: (s: any) => s, hairlineWidth: 1 } };
});
vi.mock('@/components/office/assistCatalog/AssistCatalogMultiSelect', () => ({ AssistCatalogMultiSelect: () => null }));
vi.mock('@/components/office/ClientFundingSourceSelector', () => ({ ClientFundingSourceSelector: () => null }));
vi.mock('@/components/documents/DocumentModuleTemplatesPanel', () => ({ DocumentModuleTemplatesPanel: () => null }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useAdaptiveContentStyles: () => ({}) }));
vi.mock('@/design/tokens/radius', () => ({ careRadius: {} }));
vi.mock('@/design/tokens/spacing', () => ({ careSpacing: {} }));
vi.mock('@/theme', () => ({ spacing: { md: 16, sm: 8, xl: 32, lg: 24 } }));
vi.mock('@/components/inputs', () => ({ CareCatalogSelect: () => null, CareAddressSearch: () => null, CareCostBearerTypeFields: () => null,
  CareDateInput: ({ label, error }: any) => <div>{label}{error ? <span role="alert">{error}</span> : null}</div>,
  CareDocumentUpload: () => <button>Dateiauswahl</button>, CareIntakeDocumentsStepPanel: () => null, CareMultiCatalogSelect: () => null, CarePhotoCapturePrepared: () => null }));
vi.mock('@/components/ui', () => ({
  ErrorState: ({ message, onRetry }: any) => <div>{message}<button onClick={onRetry}>Erneut laden</button></div>,
  LoadingState: ({ message }: any) => <div>{message}</div>, SuccessState: ({ message }: any) => <div>{message}</div>,
  InfoBanner: ({ message }: any) => <div>{message}</div>, FilterChipGroup: () => null, FormStepper: () => null,
  SectionPanel: ({ children }: any) => <div>{children}</div>, PremiumInput: ({ label, value, onChangeText }: any) => <input aria-label={label} value={value} onInput={(e: any) => onChangeText(e.target.value)} />,
}));
vi.mock('@/components/office/ClientWorkspacePrimitives', () => ({
  ClientWorkspacePanel: ({ children, accessory }: any) => <div>{accessory}{children}</div>, ClientWorkspaceLiveBadge: ({ label }: any) => <span>{label}</span>,
  ClientWorkspaceButton: ({ label, disabled, loading, onPress }: any) => <button disabled={disabled || loading} onClick={onPress}>{label}</button>,
}));
import { ClientIntakeWizardForm } from '@/components/office/clientintakewizardform';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
let host: HTMLDivElement, root: Root;
async function render() { await act(async () => root.render(<ClientIntakeWizardForm />)); }
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks();
  h.wizard = { identityKey: 'A', form: { ...EMPTY_CLIENT_INTAKE_FORM, firstName: 'Anna' }, errors: {}, steps: ['stammdaten'], stepLabels: ['Stammdaten'], stepStatuses: ['active'], stepIndex: 0, currentSection: 'stammdaten',
    updateField: vi.fn(), saveDraft: vi.fn(), discardDraft: vi.fn(), nextStep: vi.fn(), prevStep: vi.fn(), goToStep: vi.fn(), submit: vi.fn(), retryLoad: vi.fn(),
    isFirstStep: true, isLastStep: false, isSuccess: false, isEditMode: false, draftSaveFeedback: null, draftSaving: false, draftIsSaved: false };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe.each(['web', 'android', 'ios'])('%s intake form behavior contract', (platform) => {
  beforeEach(() => { h.platform = platform; });
  it('keeps actual controlled inputs usable and provides the platform keyboard contract', async () => {
    await render(); const firstName = host.querySelector('[aria-label="Vorname *"]') as HTMLInputElement;
    expect(firstName.value).toBe('Anna'); await act(async () => { firstName.value = 'Neu'; firstName.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(h.wizard.updateField).toHaveBeenCalledWith('firstName', 'Neu');
    expect(h.wrapper.enabled).toBe(platform !== 'web'); expect(h.wrapper.behavior).toBe(platform === 'ios' ? 'padding' : 'height');
    expect(h.scroll).toHaveBeenCalledWith({ y: 0, animated: false });
  });
  it('does not label unsaved or failed work as secured and exposes a working draft action', async () => {
    await render(); expect(host.textContent).toContain('Noch nicht gesichert');
    h.wizard = { ...h.wizard, draftSaveFeedback: { variant: 'warning', message: 'Entwurf lokal erhalten. Serverfehler' } }; await render();
    expect(host.textContent).toContain('Sicherung prüfen'); expect(host.textContent).not.toContain('Entwurf gesichert');
    await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Als Entwurf speichern')!.click()); expect(h.wizard.saveDraft).toHaveBeenCalledOnce();
  });
  it('exposes load failure and a real retry rather than an editable empty record', async () => {
    h.wizard = { ...h.wizard, loadError: 'Datensatz konnte nicht geladen werden.' }; await render(); expect(host.querySelector('input')).toBeNull();
    await act(async () => host.querySelector('button')!.click()); expect(h.wizard.retryLoad).toHaveBeenCalledOnce();
  });
  it('exposes invalid optional dates and does not present a filename as uploaded content', async () => {
    h.wizard = { ...h.wizard, form: { ...h.wizard.form, careContexts: ['stationary_care'] }, errors: { admissionDate: 'Ungültiges Aufnahmedatum' } };
    await render(); expect(host.textContent).toContain('Ungültiges Aufnahmedatum'); expect(host.textContent).not.toContain('Leistungsbeginn *');
    h.wizard = { ...h.wizard, currentSection: 'dokumente', form: { ...h.wizard.form, documentCategories: ['Altvertrag.pdf'] } };
    await render(); expect(host.textContent).toContain('keine gespeicherten Dateien'); expect(host.textContent).toContain('Altvertrag.pdf');
    expect(host.textContent).toContain('derzeit nicht gespeichert'); expect(host.textContent).not.toContain('Dateiauswahl');
    expect(h.wizard.updateField).not.toHaveBeenCalled();
  });
});
