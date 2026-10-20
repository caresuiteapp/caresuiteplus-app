import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployeeEditWizard } from '@/hooks/useEmployeeEditWizard.web';
import { usePersonnelUnsavedChanges } from '@/hooks/usePersonnelUnsavedChanges.web';
import type { EmployeeEditFormData } from '@/types/forms/employeeEditForm';
import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/lib/office/employeeCatalogLabels';
import { PersonnelField as Field, PersonnelSection, PersonnelIcon as Icon } from './PersonnelPrimitives.web';
import { PersonnelCatalog } from './PersonnelCatalog.web';
import { EmployeeProfilePhotoPicker } from './EmployeeProfilePhotoPicker';
import { PersonalWorkspaceSurface } from './PersonalWorkspaceSurface';
import { personnelCss } from './personnelCss.web';

export type EmployeeEditFormProps = {
  employeeId: string; onCancel: () => void; onUpdated?: () => void; onOpenPersonnelRecord?: () => void;
  sectionOnly?: EmployeeEditSectionKey; modalShell?: boolean;
  onShellActions?: (actions: { submit: () => Promise<void>; submitting: boolean }) => void;
};
export function EmployeeEditForm(props: EmployeeEditFormProps) {
  const { profile, user } = useAuth(); const tenantId = useServiceTenantId();
  return <PersonalWorkspaceSurface><EditForm key={`${tenantId}:${user?.id}:${profile?.id}:${profile?.roleKey}:${props.employeeId}`} {...props} /></PersonalWorkspaceSurface>;
}
function EditForm({ employeeId, onCancel, onUpdated, sectionOnly, modalShell = false, onShellActions }: EmployeeEditFormProps) {
  const wizard = useEmployeeEditWizard(employeeId);
  const { can, isReadOnly } = usePermissions();
  const [tab, setTab] = useState(sectionOnly === 'anstellung' ? 1 : sectionOnly === 'qualifikationen' ? 2 : 0);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const { form, errors, submitting, updateField, submit } = wizard;
  const { confirmLeave, releaseAfterSave } = usePersonnelUnsavedChanges(dirty && !wizard.saved, submitting);
  const update = <K extends keyof EmployeeEditFormData>(key: K, value: EmployeeEditFormData[K]) => { setDirty(true); updateField(key, value); };
  const handleSubmit = useCallback(async () => { if (await submit()) { releaseAfterSave(); setDirty(false); onUpdated?.(); } }, [submit, onUpdated, releaseAfterSave]);
  useEffect(() => { onShellActions?.({ submit: handleSubmit, submitting }); }, [handleSubmit, submitting, onShellActions]);
  useEffect(() => {
    const keys = Object.keys(errors);
    if (!keys.length) return;
    setTab(keys.includes('weeklyHours') ? 1 : 0);
  }, [errors]);
  useEffect(() => { formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors, tab]);
  const cancel = () => { if (!submitting && confirmLeave()) onCancel(); };
  const field = (key: keyof EmployeeEditFormData, label: string, type = 'text', required = false) => <Field label={label} type={type} required={required} value={String(form[key] ?? '')} onChange={event => update(key, event.target.value as never)} error={errors[key]} />;
  if (!can('office.employees.edit') || isReadOnly) return <div className="pe-empty"><h2>Keine Bearbeitungsberechtigung</h2><p>Ihre Rolle kann diese Personalakte nur einsehen.</p></div>;
  if (wizard.loading) return <div className="pe-empty" role="status" aria-busy="true">Personalakte wird geladen …</div>;
  if (wizard.notFound || wizard.loadError) return <div className="pe-empty" role="alert"><h2>Personalakte nicht verfügbar</h2><p>{wizard.loadError || 'Die Personalakte wurde nicht gefunden.'}</p><button className="pe-button" onClick={onCancel}>Zurück zur Akte</button></div>;
  return <form ref={formRef} className="pe-form" data-personnel-dirty={dirty && !wizard.saved} aria-busy={submitting} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} noValidate>
    <style>{personnelCss}</style><div className="pe-form-scroll"><div className="pe-form-intro"><span><Icon name="edit" /></span><div><h2>{`${form.firstName} ${form.lastName}`.trim() || 'Personalakte bearbeiten'}</h2><p>Persönliche Angaben, Beschäftigung und Nachweise bearbeiten. Die Änderungen werden gemeinsam gespeichert.</p></div></div>
      <div className="pe-inline-tabs" role="tablist" aria-label="Angaben bearbeiten">{['Person & Kontakt', 'Beschäftigung & Adresse', 'Qualifikationen'].map((label, index) => <button type="button" key={label} role="tab" aria-selected={tab === index} aria-controls={`${prefix}-panel`} id={`${prefix}-tab-${index}`} disabled={submitting} onClick={() => setTab(index)}>{label}</button>)}</div>
      {wizard.submitError ? <div className="pe-notice pe-notice--error" role="alert">{wizard.submitError}</div> : null}
      {wizard.saved ? <div className="pe-notice" role="status">Die Änderungen wurden gespeichert.</div> : null}
      <fieldset disabled={submitting} role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${tab}`} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {tab === 0 ? <PersonnelSection title="Person & Kontakt"><div className="pe-profile-row"><div className="pe-profile"><EmployeeProfilePhotoPicker firstName={form.firstName} lastName={form.lastName} value={form.profilePhoto} onChange={value => update('profilePhoto', value)} disabled={submitting} /></div><div className="pe-form-grid">{field('firstName', 'Vorname', 'text', true)}{field('lastName', 'Nachname', 'text', true)}<div className="pe-full">{field('email', 'E-Mail', 'email')}</div>{field('phone', 'Telefon', 'tel')}{field('mobile', 'Mobil', 'tel')}<PersonnelCatalog catalog="employee_role" label="Funktion / Berufsbezeichnung" value={form.roleKey} onChange={value => update('roleKey', value)} error={errors.roleKey} required /><PersonnelCatalog catalog="employee_department" label="Abteilung" value={form.departmentKey} onChange={value => update('departmentKey', value)} /><PersonnelCatalog catalog="employee_status" label="Status" value={form.status} onChange={value => update('status', value)} /><div className="pe-field pe-full"><label htmlFor={`${prefix}-notes`}>Interne Hinweise</label><textarea id={`${prefix}-notes`} value={form.notes} onChange={event => update('notes', event.target.value)} /></div></div></div></PersonnelSection> : null}
        {tab === 1 ? <div style={{ display: 'grid', gap: 18 }}><PersonnelSection title="Beschäftigung"><div className="pe-form-grid">{field('entryDate', 'Eintrittsdatum', 'date')}<div className="pe-field"><label htmlFor={`${prefix}-employment`}>Beschäftigungsart</label><select id={`${prefix}-employment`} value={form.employmentType} onChange={event => update('employmentType', event.target.value)}><option value="">Bitte auswählen</option>{form.employmentType && !EMPLOYMENT_TYPE_OPTIONS.some(option => option.key === form.employmentType) ? <option value={form.employmentType}>{form.employmentType}</option> : null}{EMPLOYMENT_TYPE_OPTIONS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}</select></div><Field label="Wochenstunden" inputMode="decimal" value={form.weeklyHours} onChange={event => update('weeklyHours', event.target.value)} error={errors.weeklyHours} /></div></PersonnelSection><PersonnelSection title="Adresse"><div className="pe-form-grid">{field('street', 'Straße')}{field('houseNumber', 'Hausnummer')}{field('postalCode', 'Postleitzahl')}{field('city', 'Ort')}</div></PersonnelSection></div> : null}
        {tab === 2 ? <PersonnelSection title="Qualifikationen & Nachweise" description="Die Angaben beschreiben vorhandene Nachweise. Die zugehörigen Unterlagen werden unter Dokumente & Nachweise abgelegt."><div className="pe-form-grid">{([['hasFirstAidCertificate', 'Erste-Hilfe-Nachweis vorhanden'], ['hasDriverLicense', 'Führerschein vorhanden'], ['hasPoliceClearance', 'Führungszeugnis vorhanden']] as const).map(([key, label]) => <label className="pe-check pe-full" key={key}><input type="checkbox" checked={form[key]} onChange={event => update(key, event.target.checked)} />{label}</label>)}{form.hasDriverLicense ? field('driverLicenseClass', 'Führerscheinklasse') : null}{form.hasPoliceClearance ? field('policeClearanceDate', 'Ausstellungsdatum Führungszeugnis', 'date') : null}</div></PersonnelSection> : null}
      </fieldset>
    </div>{!modalShell ? <footer className="pe-form-footer"><span>{submitting ? 'Änderungen werden gespeichert …' : dirty ? 'Nicht gespeicherte Änderungen' : 'Alle Angaben geladen'}</span><div><button type="button" className="pe-button" disabled={submitting} onClick={cancel}>Abbrechen</button><button type="submit" className="pe-button pe-button--primary" disabled={submitting || !dirty}><Icon name="check" />{submitting ? 'Wird gespeichert …' : 'Änderungen speichern'}</button></div></footer> : null}
  </form>;
}
