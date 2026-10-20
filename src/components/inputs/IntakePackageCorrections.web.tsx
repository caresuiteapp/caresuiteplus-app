import { useState } from 'react';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { IntakeSectionKey } from '@/lib/clients/clientIntakeFieldRules';
import { clearDeselectedCostBearerTypes } from '@/lib/clients/clientIntakeCostBearerConfig';
import { changeIntakeDocumentSelection, type PackageIssue } from '@/features/intakeDocuments/intakeDocumentPackage';
import { ASSIGNMENT_TEMPLATE_KEY, OPTIONAL_CONSENT_TEMPLATE_KEYS } from '@/features/intakeDocuments/intakeDocumentTypes';
import { hasCollectedIntakeOriginal } from '@/features/intakeDocuments/restartIntakeDocumentReview';
import { CareCostBearerTypeFields } from './CareCostBearerTypeFields';

type Props = {
  form: ClientIntakeFormData;
  issues: PackageIssue[];
  tenantId: string | null;
  formId: string;
  onApply: (form: ClientIntakeFormData) => void;
  onNavigate?: (section: IntakeSectionKey) => void;
};

const QUICK_FIELDS = [
  { key: 'client.insurance_number', field: 'insuranceNumber', label: 'Versichertennummer', type: 'text' },
  { key: 'emergency.name', field: 'emergencyContactName', label: 'Name der Kontaktperson', type: 'text' },
  { key: 'emergency.phone', field: 'emergencyContactPhone', label: 'Telefon der Kontaktperson', type: 'tel' },
] as const;

function correctionSection(keys: string[]): IntakeSectionKey {
  if (keys.some(key => key.startsWith('cost_carrier.') || key === 'client.insurance_number' || key.startsWith('billing.'))) return 'kostentraeger';
  if (keys.some(key => key.startsWith('emergency.'))) return 'angehoerige';
  if (keys.some(key => key.startsWith('care.') || key.startsWith('consulting.'))) return 'versorgung';
  if (keys.some(key => key.startsWith('facility.'))) return 'notfall_zugang';
  return 'stammdaten';
}

/** Edits stay local until the complete package is regenerated for another review. */
export function IntakePackageCorrections({ form, issues, tenantId, formId, onApply, onNavigate }: Props) {
  const [draft, setDraft] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const keys = new Set(issues.flatMap(issue => issue.missingKeys ?? []));
  const locked = form.intakeDocuments.some(hasCollectedIntakeOriginal);
  const fields = QUICK_FIELDS.filter(field => keys.has(field.key));
  const needsCareFund = keys.has('cost_carrier.care_fund_name');
  const hasQuickFields = !locked && (fields.length > 0 || needsCareFund);
  const remove = (key: string) => {
    try {
      onApply(changeIntakeDocumentSelection(draft, key === ASSIGNMENT_TEMPLATE_KEY
        ? { intakeAssignmentEnabled: false }
        : { intakeOptionalConsents: draft.intakeOptionalConsents.filter(item => item !== key) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Die Auswahl konnte nicht geändert werden.'); }
  };
  const toggleCareFund = (checked: boolean) => setDraft(previous => {
    const types = checked ? [...previous.costBearerTypes, 'pflegekasse'] : previous.costBearerTypes.filter(type => type !== 'pflegekasse');
    return { ...clearDeselectedCostBearerTypes(previous, types), costBearerType: types[0] ?? '' };
  });

  return <form id={formId} className="cs-contract-corrections" onSubmit={event => { event.preventDefault(); onApply(draft); }}>
    <div><h3>Vor dem Unterschreiben ergänzen</h3><p>Diese Angaben fehlen in den ausgewählten Unterlagen. Ergänzen Sie sie hier oder entfernen Sie ein Zusatzdokument, wenn es nicht vereinbart wurde. Danach prüfen Sie die aktualisierte Vorschau.</p></div>
    {error ? <div className="cs-contract-notice is-error" role="alert">{error}</div> : null}
    <div className="cs-contract-correction-issues">{issues.map((issue, index) => {
      const removable = issue.templateKey === ASSIGNMENT_TEMPLATE_KEY || OPTIONAL_CONSENT_TEMPLATE_KEYS.some(key => key === issue.templateKey);
      return <section className="cs-contract-card" key={`${issue.title}-${index}`}><h3>{issue.title}</h3><p>{issue.message}</p><div className="cs-contract-tools">
        {onNavigate && issue.missingKeys?.length ? <button type="button" onClick={() => onNavigate(correctionSection(issue.missingKeys!))}>Im Aufnahmeformular ergänzen</button> : null}
        {removable ? <button type="button" aria-label={`${issue.title} aus Paket entfernen`} onClick={() => remove(issue.templateKey!)}>Zusatzdokument aus Paket entfernen</button> : null}
      </div></section>;
    })}</div>
    {locked ? <div className="cs-contract-notice">Es gibt bereits unterschriebene Originale. Ergänzen Sie die Angaben im Aufnahmeformular und starten Sie anschließend unter „Eine neue Dokumentfassung prüfen“ eine neue Fassung. Die bisherigen Originale bleiben erhalten.</div> : null}
    {hasQuickFields ? <section className="cs-contract-card"><h3>Fehlende Angaben</h3><div className="cs-contract-correction-fields">
      {fields.map(({ field, label, type }) => <label key={field} className="cs-contract-field"><span>{label}</span><input name={field} type={type} value={draft[field]} onChange={event => setDraft(previous => ({ ...previous, [field]: event.target.value }))} /></label>)}
      {needsCareFund ? <div className="cs-contract-carrier">
        {!form.costBearerTypes.includes('pflegekasse') ? <label className="cs-contract-acknowledgement"><input type="checkbox" checked={draft.costBearerTypes.includes('pflegekasse')} onChange={event => toggleCareFund(event.target.checked)}/><span>Pflegekasse als Kostenträger ergänzen, wenn diese die Leistungen übernimmt.</span></label> : null}
        {draft.costBearerTypes.includes('pflegekasse') ? <CareCostBearerTypeFields type="pflegekasse" form={draft} onChange={setDraft} tenantId={tenantId ?? undefined}/> : <p>Für die ausgewählte Abtretung ist eine Pflegekasse erforderlich. Prüfen Sie die Finanzierung oder entfernen Sie die Abtretung aus diesem Paket.</p>}
      </div> : null}
    </div></section> : null}
  </form>;
}
