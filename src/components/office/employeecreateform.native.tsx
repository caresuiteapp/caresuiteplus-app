// Generated native presentation from src/components/office/employeecreateform.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeH2,NativeP,NativeStyle,NativeButton,NativeForm,NativeSpan,NativeOl,NativeLi,NativeI,NativeFieldset,NativeLabel,NativeSelect,NativeOption,NativeDl,NativeDt,NativeDd,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployeeWizard } from "../../hooks/useEmployeeWizard.native.ts";
import { usePersonnelUnsavedChanges } from "../../hooks/usePersonnelUnsavedChanges.native.ts";
import { validateEmployeeForm } from '@/lib/office/employeeFormValidation';
import { resolveEmployeeDepartmentLabel, resolveEmployeeRoleLabel } from '@/lib/office/employeeCatalogLabels';
import type { EmployeeFormData, EmployeeFormErrors } from '@/types/forms/employeeForm';
import { EmployeeProfilePhotoPicker } from './EmployeeProfilePhotoPicker';
import { PersonnelCatalog } from "./PersonnelCatalog.native.tsx";
import { PersonnelField as Field, PersonnelIcon as Icon, PersonnelSection } from "./PersonnelPrimitives.native.tsx";
import { personnelCss } from "./personnelCss.native.ts";
import { PersonalWorkspaceSurface } from './PersonalWorkspaceSurface';
export type EmployeeCreateFormProps = {
    onCancel: () => void;
    onCreated?: (employeeId: string) => void;
};
export function EmployeeCreateForm(props: EmployeeCreateFormProps) {
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    return <NativeWorkspaceStyleScope css={[personnelCss]}>{<PersonalWorkspaceSurface><CreateForm key={`${tenantId}:${user?.id}:${profile?.id}:${profile?.roleKey}`} {...props}/></PersonalWorkspaceSurface>}</NativeWorkspaceStyleScope>;
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
        if (createdId && !warning && onCreated && !delivered.current) {
            delivered.current = true;
            onCreated(createdId);
        }
    }, [createdId, warning, onCreated]);
    useEffect(() => { formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [localErrors, wizard.errors]);
    const next = () => {
        const invalid = validateEmployeeForm(form);
        const relevant = step === 0 ? { firstName: invalid.firstName, lastName: invalid.lastName, email: invalid.email } : { jobTitle: invalid.jobTitle };
        const picked = Object.fromEntries(Object.entries(relevant).filter(([, value]) => !!value));
        if (Object.keys(picked).length) {
            setLocalErrors(picked);
            return;
        }
        setLocalErrors({});
        setStep(value => value + 1);
    };
    const cancel = async () => { if (!submitting && await allowCancel()) {
        wizard.cancel();
        onCancel();
    } };
    if (!can('office.employees.create') || isReadOnly)
        return <NativeWorkspaceStyleScope css={[personnelCss]}>{<NativeDiv className="pe-empty"><NativeH2>Keine Berechtigung zum Anlegen</NativeH2><NativeP>Ihre Rolle kann keine neuen Personalakten erstellen.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (createdId)
        return <NativeWorkspaceStyleScope css={[personnelCss, personnelCss]}>{<NativeDiv className="pe-form"><NativeStyle>{personnelCss}</NativeStyle><NativeDiv className="pe-form-scroll"><PersonnelSection title="Die Personalakte ist angelegt" description={warning || 'Die Angaben wurden gespeichert. Beschäftigung, Unterlagen und Portalzugang können jetzt ergänzt werden.'}><NativeButton className="pe-button pe-button--primary" onClick={() => { if (!delivered.current) {
            delivered.current = true;
            onCreated?.(createdId);
        } }}>Personalakte öffnen<Icon name="arrow"/></NativeButton></PersonnelSection></NativeDiv></NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[personnelCss, personnelCss]}>{<NativeForm ref={formRef} className="pe-form" data-personnel-dirty={dirty} aria-busy={submitting} onSubmit={event => { event.preventDefault(); if (submitting)
        return; if (step < 2)
        next();
    else
        void wizard.submit(); }} noValidate>
    <NativeStyle>{personnelCss}</NativeStyle><NativeDiv className="pe-form-scroll"><NativeDiv className="pe-form-intro"><NativeSpan><Icon name="person"/></NativeSpan><NativeDiv><NativeH2>Ein neues Teammitglied.</NativeH2><NativeP>Die Personalakte beginnt mit den Kontaktdaten und der Funktion. Verträge, Nachweise und Zugänge ergänzen Sie anschließend in der Akte.</NativeP></NativeDiv></NativeDiv><NativeOl className="pe-steps">{['Person & Kontakt', 'Organisation', 'Prüfen & anlegen'].map((label, index) => <NativeLi key={label} aria-current={step === index ? 'step' : undefined}><NativeI>{index + 1}</NativeI>{label}</NativeLi>)}</NativeOl>
      <NativeFieldset disabled={submitting} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {step === 0 ? <PersonnelSection title="Person & Kontakt" description="Pflichtfelder sind mit * gekennzeichnet."><NativeDiv className="pe-profile-row"><NativeDiv className="pe-profile"><EmployeeProfilePhotoPicker firstName={form.firstName} lastName={form.lastName} value={form.profilePhoto ?? { displayUri: null, pending: null, removed: false }} onChange={value => update('profilePhoto', value)} disabled={submitting}/></NativeDiv><NativeDiv className="pe-form-grid"><Field label="Vorname" required autoComplete="given-name" value={form.firstName} onChange={e => update('firstName', e.target.value)} error={errors.firstName}/><Field label="Nachname" required autoComplete="family-name" value={form.lastName} onChange={e => update('lastName', e.target.value)} error={errors.lastName}/><NativeDiv className="pe-full"><Field label="E-Mail" required type="email" autoComplete="email" value={form.email} onChange={e => update('email', e.target.value)} error={errors.email}/></NativeDiv><NativeDiv className="pe-full"><Field label="Telefon" type="tel" autoComplete="tel" value={form.phone} onChange={e => update('phone', e.target.value)}/></NativeDiv></NativeDiv></NativeDiv></PersonnelSection> : null}
        {step === 1 ? <PersonnelSection title="Organisation" description="Die berufliche Funktion vergibt keine Zugriffsrechte. Den Portalzugang richten Sie gesondert in der Personalakte ein."><NativeDiv className="pe-form-grid"><PersonnelCatalog catalog="employee_role" label="Funktion / Berufsbezeichnung" value={form.jobTitle} onChange={value => update('jobTitle', value)} error={errors.jobTitle} required/><PersonnelCatalog catalog="employee_department" label="Abteilung" value={form.department} onChange={value => update('department', value)}/><NativeDiv className="pe-field pe-full"><NativeLabel htmlFor="personnel-create-status">Status der neuen Akte</NativeLabel><NativeSelect id="personnel-create-status" value={form.status} onChange={e => update('status', e.target.value)}><NativeOption value="entwurf">Entwurf · Angaben noch ergänzen</NativeOption><NativeOption value="aktiv">Aktiv · bereits beschäftigt</NativeOption></NativeSelect><NativeSpan className="pe-field-help">Ein Entwurf bleibt auf dem Server gespeichert und ist über die Personalübersicht wieder erreichbar.</NativeSpan></NativeDiv></NativeDiv></PersonnelSection> : null}
        {step === 2 ? <PersonnelSection title="Angaben prüfen"><NativeDl>{[['Name', `${form.firstName} ${form.lastName}`], ['E-Mail', form.email], ['Telefon', form.phone || 'Nicht hinterlegt'], ['Funktion', resolveEmployeeRoleLabel(form.jobTitle)], ['Abteilung', resolveEmployeeDepartmentLabel(form.department)], ['Status', form.status === 'aktiv' ? 'Aktiv' : 'Entwurf']].map(([label, value]) => <NativeDiv key={label}><NativeDt>{label}</NativeDt><NativeDd>{value}</NativeDd></NativeDiv>)}</NativeDl><NativeP style={{ marginTop: 18 }}>Beim Anlegen wird kein Portalzugang erstellt und keine Einladung versendet.</NativeP></PersonnelSection> : null}
      </NativeFieldset>
      {wizard.submitError ? <NativeDiv className="pe-notice pe-notice--error" role="alert">{wizard.submitError}</NativeDiv> : null}
    </NativeDiv><NativeFooter className="pe-form-footer"><NativeSpan>{submitting ? 'Personalakte wird gespeichert …' : dirty ? 'Angaben noch nicht gespeichert' : 'Neue Personalakte'}</NativeSpan><NativeDiv><NativeButton type="button" className="pe-button" disabled={submitting} onClick={cancel}>Abbrechen</NativeButton>{step > 0 ? <NativeButton type="button" className="pe-button" disabled={submitting} onClick={() => setStep(value => value - 1)}>Zurück</NativeButton> : null}<NativeButton type="submit" className="pe-button pe-button--primary" disabled={submitting}>{submitting ? 'Wird gespeichert …' : step < 2 ? 'Weiter' : form.status === 'aktiv' ? 'Personalakte anlegen' : 'Entwurf anlegen'}<Icon name={step < 2 ? 'arrow' : 'check'}/></NativeButton></NativeDiv></NativeFooter>
  </NativeForm>}</NativeWorkspaceStyleScope>;
}
