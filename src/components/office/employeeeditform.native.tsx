// Generated native presentation from src/components/office/employeeeditform.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeDiv,NativeH2,NativeP,NativeButton,NativeForm,NativeStyle,NativeSpan,NativeFieldset,NativeLabel,NativeTextarea,NativeSelect,NativeOption,NativeInput,NativeFooter,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import {confirmNativeWorkspaceAction,runNativeWorkspaceEffect} from '@/lib/platform/nativeWorkspaceActions.native';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployeeEditWizard } from "../../hooks/useEmployeeEditWizard.native.ts";
import { usePersonnelUnsavedChanges } from "../../hooks/usePersonnelUnsavedChanges.native.ts";
import type { EmployeeEditFormData } from '@/types/forms/employeeEditForm';
import type { EmployeeEditSectionKey } from '@/lib/office/employeeSectionEditLabels';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/lib/office/employeeCatalogLabels';
import { PersonnelField as Field, PersonnelSection, PersonnelIcon as Icon } from "./PersonnelPrimitives.native.tsx";
import { PersonnelCatalog } from "./PersonnelCatalog.native.tsx";
import { EmployeeProfilePhotoPicker } from './EmployeeProfilePhotoPicker';
import { PersonalWorkspaceSurface } from './PersonalWorkspaceSurface';
import { personnelCss } from "./personnelCss.native.ts";
export type EmployeeEditFormProps = {
    employeeId: string;
    onCancel: () => void;
    onUpdated?: () => void;
    onOpenPersonnelRecord?: () => void;
    sectionOnly?: EmployeeEditSectionKey;
    modalShell?: boolean;
    onShellActions?: (actions: {
        submit: () => Promise<void>;
        submitting: boolean;
    }) => void;
};
export function EmployeeEditForm(props: EmployeeEditFormProps) {
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    return <NativeWorkspaceStyleScope css={[personnelCss]}>{<PersonalWorkspaceSurface><EditForm key={`${tenantId}:${user?.id}:${profile?.id}:${profile?.roleKey}:${props.employeeId}`} {...props}/></PersonalWorkspaceSurface>}</NativeWorkspaceStyleScope>;
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
    const handleSubmit = useCallback(async () => { if (await submit()) {
        releaseAfterSave();
        setDirty(false);
        onUpdated?.();
    } }, [submit, onUpdated, releaseAfterSave]);
    useEffect(() => { onShellActions?.({ submit: handleSubmit, submitting }); }, [handleSubmit, submitting, onShellActions]);
    useEffect(() => {
        const keys = Object.keys(errors);
        if (!keys.length)
            return;
        setTab(keys.includes('weeklyHours') ? 1 : 0);
    }, [errors]);
    useEffect(() => { formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); }, [errors, tab]);
    const cancel = async () => { if (!submitting && await confirmLeave())
        onCancel(); };
    const field = (key: keyof EmployeeEditFormData, label: string, type = 'text', required = false) => <Field label={label} type={type} required={required} value={String(form[key] ?? '')} onChange={event => update(key, event.target.value as never)} error={errors[key]}/>;
    if (!can('office.employees.edit') || isReadOnly)
        return <NativeWorkspaceStyleScope css={[personnelCss]}>{<NativeDiv className="pe-empty"><NativeH2>Keine Bearbeitungsberechtigung</NativeH2><NativeP>Ihre Rolle kann diese Personalakte nur einsehen.</NativeP></NativeDiv>}</NativeWorkspaceStyleScope>;
    if (wizard.loading)
        return <NativeWorkspaceStyleScope css={[personnelCss]}>{<NativeDiv className="pe-empty" role="status" aria-busy="true">Personalakte wird geladen …</NativeDiv>}</NativeWorkspaceStyleScope>;
    if (wizard.notFound || wizard.loadError)
        return <NativeWorkspaceStyleScope css={[personnelCss]}>{<NativeDiv className="pe-empty" role="alert"><NativeH2>Personalakte nicht verfügbar</NativeH2><NativeP>{wizard.loadError || 'Die Personalakte wurde nicht gefunden.'}</NativeP><NativeButton className="pe-button" onClick={onCancel}>Zurück zur Akte</NativeButton></NativeDiv>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[personnelCss, personnelCss]}>{<NativeForm ref={formRef} className="pe-form" data-personnel-dirty={dirty && !wizard.saved} aria-busy={submitting} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} noValidate>
    <NativeStyle>{personnelCss}</NativeStyle><NativeDiv className="pe-form-scroll"><NativeDiv className="pe-form-intro"><NativeSpan><Icon name="edit"/></NativeSpan><NativeDiv><NativeH2>{`${form.firstName} ${form.lastName}`.trim() || 'Personalakte bearbeiten'}</NativeH2><NativeP>Persönliche Angaben, Beschäftigung und Nachweise bearbeiten. Die Änderungen werden gemeinsam gespeichert.</NativeP></NativeDiv></NativeDiv>
      <NativeDiv className="pe-inline-tabs" role="tablist" aria-label="Angaben bearbeiten">{['Person & Kontakt', 'Beschäftigung & Adresse', 'Qualifikationen'].map((label, index) => <NativeButton type="button" key={label} role="tab" aria-selected={tab === index} aria-controls={`${prefix}-panel`} id={`${prefix}-tab-${index}`} disabled={submitting} onClick={() => setTab(index)}>{label}</NativeButton>)}</NativeDiv>
      {wizard.submitError ? <NativeDiv className="pe-notice pe-notice--error" role="alert">{wizard.submitError}</NativeDiv> : null}
      {wizard.saved ? <NativeDiv className="pe-notice" role="status">Die Änderungen wurden gespeichert.</NativeDiv> : null}
      <NativeFieldset disabled={submitting} role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-tab-${tab}`} style={{ margin: 0, padding: 0, border: 0, minWidth: 0 }}>
        {tab === 0 ? <PersonnelSection title="Person & Kontakt"><NativeDiv className="pe-profile-row"><NativeDiv className="pe-profile"><EmployeeProfilePhotoPicker firstName={form.firstName} lastName={form.lastName} value={form.profilePhoto} onChange={value => update('profilePhoto', value)} disabled={submitting}/></NativeDiv><NativeDiv className="pe-form-grid">{field('firstName', 'Vorname', 'text', true)}{field('lastName', 'Nachname', 'text', true)}<NativeDiv className="pe-full">{field('email', 'E-Mail', 'email')}</NativeDiv>{field('phone', 'Telefon', 'tel')}{field('mobile', 'Mobil', 'tel')}<PersonnelCatalog catalog="employee_role" label="Funktion / Berufsbezeichnung" value={form.roleKey} onChange={value => update('roleKey', value)} error={errors.roleKey} required/><PersonnelCatalog catalog="employee_department" label="Abteilung" value={form.departmentKey} onChange={value => update('departmentKey', value)}/><PersonnelCatalog catalog="employee_status" label="Status" value={form.status} onChange={value => update('status', value)}/><NativeDiv className="pe-field pe-full"><NativeLabel htmlFor={`${prefix}-notes`}>Interne Hinweise</NativeLabel><NativeTextarea id={`${prefix}-notes`} value={form.notes} onChange={event => update('notes', event.target.value)}/></NativeDiv></NativeDiv></NativeDiv></PersonnelSection> : null}
        {tab === 1 ? <NativeDiv style={{ display: 'grid', gap: 18 }}><PersonnelSection title="Beschäftigung"><NativeDiv className="pe-form-grid">{field('entryDate', 'Eintrittsdatum', 'date')}<NativeDiv className="pe-field"><NativeLabel htmlFor={`${prefix}-employment`}>Beschäftigungsart</NativeLabel><NativeSelect id={`${prefix}-employment`} value={form.employmentType} onChange={event => update('employmentType', event.target.value)}><NativeOption value="">Bitte auswählen</NativeOption>{form.employmentType && !EMPLOYMENT_TYPE_OPTIONS.some(option => option.key === form.employmentType) ? <NativeOption value={form.employmentType}>{form.employmentType}</NativeOption> : null}{EMPLOYMENT_TYPE_OPTIONS.map(option => <NativeOption key={option.key} value={option.key}>{option.label}</NativeOption>)}</NativeSelect></NativeDiv><Field label="Wochenstunden" inputMode="decimal" value={form.weeklyHours} onChange={event => update('weeklyHours', event.target.value)} error={errors.weeklyHours}/></NativeDiv></PersonnelSection><PersonnelSection title="Adresse"><NativeDiv className="pe-form-grid">{field('street', 'Straße')}{field('houseNumber', 'Hausnummer')}{field('postalCode', 'Postleitzahl')}{field('city', 'Ort')}</NativeDiv></PersonnelSection></NativeDiv> : null}
        {tab === 2 ? <PersonnelSection title="Qualifikationen & Nachweise" description="Die Angaben beschreiben vorhandene Nachweise. Die zugehörigen Unterlagen werden unter Dokumente & Nachweise abgelegt."><NativeDiv className="pe-form-grid">{([['hasFirstAidCertificate', 'Erste-Hilfe-Nachweis vorhanden'], ['hasDriverLicense', 'Führerschein vorhanden'], ['hasPoliceClearance', 'Führungszeugnis vorhanden']] as const).map(([key, label]) => <NativeLabel className="pe-check pe-full" key={key}><NativeInput type="checkbox" checked={form[key]} onChange={event => update(key, event.target.checked)}/>{label}</NativeLabel>)}{form.hasDriverLicense ? field('driverLicenseClass', 'Führerscheinklasse') : null}{form.hasPoliceClearance ? field('policeClearanceDate', 'Ausstellungsdatum Führungszeugnis', 'date') : null}</NativeDiv></PersonnelSection> : null}
      </NativeFieldset>
    </NativeDiv>{!modalShell ? <NativeFooter className="pe-form-footer"><NativeSpan>{submitting ? 'Änderungen werden gespeichert …' : dirty ? 'Nicht gespeicherte Änderungen' : 'Alle Angaben geladen'}</NativeSpan><NativeDiv><NativeButton type="button" className="pe-button" disabled={submitting} onClick={cancel}>Abbrechen</NativeButton><NativeButton type="submit" className="pe-button pe-button--primary" disabled={submitting || !dirty}><Icon name="check"/>{submitting ? 'Wird gespeichert …' : 'Änderungen speichern'}</NativeButton></NativeDiv></NativeFooter> : null}
  </NativeForm>}</NativeWorkspaceStyleScope>;
}
