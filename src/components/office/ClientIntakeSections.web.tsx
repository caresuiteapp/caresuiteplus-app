import { getRequiredFieldsForIntake, CLIENT_INTAKE_PLANS } from '@/lib/clients/clientIntakePlan';
import { useId, type ReactNode } from 'react';
import { PremiumInput } from '@/components/ui/PremiumInput';
import { CareCatalogSelect } from '@/components/inputs/CareCatalogSelect';
import { CareMultiCatalogSelect } from '@/components/inputs/CareMultiCatalogSelect';
import { CareAddressSearch } from '@/components/inputs/CareAddressSearch';
import { CareDateInput } from '@/components/inputs/CareDateInput';
import { CareCostBearerTypeFields } from '@/components/inputs/CareCostBearerTypeFields';
import { CareIntakeDocumentsStepPanel } from '@/components/inputs/CareIntakeDocumentsStepPanel.web';
import { AssistCatalogMultiSelect } from '@/components/office/assistCatalog/AssistCatalogMultiSelect';
import { DocumentModuleTemplatesPanel } from '@/components/documents/DocumentModuleTemplatesPanel';
import type { useClientIntakeWizard } from '@/hooks/useClientIntakeWizard';
import type { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import type { LlganViewContext } from '@/design/tokens/lightLiquidGlassAuroraNebula';
import { getRequiredFieldsForClientContext, hasConsulting, hasStationaryCare, type IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { COST_BEARER_FIELD_ERRORS, COST_BEARER_TYPE_CONFIG, getCostBearerFieldValues, hasGkvCostBearerSelected, isCostBearerTypeKey } from '@/lib/clients/clientIntakeCostBearerConfig';
import { CLIENT_FUNDING_SOURCE_DESCRIPTIONS, CLIENT_FUNDING_SOURCE_KEYS, CLIENT_FUNDING_SOURCE_LABELS } from '@/types/clients/clientFundingSource';
import { getSystemCatalog } from '@/lib/catalogs/systemCatalogs';
import type { SystemCatalogKey } from '@/lib/catalogs/systemCatalog.types';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { validateIntakeStep } from '@/lib/clients/clientIntakeValidation';
import { getIntakeStepsForContexts } from '@/lib/clients/clientIntakeService';
import { listApplicableIntakeTemplates } from '@/features/intakeDocuments/buildIntakeDocumentContext';
import { validateIntakeDocumentsStep } from '@/features/intakeDocuments/validateIntakeDocuments';
import { INTAKE_DOCUMENT_STATUS_LABELS, type IntakeDocumentState } from '@/features/intakeDocuments/intakeDocumentTypes';
import { hasCollectedIntakeOriginal, restartIntakeDocumentReview } from '@/features/intakeDocuments/restartIntakeDocumentReview';
import { clientIntakeSectionsCss } from './clientIntakeSectionsCss.web';
import { ClientIntakeServiceChoice } from './ClientIntakeWelcome.web';

export type ClientIntakeSectionContentProps = {
  section: IntakeSectionKey;
  wizard: ReturnType<typeof useClientIntakeWizard>;
  contentStyles: ReturnType<typeof useAdaptiveContentStyles>;
  panelViewContext?: LlganViewContext;
  clientId?: string;
  showIntakeOnlyFields?: boolean;
  onNavigateSection?: (section: IntakeSectionKey) => void;
};

const SECTION_TITLES: Record<IntakeSectionKey, string> = {
  leistungsart: 'Gewünschte Unterstützung', stammdaten: 'Persönliche Angaben', adresse_kontakt: 'Adresse & Erreichbarkeit',
  versorgung: 'Versorgung & Wünsche', kostentraeger: 'Finanzierung & Versicherung', angehoerige: 'Kontakt im Notfall',
  notfall_zugang: 'Wohnen & Zugang', vertraege_einwilligungen: 'Verträge & Einwilligungen', dokumente: 'Weitere Unterlagen',
  module: 'Zuständigkeiten & Zugang', pruefung: 'Aufnahme prüfen',
};
const WORK_AREAS = [
  { key: 'office', title: 'Verwaltung', description: 'Stammdaten, Unterlagen und Abrechnung' },
  { key: 'assist', title: 'Alltag & Betreuung', description: 'Begleitung, Hauswirtschaft und Einsatzplanung' },
  { key: 'pflege', title: 'Ambulante Pflege', description: 'Pflege und Versorgung zu Hause' },
  { key: 'stationaer', title: 'Stationäre Pflege', description: 'Wohnen und Versorgung in einer Einrichtung' },
  { key: 'beratung', title: 'Beratung', description: 'Beratungsgespräche und weitere Begleitung' },
  { key: 'akademie', title: 'Schulung · vorbereitet', description: 'Die Zuordnung schaltet keine Schulungsfunktionen frei.' },
] as const;

function display(value: string | null | undefined) { return value?.trim() || 'Noch nicht angegeben'; }
function catalogLabel(key: SystemCatalogKey, value: string) {
  return getSystemCatalog(key).entries.find((entry) => entry.key === value)?.label ?? (value ? 'Weitere gespeicherte Auswahl' : 'Noch nicht ausgewählt');
}
function catalogLabels(key: SystemCatalogKey, values: string[]) {
  if (!values.length) return 'Noch nicht ausgewählt';
  return values.map((value) => catalogLabel(key, value)).join(' · ');
}
function supportWishLabels(values: string[]) {
  const catalog = getSystemCatalog('support_tasks');
  const known = values.flatMap((value) => {
    const entry = catalog.entries.find((item) => item.key === value);
    return entry ? [entry.label] : [];
  });
  const otherCount = values.length - known.length;
  if (otherCount) known.push(`${otherCount} ${otherCount === 1 ? 'weiterer gespeicherter Wunsch' : 'weitere gespeicherte Wünsche'}`);
  return known.join(' · ') || 'Noch nicht ausgewählt';
}
function Group({ title, description, children, className = '', action }: { title: string; description?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return <section className={`cs-intake-group ${className}`}><div className="cs-intake-group-header"><div><h3>{title}</h3>{description ? <p>{description}</p> : null}</div>{action}</div>{children}</section>;
}
function FieldGrid({ children }: { children: ReactNode }) { return <div className="cs-intake-field-grid">{children}</div>; }
function Full({ children }: { children: ReactNode }) { return <div className="cs-intake-field-full">{children}</div>; }
function Note({ children }: { children: ReactNode }) { return <p className="cs-intake-section-note">{children}</p>; }
function BoolChoice({ label, value, onChange, yes, no }: { label: string; value: boolean; onChange: (value: boolean) => void; yes: string; no: string }) {
  const name = useId();
  return <fieldset className="cs-intake-bool"><legend>{label}</legend><div>{[{ value: false, label: no }, { value: true, label: yes }].map((choice) => <label key={String(choice.value)} className={choice.value === value ? 'is-selected' : ''}><input type="radio" name={name} checked={choice.value === value} onChange={() => onChange(choice.value)} /><span>{choice.label}</span></label>)}</div></fieldset>;
}
function QuickText({ label, value, onChange, error, hint, choices = [] }: { label: string; value: string; onChange: (value: string) => void; error?: string; hint?: string; choices?: string[] }) {
  return <div className="cs-intake-quick-field"><PremiumInput label={label} value={value} onChangeText={onChange} error={error} hint={hint} multiline />{choices.length ? <div className="cs-intake-text-choices" aria-label={`Textvorschläge für ${label}`}><span>Übernehmen</span>{choices.map((choice) => <button type="button" key={choice} onClick={() => { if (!value.split('\n').includes(choice)) onChange(value.trim() ? `${value}\n${choice}` : choice); }}>{choice}</button>)}</div> : null}</div>;
}
function ReviewRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function documentEvidence(document: IntakeDocumentState) {
  if (['declined', 'skipped_optional', 'revoked', 'replaced'].includes(document.status)) return INTAKE_DOCUMENT_STATUS_LABELS[document.status];
  const signatures = Object.values(document.signatures).filter((signature) => Boolean(signature?.dataUrl)).length;
  if (signatures) return `${signatures} Unterschrift${signatures === 1 ? '' : 'en'} erfasst`;
  return 'Noch keine Unterschrift erfasst';
}

function IntakeReview({ wizard, onNavigateSection }: Pick<ClientIntakeSectionContentProps, 'wizard' | 'onNavigateSection'>) {
  const { form, steps } = wizard;
  const sections = (wizard.isEditMode ? steps : getIntakeStepsForContexts(form.careContexts)).filter((step) => step !== 'pruefung');
  const sectionErrors = sections.map((section) => ({ section, errors: Object.values(validateIntakeStep(section, form)).filter((error): error is string => Boolean(error)) }));
  const issueCount = sectionErrors.reduce((total, item) => total + item.errors.length, 0);
  const documents = validateIntakeDocumentsStep(form, listApplicableIntakeTemplates(form));
  const correction = (section: IntakeSectionKey) => onNavigateSection && steps.includes(section) ? <button type="button" className="cs-intake-correct" onClick={() => onNavigateSection(section)} aria-label={`${SECTION_TITLES[section]} korrigieren`}>Korrigieren <span aria-hidden="true">↗</span></button> : null;
  const selectedAreas = WORK_AREAS.filter((area) => form.assignedModules.includes(area.key)).map((area) => area.title);
  const otherAreas = form.assignedModules.filter((key) => !WORK_AREAS.some((area) => area.key === key));
  const carrierNames = form.costBearerTypes.filter(isCostBearerTypeKey).map((type) => `${COST_BEARER_TYPE_CONFIG[type].label}: ${display(getCostBearerFieldValues(form, type).name)}`);
  return <>
    <div className={`cs-intake-review-banner${issueCount ? ' has-issues' : ''}`} role="status"><span className="cs-intake-review-mark" aria-hidden="true">{issueCount ? '!' : '✓'}</span><div><strong>{issueCount ? `${issueCount} ${issueCount === 1 ? 'Angabe' : 'Angaben'} noch zu prüfen` : 'Die geprüften Pflichtangaben sind vorhanden'}</strong><p>Kontrollieren Sie die Angaben vor dem Sichern. Der Speicherstand wird am Formular angezeigt.</p></div></div>
    {issueCount ? <Group title="Hier fehlen noch Angaben" description="Öffnen Sie den jeweiligen Abschnitt, um die Angaben zu ergänzen."><div className="cs-intake-review-issues">{sectionErrors.filter((item) => item.errors.length).map((item) => <div key={item.section}><div><strong>{SECTION_TITLES[item.section]}</strong>{correction(item.section)}</div><ul>{[...new Set(item.errors)].map((error) => <li key={error}>{error}</li>)}</ul></div>)}</div></Group> : null}
    <div className="cs-intake-review-grid">
      <Group title="Person & Aufnahme" action={correction('stammdaten')}><dl className="cs-intake-review-data"><ReviewRow label="Name" value={display([form.firstName, form.lastName].filter(Boolean).join(' '))} /><ReviewRow label="Geburtsdatum" value={formatDate(form.dateOfBirth) || 'Noch nicht angegeben'} /><ReviewRow label="Aufnahmedatum" value={formatDate(form.admissionDate) || 'Noch nicht angegeben'} /><ReviewRow label="Leistungsbeginn" value={formatDate(form.serviceStart) || 'Noch nicht angegeben'} /><ReviewRow label="Aufnahmestatus" value={wizard.isEditMode ? catalogLabel('client_status', form.status) : 'In Aufnahme'} /></dl></Group>
      <Group title="Adresse & Kontakt" action={correction('adresse_kontakt')}><dl className="cs-intake-review-data"><ReviewRow label="Adresse" value={display([[form.street, form.houseNumber].filter(Boolean).join(' '), [form.zip, form.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))} /><ReviewRow label="Telefon" value={display(form.phone)} /><ReviewRow label="Mobil" value={display(form.mobile)} /><ReviewRow label="E-Mail" value={display(form.email)} /><ReviewRow label="Bevorzugter Kontaktweg" value={catalogLabel('contact_method', form.preferredContact)} /></dl></Group>
      <Group title="Gewünschte Unterstützung" action={correction('leistungsart')}><dl className="cs-intake-review-data"><ReviewRow label="Leistungsarten" value={catalogLabels('leistungsart', form.careContexts)} /><ReviewRow label="Pflegegrad" value={catalogLabel('care_level', form.careLevel)} /><ReviewRow label="Unterstützungswünsche" value={supportWishLabels(form.supportWishes)} /><ReviewRow label="Bevorzugte Zeiten" value={display(form.preferredTimes.map((value) => value.trim()).filter(Boolean).join(' · '))} />{hasConsulting(form.careContexts) ? <><ReviewRow label="Beratungsart" value={catalogLabel('consulting_types', form.consultingType)} /><ReviewRow label="Beratungsanlass" value={display(form.consultingReason)} /></> : null}</dl>{correction('versorgung')}</Group>
      <Group title="Finanzierung & Versicherung" action={correction('kostentraeger')}><dl className="cs-intake-review-data"><ReviewRow label="Finanzierungsarten" value={form.fundingSources.length ? form.fundingSources.map((key) => CLIENT_FUNDING_SOURCE_LABELS[key]).join(' · ') : 'Noch nicht ausgewählt'} /><ReviewRow label="Kostenträger" value={carrierNames.length ? carrierNames.join('\n') : 'Noch nicht ausgewählt'} /><ReviewRow label="Versichertennummer" value={display(form.insuranceNumber)} /></dl></Group>
      <Group title="Notfall & Wohnen" action={correction('notfall_zugang')}><dl className="cs-intake-review-data"><ReviewRow label="Kontakt im Notfall" value={display(form.emergencyContactName)} /><ReviewRow label="Notfall-Telefon" value={display(form.emergencyContactPhone)} />{hasStationaryCare(form.careContexts) ? <><ReviewRow label="Einrichtung" value={display(form.facilityName)} /><ReviewRow label="Wohnbereich" value={catalogLabel('stationary_areas', form.careArea)} /><ReviewRow label="Zimmer" value={display(form.roomNumber)} /></> : <ReviewRow label="Wohnungszugang" value={catalogLabels('home_access', form.homeAccess)} />}<ReviewRow label="Wichtige Zugangshinweise" value={display(form.accessNotes)} /></dl>{correction('angehoerige')}</Group>
      <Group title="Zuständige Arbeitsbereiche" action={correction('module')}><div className="cs-intake-review-tags">{selectedAreas.length ? selectedAreas.map((title) => <span key={title}>{title}</span>) : <p>Noch keine Zuordnung ausgewählt.</p>}{otherAreas.length ? <span>{otherAreas.length} weitere bestehende Zuordnung{otherAreas.length === 1 ? '' : 'en'}</span> : null}</div><Note>Die Zuordnung allein richtet keinen Zugang für Klient:innen oder Angehörige ein.</Note></Group>
    </div>
    {steps.includes('vertraege_einwilligungen') ? <Group title="Verträge & Einwilligungen" action={correction('vertraege_einwilligungen')} description="Prüfung anhand der vorgesehenen Unterlagen und der erfassten Unterschriften."><ul className="cs-intake-document-checklist">{documents.checklist.map((entry) => <li key={entry.key}><span className={entry.complete ? 'is-complete' : 'is-pending'}>{entry.complete ? 'Erfüllt' : 'Offen'}</span><span>{entry.label}</span></li>)}</ul>{form.intakeDocuments.length ? <div className="cs-intake-evidence-list">{form.intakeDocuments.map((document) => <div key={document.templateKey}><strong>{document.title || 'Aufnahmedokument'}</strong><span>{documentEvidence(document)}</span></div>)}</div> : <Note>Noch keine Aufnahmedokumente erstellt.</Note>}</Group> : null}
    {form.documentCategories.length ? <Note>Im Entwurf genannte Dateinamen sind keine hochgeladenen Dateien. Externe Unterlagen werden in der gespeicherten Akte hinzugefügt.</Note> : null}
  </>;
}

export function ClientIntakeSectionContent({ section, wizard, panelViewContext, clientId, showIntakeOnlyFields = true, onNavigateSection }: ClientIntakeSectionContentProps) {
  const { form, errors, updateField, updateFundingSources, updateCostBearerTypes, tenantId, replaceForm, createdId } = wizard;
  const required = getRequiredFieldsForIntake(form);
  const label = (text: string, field: string, always = false) => `${text}${always || required.includes(field) ? ' *' : ''}`;
  const stationary = hasStationaryCare(form.careContexts);
  const consulting = hasConsulting(form.careContexts);
  const clinical = stationary || form.careContexts.includes('ambulatory_care');
  const support = form.careContexts.some(context => ['daily_assistance', 'support_care', 'companionship'].includes(context));
  const contextual = form.intakeWorkflowVersion === 2;
  const showFacility = stationary || Boolean(form.facilityName || form.careArea || form.roomNumber);
  const resolvedClientId = clientId ?? createdId ?? wizard.draftClientId ?? undefined;
  const templateModules: ('assist' | 'pflege' | 'stationaer' | 'beratung')[] = contextual ? [...(support ? ['assist' as const] : []), ...(form.careContexts.includes('ambulatory_care') ? ['pflege' as const] : []), ...(stationary ? ['stationaer' as const] : []), ...(consulting ? ['beratung' as const] : [])] : ['assist'];
  const insuranceTypes = form.costBearerTypes.filter((type) => ['pflegekasse', 'krankenkasse', 'privatversicherung', 'unfallversicherung', 'berufsgenossenschaft'].includes(type));
  const firstInsuranceType = insuranceTypes[0];
  let content: ReactNode;

  if (section === 'stammdaten') {
    content = <>
      <Group title="Wer wird aufgenommen?" description="Name und Geburtsdatum werden für die Akte und die Aufnahmedokumente benötigt."><FieldGrid><PremiumInput label="Vorname *" value={form.firstName} onChangeText={(value) => updateField('firstName', value)} error={errors.firstName} /><PremiumInput label="Nachname *" value={form.lastName} onChangeText={(value) => updateField('lastName', value)} error={errors.lastName} /><CareDateInput label="Geburtsdatum *" value={form.dateOfBirth} onChange={(value) => updateField('dateOfBirth', value)} error={errors.dateOfBirth} /><CareCatalogSelect catalogKey="salutation" label="Anrede" value={form.salutation} onChange={(value) => updateField('salutation', value)} /><Full><CareCatalogSelect catalogKey="gender" label="Geschlecht" value={form.gender} onChange={(value) => updateField('gender', value)} /></Full></FieldGrid></Group>
      <Group title="Aufnahme & Beginn" description="Das Aufnahmedatum und der vereinbarte Leistungsbeginn können voneinander abweichen."><FieldGrid><CareDateInput label="Aufnahmedatum" value={form.admissionDate} onChange={(value) => updateField('admissionDate', value)} error={errors.admissionDate} /><CareDateInput label={label('Leistungsbeginn', 'serviceStart')} value={form.serviceStart} onChange={(value) => updateField('serviceStart', value)} error={errors.serviceStart} />{wizard.isEditMode ? <Full><CareCatalogSelect catalogKey="client_status" label="Aufnahmestatus" value={form.status} onChange={(value) => updateField('status', value)} /></Full> : null}<Full><CareCatalogSelect catalogKey="housing_form" label="Wohnform" value={form.housingForm} onChange={(value) => updateField('housingForm', value)} /></Full><Full><QuickText label="Interne Hinweise" value={form.specialNotes} onChange={(value) => updateField('specialNotes', value)} hint="Ergänzende Hinweise für die Aufnahme und weitere Bearbeitung." /></Full></FieldGrid></Group>
    </>;
  } else if (section === 'adresse_kontakt') {
    content = <>
      <Group title="Anschrift" description="Adresse suchen oder die Anschrift in den einzelnen Feldern eintragen."><CareAddressSearch values={{ street: form.street, houseNumber: form.houseNumber, zip: form.zip, city: form.city }} onChange={(address) => { updateField('street', address.street); updateField('houseNumber', address.houseNumber); updateField('zip', address.zip); updateField('city', address.city); }} errors={{ street: errors.street, zip: errors.zip, city: errors.city }} /></Group>
      <Group title="Wie erreichen wir die Person?" description="Mindestens eine Telefonnummer oder E-Mail-Adresse ist erforderlich."><FieldGrid><PremiumInput label="Telefon" value={form.phone} onChangeText={(value) => updateField('phone', value)} error={errors.phone} keyboardType="phone-pad" /><PremiumInput label="Mobiltelefon" value={form.mobile} onChangeText={(value) => updateField('mobile', value)} keyboardType="phone-pad" /><Full><PremiumInput label="E-Mail-Adresse" value={form.email} onChangeText={(value) => updateField('email', value)} error={errors.email} keyboardType="email-address" autoCapitalize="none" /></Full><Full><CareCatalogSelect catalogKey="contact_method" label="Bevorzugter Kontaktweg" value={form.preferredContact} onChange={(value) => updateField('preferredContact', value)} /></Full></FieldGrid></Group>
    </>;
  } else if (section === 'versorgung') {
    content = <>
      {!showIntakeOnlyFields ? <Group title="Pflegegrad"><FieldGrid><CareCatalogSelect catalogKey="care_level" label={label('Pflegegrad', 'careLevel')} value={form.careLevel} onChange={(value) => updateField('careLevel', value)} error={errors.careLevel} /><CareCatalogSelect catalogKey="care_level_status" label="Stand der Einstufung" value={form.careLevelStatus} onChange={(value) => updateField('careLevelStatus', value)} /><CareDateInput label="Pflegegrad gültig ab" value={form.careLevelValidFrom} onChange={(value) => updateField('careLevelValidFrom', value)} error={errors.careLevelValidFrom} /></FieldGrid></Group> : null}
      {!contextual || clinical || form.familyDoctor ? <Group title="Versorgung & Ansprechperson"><PremiumInput label={label('Hausärztliche Praxis', 'familyDoctor')} value={form.familyDoctor} onChangeText={(value) => updateField('familyDoctor', value)} error={errors.familyDoctor} /></Group> : null}
      {showIntakeOnlyFields && (consulting || form.consultingType || form.consultingReason) ? <Group title="Beratung" description="Beschreiben Sie, zu welchem Thema Unterstützung gewünscht wird."><CareCatalogSelect catalogKey="consulting_types" label={label('Beratungsart', 'consultingType')} value={form.consultingType} onChange={(value) => updateField('consultingType', value)} error={errors.consultingType} /><QuickText label={label('Beratungsanlass', 'consultingReason')} value={form.consultingReason} onChange={(value) => updateField('consultingReason', value)} error={errors.consultingReason} /></Group> : null}
      {!contextual || support || form.supportWishes.length > 0 ? <Group title="Wobei wird Unterstützung gewünscht?" description="Mehrere Wünsche können gemeinsam ausgewählt werden. Beide Auswahlen gehören zu derselben Wunschliste."><div className="cs-intake-selection-group"><CareMultiCatalogSelect catalogKey="support_tasks" label={label('Häufige Tätigkeiten', 'supportWishes')} values={form.supportWishes} onChange={(values) => updateField('supportWishes', values)} error={errors.supportWishes} /></div><div className="cs-intake-assist-choices"><AssistCatalogMultiSelect catalogKey="assist.intake.service_wish" label="Weitere Leistungen Ihres Unternehmens" values={form.supportWishes} onChange={(values) => updateField('supportWishes', values)} /></div><p className="cs-intake-selection-count">{form.supportWishes.length ? `${form.supportWishes.length} ${form.supportWishes.length === 1 ? 'Wunsch ausgewählt' : 'Wünsche ausgewählt'}` : 'Noch kein Unterstützungswunsch ausgewählt'}</p></Group> : null}
      {!contextual || support || clinical ? <Group title="Zeiten & persönliche Bedürfnisse"><FieldGrid><QuickText label="Bevorzugte Zeiten" value={form.preferredTimes.join('\n')} onChange={(value) => updateField('preferredTimes', value.split('\n'))} hint="Einen Zeitraum pro Zeile eintragen." choices={['Vormittags', 'Nachmittags', 'Nach Absprache']} /><QuickText label="Nicht mögliche Zeiten" value={form.excludedTimes.join('\n')} onChange={(value) => updateField('excludedTimes', value.split('\n'))} hint="Zum Beispiel wegen regelmäßiger Termine." /><QuickText label="Mobilität" value={form.mobility} onChange={(value) => updateField('mobility', value)} choices={['Selbstständig mobil', 'Rollator vorhanden', 'Rollstuhl vorhanden']} /><QuickText label="Orientierung" value={form.orientation} onChange={(value) => updateField('orientation', value)} choices={['Im vertrauten Umfeld selbstständig', 'Begleitung außerhalb der Wohnung gewünscht']} /><Full><QuickText label="Kommunikation" value={form.communication} onChange={(value) => updateField('communication', value)} choices={['Langsam und deutlich sprechen', 'Hörgerät vorhanden', 'Schriftliche Hinweise hilfreich']} /></Full></FieldGrid></Group> : null}
    </>;
  } else if (section === 'kostentraeger') {
    content = <>
      {showIntakeOnlyFields && (!contextual || clinical || support || form.careLevel) ? <Group title="Pflegegrad & Einstufung"><FieldGrid><CareCatalogSelect catalogKey="care_level" label={label('Pflegegrad', 'careLevel')} value={form.careLevel} onChange={(value) => updateField('careLevel', value)} error={errors.careLevel} /><CareCatalogSelect catalogKey="care_level_status" label="Stand der Einstufung" value={form.careLevelStatus} onChange={(value) => updateField('careLevelStatus', value)} /><CareDateInput label="Pflegegrad gültig ab" value={form.careLevelValidFrom} onChange={(value) => updateField('careLevelValidFrom', value)} error={errors.careLevelValidFrom} /></FieldGrid></Group> : null}
      <Group title="Wie werden die Leistungen finanziert?" description="Wählen Sie die vereinbarten Finanzierungsarten. Mehrere Arten lassen sich kombinieren."><div className="cs-intake-option-grid">{CLIENT_FUNDING_SOURCE_KEYS.map((key) => <label key={key} className={`cs-intake-option${form.fundingSources.includes(key) ? ' is-selected' : ''}`}><input type="checkbox" checked={form.fundingSources.includes(key)} onChange={() => updateFundingSources(form.fundingSources.includes(key) ? form.fundingSources.filter((value) => value !== key) : [...form.fundingSources, key])} /><span><strong>{CLIENT_FUNDING_SOURCE_LABELS[key]}</strong><small>{CLIENT_FUNDING_SOURCE_DESCRIPTIONS[key]}</small></span></label>)}</div>{errors.fundingSources || errors.billingTypes ? <p className="cs-intake-field-error" role="alert">{errors.fundingSources || errors.billingTypes}</p> : null}</Group>
      <Group title="Wer übernimmt die Kosten?" description="Kostenträger auswählen und die zugehörigen Angaben ergänzen."><CareMultiCatalogSelect catalogKey="cost_bearer_type" label="Zahlende Stellen" values={form.costBearerTypes} onChange={updateCostBearerTypes} error={errors.costBearerTypes} /></Group>
      {form.costBearerTypes.filter(isCostBearerTypeKey).map((type) => <Group key={type} title={COST_BEARER_TYPE_CONFIG[type].label} className="cs-intake-carrier-group"><CareCostBearerTypeFields type={type} form={form} onChange={replaceForm} tenantId={tenantId ?? undefined} error={errors[COST_BEARER_FIELD_ERRORS[type]]} />{type === firstInsuranceType ? <div className="cs-intake-insurance-number"><PremiumInput label={required.includes('insuranceNumber') && hasGkvCostBearerSelected(form.costBearerTypes) ? 'Versichertennummer *' : 'Versichertennummer'} value={form.insuranceNumber} onChangeText={(value) => updateField('insuranceNumber', value)} error={errors.insuranceNumber} autoCapitalize="characters" hint={insuranceTypes.length > 1 ? 'Eine gemeinsame Versichertennummer ist in der Akte vorgesehen. Abweichende Nummern in den zugehörigen Unterlagen festhalten.' : 'Die persönliche Nummer von der Versichertenkarte oder dem Versicherungsschein.'} /></div> : insuranceTypes.includes(type) ? <div className="cs-intake-insurance-reference"><span>Versichertennummer der Akte</span><strong>{form.insuranceNumber.trim() || 'Noch nicht angegeben'}</strong><small>Das Eingabefeld steht beim ersten ausgewählten Versicherungsträger.</small></div> : null}</Group>)}
      {!firstInsuranceType && form.insuranceNumber ? <Group title="Vorhandene Versichertennummer"><PremiumInput label="Versichertennummer" value={form.insuranceNumber} onChangeText={(value) => updateField('insuranceNumber', value)} error={errors.insuranceNumber} hint="Bereits gespeicherte Angabe. Bei reiner Selbstzahlung ist keine Versichertennummer erforderlich." /></Group> : null}
    </>;
  } else if (section === 'angehoerige') {
    content = <Group title="Wen sollen wir im Notfall kontaktieren?" description="Tragen Sie eine verlässlich erreichbare Kontaktperson ein. Die Angaben sind freiwillig."><FieldGrid><PremiumInput label="Name der Kontaktperson" value={form.emergencyContactName} onChangeText={(value) => updateField('emergencyContactName', value)} error={errors.emergencyContactName} /><PremiumInput label="Telefon der Kontaktperson" value={form.emergencyContactPhone} onChangeText={(value) => updateField('emergencyContactPhone', value)} error={errors.emergencyContactPhone} keyboardType="phone-pad" /></FieldGrid><Note>Weitere Angehörige, Betreuende und Vollmachten können später in der Akte ergänzt werden. Dieser Kontakt ersetzt keine Vollmacht.</Note></Group>;
  } else if (section === 'notfall_zugang') {
    const homeContent = <><CareMultiCatalogSelect catalogKey="home_access" label={label('Wie kommen Mitarbeitende hinein?', 'homeAccess')} values={form.homeAccess} onChange={(values) => updateField('homeAccess', values)} error={errors.homeAccess} /><FieldGrid><Full><CareCatalogSelect catalogKey="key_status" label="Schlüsselregelung" value={form.keyStatus} onChange={(value) => updateField('keyStatus', value)} /></Full><PremiumInput label="Schlüsselnummer" nativeID="client-intake-key-number" value={form.keyNumber} onChangeText={(value) => updateField('keyNumber', value)} sensitiveBusinessValue /><PremiumInput label="Schlüsseltresor-Code" nativeID="client-intake-key-safe-code" value={form.keySafeCode} onChangeText={(value) => updateField('keySafeCode', value)} sensitiveBusinessValue /><PremiumInput label="Türcode" value={form.doorCode} onChangeText={(value) => updateField('doorCode', value)} sensitiveBusinessValue /><PremiumInput label="Klingelname" value={form.bellName} onChangeText={(value) => updateField('bellName', value)} /><PremiumInput label="Etage" value={form.floor} onChangeText={(value) => updateField('floor', value)} /><BoolChoice label="Aufzug" value={form.elevatorAvailable} onChange={(value) => updateField('elevatorAvailable', value)} yes="Vorhanden" no="Nicht vorhanden" /><QuickText label="Parkmöglichkeiten" value={form.parkingNotes} onChange={(value) => updateField('parkingNotes', value)} choices={['Parken vor dem Haus möglich', 'Parkmöglichkeiten in der Umgebung']} /><QuickText label="Weitere Zugangshinweise" value={form.accessNotes} onChange={(value) => updateField('accessNotes', value)} choices={['Vor dem Besuch telefonisch melden', 'Bitte etwas länger an der Tür warten']} /></FieldGrid></>;
    content = <>
      {showFacility ? <Group title="Einrichtung & Wohnbereich"><FieldGrid><Full><PremiumInput label={label('Einrichtung', 'facility')} value={form.facilityName} onChangeText={(value) => updateField('facilityName', value)} error={errors.facilityName} /></Full><CareCatalogSelect catalogKey="stationary_areas" label={label('Wohnbereich', 'careArea')} value={form.careArea} onChange={(value) => updateField('careArea', value)} error={errors.careArea} /><PremiumInput label={label('Zimmernummer', 'roomNumber')} value={form.roomNumber} onChangeText={(value) => updateField('roomNumber', value)} error={errors.roomNumber} /></FieldGrid></Group> : null}
      {(stationary || contextual && !clinical && !support) && !form.careContexts.includes('ambulatory_care') ? <details className="cs-intake-optional-group" open={Boolean(form.homeAccess.length || form.keyNumber || form.keySafeCode || form.doorCode || form.accessNotes)}><summary>Wohnungszugang bei zusätzlichen Hausbesuchen<span>Bei Bedarf ergänzen</span></summary><div>{homeContent}</div></details> : <Group title="Zugang zur Wohnung" description="Halten Sie fest, wie der Besuch zuverlässig beginnen kann.">{homeContent}</Group>}
      {!contextual || clinical || support ? <Group title="Wohnumfeld & Sicherheit"><FieldGrid><CareCatalogSelect catalogKey="pets" label="Haustiere" value={form.pets} onChange={(value) => updateField('pets', value)} /><BoolChoice label="Rauchen im Haushalt" value={form.smokerHousehold} onChange={(value) => updateField('smokerHousehold', value)} yes="Raucherhaushalt" no="Nichtraucherhaushalt" /><QuickText label="Gefahrenstellen & Sturzgefahr" value={form.hazardNotes} onChange={(value) => updateField('hazardNotes', value)} choices={['Stufen im Eingangsbereich', 'Lose Teppiche vorhanden']} /><QuickText label="Hilfsmittel vor Ort" value={form.aidsOnSite} onChange={(value) => updateField('aidsOnSite', value)} choices={['Rollator', 'Rollstuhl', 'Duschstuhl']} /><QuickText label="Hygienehinweise" value={form.hygieneNotes} onChange={(value) => updateField('hygieneNotes', value)} /><QuickText label="Infektionshinweise" value={form.infectionNotes} onChange={(value) => updateField('infectionNotes', value)} /></FieldGrid></Group> : null}
      {errors.emergencyContactName || errors.emergencyContactPhone ? <div className="cs-intake-review-banner has-issues"><div><strong>Notfallkontakt prüfen</strong><p>{errors.emergencyContactName || errors.emergencyContactPhone}</p>{onNavigateSection ? <button type="button" className="cs-intake-correct" onClick={() => onNavigateSection('angehoerige')}>Kontaktperson ergänzen</button> : null}</div></div> : null}
    </>;
  } else if (section === 'vertraege_einwilligungen') {
    const originals = form.intakeDocuments.filter(hasCollectedIntakeOriginal);
    content = <>
      <div className="cs-intake-contracts"><CareIntakeDocumentsStepPanel form={form} errors={errors} tenantId={tenantId} onChange={replaceForm} panelViewContext={panelViewContext} onPersistPackage={wizard.isEditMode ? undefined : wizard.saveDocumentPackage} onNavigateSection={onNavigateSection} /></div>
      {!wizard.isEditMode && originals.length ? <Group title="Eine neue Dokumentfassung prüfen" description="Wenn Angaben oder Vorlagen geändert wurden, prüfen und unterschreiben Sie eine neue Fassung. Das bisherige Original bleibt erhalten."><div className="cs-intake-evidence-list">{originals.map((document) => <div key={document.templateKey}><strong>{document.title}</strong><button type="button" className="cs-intake-correct" disabled={wizard.submitting || wizard.draftSaving || (form.intakeDocumentHistory?.length ?? 0) >= 64} onClick={() => replaceForm(restartIntakeDocumentReview(form, document.templateKey))}>Neue Fassung prüfen</button></div>)}</div>{(form.intakeDocumentHistory?.length ?? 0) >= 64 ? <Note>Die maximale Anzahl früherer Fassungen ist erreicht. Die vorhandenen Originale bleiben erhalten.</Note> : null}</Group> : null}
      {form.intakeDocumentHistory?.length ? <Group title="Frühere Originalfassungen" description="Diese Fassungen bleiben unverändert erhalten und ersetzen keine neue Prüfung.">{form.intakeDocumentHistory.map((document, index) => <details key={`${document.templateKey}-${index}`} className="cs-intake-optional-group"><summary>{document.title || 'Aufnahmedokument'}<span>{documentEvidence(document)}</span></summary><div>{document.finalizedHtml || document.previewHtml ? <iframe title={`${document.title || 'Aufnahmedokument'} – frühere Originalfassung ${index + 1}`} srcDoc={document.finalizedHtml || document.previewHtml || ''} sandbox="" referrerPolicy="no-referrer" loading="lazy" style={{ width: '100%', height: 480, border: 0 }} /> : <Note>Für diese Fassung ist kein Dokumentinhalt verfügbar. Die erfassten Unterschriften bleiben im Entwurf erhalten.</Note>}</div></details>)}</Group> : null}
    </>;
  } else if (section === 'dokumente') {
    content = <>
      <Group title="Unterlagen zur Aufnahme" description="Verträge und Einwilligungen werden im vorherigen Abschnitt vorbereitet und unterschrieben."><div className="cs-intake-document-guidance"><span className="cs-intake-file-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 3H6v18h12V7Zm0 0v5h4M9 12h6m-6 4h6" /></svg></span><div><h4>Externe Dateien gehören in die gespeicherte Akte</h4><p>{resolvedClientId ? 'Weitere Dokumente laden Sie im Bereich „Dokumente & Nachweise“ dieser Akte hoch.' : 'Fotos, Bescheide und vorhandene PDFs lassen sich nach dem Anlegen der Akte unter „Dokumente & Nachweise“ hinzufügen. Hier wird noch keine externe Datei hochgeladen.'}</p></div></div>{onNavigateSection && wizard.steps.includes('vertraege_einwilligungen') ? <button type="button" className="cs-intake-correct" onClick={() => onNavigateSection('vertraege_einwilligungen')}>Verträge & Einwilligungen ansehen <span aria-hidden="true">→</span></button> : null}{form.documentCategories.length ? <div className="cs-intake-unsaved-files"><strong>Im Entwurf genannte Dateien</strong><ul>{form.documentCategories.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul><p>Nur Dateinamen, keine gespeicherten Anhänge.</p></div> : null}</Group>
      {contextual ? <Group title="Unterlagen nach Leistungsbereich">{form.careContexts.map(context => <div key={context}><strong>{catalogLabel('leistungsart', context)}</strong><p>{CLIENT_INTAKE_PLANS[context].documents}</p></div>)}</Group> : null}
      {resolvedClientId ? templateModules.map(module => <DocumentModuleTemplatesPanel key={module} tenantId={tenantId} targetModule={module} targetArea="intake" clientId={resolvedClientId} title={`Weitere Vorlagen · ${{ assist: 'Alltag & Betreuung', pflege: 'Ambulante Pflege', stationaer: 'Stationäre Pflege', beratung: 'Beratung' }[module]}`} subtitle="Vorlagen mit den bereits gespeicherten Angaben der Akte verwenden." />) : null}
    </>;
  } else if (section === 'module') {
    content = <>
      <Group title="Wer arbeitet mit dieser Akte?" description="Ordnen Sie die Akte den passenden Arbeitsbereichen zu. Bestehende Zugriffsrechte bleiben maßgeblich."><div className="cs-intake-option-grid">{WORK_AREAS.map((area) => <label key={area.key} className={`cs-intake-option${form.assignedModules.includes(area.key) ? ' is-selected' : ''}`}><input type="checkbox" checked={form.assignedModules.includes(area.key)} onChange={() => updateField('assignedModules', form.assignedModules.includes(area.key) ? form.assignedModules.filter((key) => key !== area.key) : [...form.assignedModules, area.key])} /><span><strong>{area.title}</strong><small>{area.description}</small></span></label>)}</div></Group>
      <Group title="Zugang für Klient:innen & Angehörige"><div className="cs-intake-document-guidance"><span className="cs-intake-file-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></svg></span><div><h4>Freigaben gezielt in der Akte einrichten</h4><p>Nach dem Anlegen wählen Sie unter „Portal & Freigaben“, welche Inhalte die Person oder ihre Angehörigen sehen dürfen. Die Auswahl oben erstellt noch keinen Zugangscode.</p></div></div></Group>
    </>;
  } else if (section === 'pruefung') {
    content = <IntakeReview wizard={wizard} onNavigateSection={onNavigateSection} />;
  } else {
    // Section editors render service selection here; the full wizard also uses it directly.
    content = <ClientIntakeServiceChoice wizard={wizard} />;
  }

  return <div className="cs-intake-sections" data-intake-section={section}><style>{clientIntakeSectionsCss}</style>{section !== 'leistungsart' ? <div className="cs-intake-section-heading"><h2>{SECTION_TITLES[section]}</h2><p>{section === 'pruefung' ? 'Alle Angaben vor dem Sichern noch einmal im Zusammenhang ansehen.' : section === 'vertraege_einwilligungen' ? 'Vorlagen prüfen und die tatsächlich benötigten Unterschriften erfassen.' : 'Mit * gekennzeichnete Angaben sind erforderlich.'}</p></div> : null}{content}</div>;
}
