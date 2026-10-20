import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployeeWizard } from '@/hooks/useEmployeeWizard.web';
import { usePersonnelUnsavedChanges } from '@/hooks/usePersonnelUnsavedChanges.web';
import { validateEmployeeForm } from '@/lib/office/employeeFormValidation';
import { resolveEmployeeDepartmentLabel, resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import type { EmployeeFormData, EmployeeFormErrors } from '@/types/forms/employeeForm';
import { EmployeeProfilePhotoPicker } from './EmployeeProfilePhotoPicker';
import { PersonnelCatalog } from './PersonnelCatalog.web';
import { PersonnelField as Field, PersonnelIcon as Icon, PersonnelSection } from './PersonnelPrimitives.web';
import { personnelCss } from './personnelCss.web';
import { PersonalWorkspaceSurface } from './PersonalWorkspaceSurface';

export type EmployeeCreateFormProps = { onCancel: () => void; onCreated?: (employeeId: string) => void };
export function EmployeeCreateForm(props: EmployeeCreateFormProps) {
  const { profile, user } = useAuth(); const tenantId = useServiceTenantId();
  return <PersonalWorkspaceSurface><CreateForm key={`${tenantId}:${user?.id}:${profile?.id}:${profile?.roleKey}`} {...props} /></PersonalWorkspaceSurface>;
}
function CreateForm({ onCancel, onCreated }: EmployeeCreateFormProps) {
  const wizard = useEmployeeWizard();
  const { can, isReadOnly } = usePermissions();
  const [step, setStep] = useState(0);
  const [localErrors, setLocalErrors] = useState<EmployeeFormErrors>({});
  const [dirty, setDirty] = useState(false);
  const delivered = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { form, submitting, createdId, warning } = wizard;
  const { confirmLeave: allowCancel } = usePersonnelUnsavedChanges(dirty && !createdId, submitting);
  const errors = { ...wizard.errors, ...localErrors };
  const update = <K extends keyof EmployeeFormData>(key: K, value: EmployeeFormData[K]) => { setDirty(true); setLocalErrors(previous => { const next = { ...previous }; delete next[key]; return next; }); wizard.updateField(key, value); };
  useEffect(() => {
    if (createdId && !warning && onCreated && !delivered.current) { delivered.current = true; onCreated(createdId); }
  }, [createdId, warning, onCreated]);
  useEffect(() => { formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [localErrors, wizard.errors]);
  const next = () => {
    const invalid = validateEmployeeForm(form);
    const relevant = step === 0 ? { firstName: invalid.firstName, lastName: invalid.lastName, email: invalid.email } : { jobTitle: invalid.jobTitle };
    const picked = Object.fromEntries(Object.entries(relevant).filter(([, value]) => !!value));
    if (Object.keys(picked).length) { setLocalErrors(picked); return; }
    setLocalErrors({}); setStep(value => value + 1);
  };
  const cancel = () => { if (!submitting && allowCancel()) { wizard.cancel(); onCancel(); } };
  if (!can('office.employees.create') || isReadOnly) return <div className="pe-empty"><h2>Keine Berechtigung zum Anlegen</h2><p>Ihre Rolle kann keine neuen Personalakten erstellen.</p></div>;
  if (createdId) return <div className="pe-form"><style>{personnelCss}</style><div className="pe-form-scroll"><PersonnelSection title="Die Personalakte ist angelegt" description={warning || 'Die Angaben wurden gespeichert. Beschäftigung, Unterlagen und Portalzugang können jetzt ergänzt werden.'}><button className="pe-button pe-button--primary" onClick={() => { if (!delivered.current) { delivered.current = true; onCreated?.(createdId); } }}>Personalakte öffnen<Icon name="arrow" /></button></PersonnelSection></div></div>;
  return <form ref={formRef} className="pe-form" data-personnel-dirty={dirty} aria-busy={submitting} onSubmit={event => { event.preventDefault(); if (submitting) return; if (step < 2) next(); else void wizard.submit(); }} noValidate>
    <style>{personnelCss}</style><div className="pe-form-scroll"><div className="pe-form-intro"><span><Icon name="person" /></span><div><h2>Ein neues Teammitglied.</h2><p>Die Personalakte beginnt mit den Kontaktdaten und der Funktion. Verträge, Nachweise und Zugänge ergänzen Sie anschließend in der Akte.</p></div></div><ol className="pe-steps">{['Person & Kontakt', 'Organisation', 'Prüfen & anlegen'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined}><i>{index + 1}</i>{label}</li>)}</ol>
      <fieldset disabled={submitting} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {step === 0 ? <PersonnelSection title="Person & Kontakt" description="Pflichtfelder sind mit * gekennzeichnet."><div className="pe-profile-row"><div className="pe-profile"><EmployeeProfilePhotoPicker firstName={form.firstName} lastName={form.lastName} value={form.profilePhoto ?? { displayUri: null, pending: null, removed: false }} onChange={value => update('profilePhoto', value)} disabled={submitting} /></div><div className="pe-form-grid"><Field label="Vorname" required autoComplete="given-name" value={form.firstName} onChange={e => update('firstName', e.target.value)} error={errors.firstName} /><Field label="Nachname" required autoComplete="family-name" value={form.lastName} onChange={e => update('lastName', e.target.value)} error={errors.lastName} /><div className="pe-full"><Field label="E-Mail" required type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} error={errors.email} /></div><div className="pe-full"><Field label="Telefon" type="tel" autoComplete="tel" value={form.phone} onChange={e => update('phone', e.target.value)} /></div></div></div></PersonnelSection> : null}
        {step === 1 ? <PersonnelSection title="Organisation" description="Die berufliche Funktion vergibt keine Zugriffsrechte. Den Portalzugang richten Sie gesondert in der Personalakte ein."><div className="pe-form-grid"><PersonnelCatalog catalog="employee_role" label="Funktion / Berufsbezeichnung" value={form.jobTitle} onChange={value => update('jobTitle', value)} error={errors.jobTitle} required /><PersonnelCatalog catalog="employee_department" label="Abteilung" value={form.department} onChange={value => update('department', value)} /><div className="pe-field pe-full"><label htmlFor="personnel-create-status">Status der neuen Akte</label><select id="personnel-create-status" value={form.status} onChange={e => update('status', e.target.value)}><option value="entwurf">Entwurf · Angaben noch ergänzen</option><option value="aktiv">Aktiv · bereits beschäftigt</option></select><span className="pe-field-help">Ein Entwurf bleibt auf dem Server gespeichert und ist über die Personalübersicht wieder erreichbar.</span></div></div></PersonnelSection> : null}
        {step === 2 ? <PersonnelSection title="Angaben prüfen"><dl>{[['Name', `${form.firstName} ${form.lastName}`], ['E-Mail', form.email], ['Telefon', form.phone || 'Nicht hinterlegt'], ['Funktion', resolveEmployeeRoleLabel(form.jobTitle)], ['Abteilung', resolveEmployeeDepartmentLabel(form.department)], ['Status', form.status === 'aktiv' ? 'Aktiv' : 'Entwurf']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p style={{ marginTop: 18 }}>Beim Anlegen wird kein Portalzugang erstellt und keine Einladung versendet.</p></PersonnelSection> : null}
      </fieldset>
      {wizard.submitError ? <div className="pe-notice pe-notice--error" role="alert">{wizard.submitError}</div> : null}
    </div><footer className="pe-form-footer"><span>{submitting ? 'Personalakte wird gespeichert …' : dirty ? 'Angaben noch nicht gespeichert' : 'Neue Personalakte'}</span><div><button type="button" className="pe-button" disabled={submitting} onClick={cancel}>Abbrechen</button>{step > 0 ? <button type="button" className="pe-button" disabled={submitting} onClick={() => setStep(value => value - 1)}>Zurück</button> : null}<button type="submit" className="pe-button pe-button--primary" disabled={submitting}>{submitting ? 'Wird gespeichert …' : step < 2 ? 'Weiter' : form.status === 'aktiv' ? 'Personalakte anlegen' : 'Entwurf anlegen'}<Icon name={step < 2 ? 'arrow' : 'check'} /></button></div></footer>
  </form>;
}
