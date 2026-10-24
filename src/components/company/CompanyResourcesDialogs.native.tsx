// Generated native presentation from src/components/company/CompanyResourcesDialogs.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeLabel,NativeSpan,NativeSmall,NativeDiv,NativeButton,NativeStyle,NativeForm,NativeFieldset,NativeSection,NativeH3,NativeSelect,NativeOption,NativeTextarea,NativeInput,NativeDatalist,NativeP,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import type { CompanyAssetLink, CompanyContract, CompanyContractInput, CompanyInsuranceInput, CompanyInsurancePolicy, CompanyResourceResult, CompanyResourceScope, CompanyResourcesSnapshot, CompanyVehicle, CompanyVehicleAllocation, CompanyVehicleInput } from '@/types/tenant/companyResources';
import { getCompanyResourcesPermissions, linkCompanyLogbookVehicle, returnCompanyVehicle, saveCompanyAssetLink, saveCompanyContract, saveCompanyInsurancePolicy, saveCompanyVehicle, saveCompanyVehicleAllocation } from "../../lib/tenant/companyResourcesService.ts";
import { allocationsOverlap, isAllocationOpen, localDateTime, resourceDate, resourceDraft, resourceFields, validateResourceDraft, type ResourceField, type ResourceRecord, type ResourceRecordKind } from "./companyResourcesModel.ts";
import { companyResourcesCss } from "./companyResourcesCss.native.ts";
export type ResourcesEditDialog = {
    kind: 'contract';
    record?: CompanyContract;
} | {
    kind: 'insurance';
    record?: CompanyInsurancePolicy;
} | {
    kind: 'vehicle';
    record?: CompanyVehicle;
} | {
    kind: 'allocation';
    vehicle: CompanyVehicle;
    allocation?: CompanyVehicleAllocation;
} | {
    kind: 'return';
    vehicle: CompanyVehicle;
    allocation: CompanyVehicleAllocation;
} | {
    kind: 'logbook';
    vehicle: CompanyVehicle;
} | {
    kind: 'asset';
    vehicle?: CompanyVehicle;
    asset?: CompanyAssetLink;
    initialItemId?: string;
};
export type RunResourceMutation = <T>(operation: () => Promise<CompanyResourceResult<T>>, message: string) => Promise<boolean>;
type EditorProps = {
    scope: CompanyResourceScope;
    snapshot: CompanyResourcesSnapshot;
    busy: boolean;
    blocked: boolean;
    error: string | null;
    onDirtyChange: (dirty: boolean) => void;
    onClose: () => void;
    onSaved: () => void;
    onReload: () => Promise<boolean>;
    run: RunResourceMutation;
};
function Field({ label, required, error, hint, wide, children }: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    wide?: boolean;
    children: ReactNode;
}) {
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<NativeLabel className={`cr-field${wide ? ' cr-wide' : ''}`}><NativeSpan>{label}{required && <NativeSmall>Pflichtangabe</NativeSmall>}</NativeSpan>{children}{hint && <NativeSmall className="cr-note">{hint}</NativeSmall>}{error && <NativeSmall className="cr-field-error">{error}</NativeSmall>}</NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Frame({ title, subtitle, dirty, action, submit, children, ...props }: EditorProps & {
    title: string;
    subtitle: string;
    dirty: boolean;
    action: string;
    submit: () => Promise<void>;
    children: ReactNode;
}) {
    const formId = useId();
    const { onDirtyChange } = props;
    useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
    return <NativeWorkspaceStyleScope css={[companyResourcesCss, companyResourcesCss]}>{<PlatformModal visible surfaceScope="company" title={title} subtitle={subtitle} maxWidth={880} minWidth={260} maxHeightRatio={0.94} onClose={props.onClose} dismissOnBackdrop={!props.busy} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 20 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="cr-dialog cr-form-footer"><NativeSpan aria-live="polite">{props.busy ? 'Wird gespeichert …' : props.blocked ? 'Aktuellen Stand neu laden' : dirty ? 'Ungespeicherte Eingaben' : 'Unternehmensakte'}</NativeSpan><NativeDiv className="cr-actions"><NativeButton className="cr-button cr-button--quiet" type="button" disabled={props.busy} onClick={props.onClose}>Abbrechen</NativeButton><NativeButton className="cr-button cr-button--primary" type="submit" form={formId} disabled={props.busy || props.blocked}>{props.busy ? 'Wird gespeichert …' : action}</NativeButton></NativeDiv></NativeDiv>}>
    <NativeStyle>{companyResourcesCss}</NativeStyle><NativeForm id={formId} className="cr-dialog" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      {props.error && <NativeDiv className="cr-banner cr-banner--error" role="alert">{props.error}</NativeDiv>}
      {props.blocked && <NativeDiv className="cr-banner" role="status">Der aktuelle Speicherstand muss geprüft werden. Beim Neuladen wird dieser Entwurf geschlossen, damit keine Änderung doppelt gespeichert wird.<NativeDiv className="cr-actions"><NativeButton type="button" className="cr-button" disabled={props.busy} onClick={() => void props.onReload()}>Neu laden und Entwurf schließen</NativeButton></NativeDiv></NativeDiv>}
      <NativeFieldset disabled={props.busy || props.blocked}>{children}</NativeFieldset>
    </NativeForm>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
}
export function CompanyResourcesEditor({ dialog, ...props }: EditorProps & {
    dialog: ResourcesEditDialog;
}) {
    if (dialog.kind === 'allocation')
        return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<AllocationEditor {...props} vehicle={dialog.vehicle} allocation={dialog.allocation}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'return')
        return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<ReturnEditor {...props} vehicle={dialog.vehicle} allocation={dialog.allocation}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'logbook')
        return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<LogbookEditor {...props} vehicle={dialog.vehicle}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'asset')
        return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<AssetEditor {...props} vehicle={dialog.vehicle} asset={dialog.asset} initialItemId={dialog.initialItemId}/>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<ResourceEditor {...props} kind={dialog.kind} record={dialog.record}/>}</NativeWorkspaceStyleScope>;
}
function ResourceEditor({ kind, record, ...props }: EditorProps & {
    kind: ResourceRecordKind;
    record?: ResourceRecord;
}) {
    const [initial] = useState(() => resourceDraft(kind, record));
    const [draft, setDraft] = useState(initial);
    const [submitted, setSubmitted] = useState(false);
    const errors = validateResourceDraft(kind, draft);
    const permissions = getCompanyResourcesPermissions(props.scope);
    const listId = useId();
    const patch = (key: string, value: string) => setDraft(current => ({ ...current, [key]: value, ...(key === 'entityId' ? { siteId: '', departmentId: '' } : key === 'siteId' ? { departmentId: '' } : {}) }));
    function choices(field: ResourceField): Record<string, string> {
        if (field.choices)
            return field.choices;
        const from = (rows: {
            id: string;
            label: string;
        }[]) => Object.fromEntries(rows.map(row => [row.id, row.label]));
        if (field.key === 'entityId')
            return from(props.snapshot.entities.filter(row => row.status !== 'archived' || row.id === draft.entityId));
        if (field.key === 'siteId')
            return from(props.snapshot.sites.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (row.status !== 'archived' || row.id === draft.siteId)));
        if (field.key === 'departmentId')
            return from(props.snapshot.departments.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (!draft.siteId || !row.siteId || row.siteId === draft.siteId) && (row.status !== 'archived' || row.id === draft.departmentId)));
        if (field.key === 'responsibleEmployeeId')
            return permissions.viewEmployees ? Object.fromEntries(props.snapshot.employees.filter(row => ['active', 'aktiv'].includes(row.status) || row.id === draft.responsibleEmployeeId).map(row => [row.id, `${row.firstName} ${row.lastName}`])) : {};
        if (field.key === 'documentId')
            return permissions.viewDocuments ? from(props.snapshot.documents) : {};
        if (field.key === 'inventoryItemId')
            return permissions.viewInventory ? from(props.snapshot.inventoryItems.filter(row => (row.groupKey === 'vehicles' && !['archived', 'decommissioned'].includes(row.status ?? '')) || row.id === draft.inventoryItemId)) : {};
        if (field.key === 'insurancePolicyId')
            return Object.fromEntries(props.snapshot.policies.filter(row => row.status !== 'archived' || row.id === draft.insurancePolicyId).map(row => [row.id, `${row.title} · ${row.policyNumber}`]));
        if (field.key === 'contractId')
            return Object.fromEntries(props.snapshot.contracts.filter(row => row.status !== 'archived' || row.id === draft.contractId).map(row => [row.id, row.title]));
        return {};
    }
    const blockedField = (key: string) => key === 'responsibleEmployeeId' ? !permissions.viewEmployees : key === 'documentId' ? !permissions.viewDocuments : key === 'inventoryItemId' ? !permissions.viewInventory : false;
    async function submit() {
        setSubmitted(true);
        if (Object.keys(errors).length)
            return;
        const nullable = (key: string) => draft[key]?.trim() || null;
        const cents = (key: string) => draft[key]?.trim() ? Math.round(Number(draft[key].replace(',', '.')) * 100) : null;
        const base = { id: record?.id, expectedVersion: record?.version, entityId: nullable('entityId'), siteId: nullable('siteId'), departmentId: nullable('departmentId'), documentId: nullable('documentId'), notes: nullable('notes') };
        const financial = { ...base, title: draft.title?.trim(), startsOn: nullable('startsOn'), endsOn: nullable('endsOn'), noticeOn: nullable('noticeOn'), reviewOn: nullable('reviewOn'), responsibleEmployeeId: nullable('responsibleEmployeeId'), paymentInterval: draft.paymentInterval as CompanyContractInput['paymentInterval'], currency: 'EUR' as const, status: draft.status as CompanyContractInput['status'] };
        let result: boolean;
        if (kind === 'contract') {
            const input: CompanyContractInput = { ...financial, contractType: draft.contractType.trim(), counterparty: draft.counterparty.trim(), reference: nullable('reference'), noticeRule: nullable('noticeRule'), renewalRule: nullable('renewalRule'), costCents: cents('costCents') };
            result = await props.run(() => saveCompanyContract(props.scope, input), 'Vertrag wurde gespeichert.');
        }
        else if (kind === 'insurance') {
            const input: CompanyInsuranceInput = { ...financial, insuranceType: draft.insuranceType.trim(), provider: draft.provider.trim(), policyNumber: draft.policyNumber.trim(), coverageCents: cents('coverageCents'), excessCents: cents('excessCents'), premiumCents: cents('premiumCents'), coverageDescription: nullable('coverageDescription'), contractId: nullable('contractId') };
            result = await props.run(() => saveCompanyInsurancePolicy(props.scope, input), 'Versicherung wurde gespeichert.');
        }
        else {
            const input: CompanyVehicleInput = { ...base, plate: draft.plate.trim().toUpperCase(), vin: nullable('vin')?.toUpperCase() ?? null, make: nullable('make'), model: nullable('model'), vehicleType: draft.vehicleType.trim(), ownership: draft.ownership as CompanyVehicleInput['ownership'], status: draft.status as CompanyVehicleInput['status'], mileage: Number(draft.mileage), firstRegistrationOn: nullable('firstRegistrationOn'), purchasedOn: nullable('purchasedOn'), leaseEndsOn: nullable('leaseEndsOn'), huDueOn: nullable('huDueOn'), serviceDueOn: nullable('serviceDueOn'), serviceDueMileage: draft.serviceDueMileage.trim() ? Number(draft.serviceDueMileage) : null, insurancePolicyId: nullable('insurancePolicyId'), contractId: nullable('contractId'), inventoryItemId: nullable('inventoryItemId') };
            result = await props.run(() => saveCompanyVehicle(props.scope, input), 'Fahrzeugakte wurde gespeichert.');
        }
        if (result)
            props.onSaved();
    }
    const name = kind === 'contract' ? 'Vertrag' : kind === 'insurance' ? 'Versicherung' : 'Fahrzeug';
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<Frame {...props} title={`${name} ${record ? 'bearbeiten' : 'anlegen'}`} subtitle="Stammdaten, Zuordnung und Fristen" action="Speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    {resourceFields(kind).map(group => <NativeSection className="cr-form-section" key={group.title}><NativeH3>{group.title}</NativeH3><NativeDiv className="cr-form-grid">{group.fields.map(field => {
                const error = submitted ? errors[field.key] : undefined;
                const options = choices(field);
                const value = draft[field.key] ?? '';
                const disabled = blockedField(field.key);
                const shared = { className: 'cr-input', value, disabled, 'aria-invalid': Boolean(error), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch(field.key, event.target.value) };
                return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<Field key={field.key} label={field.label} required={field.required} wide={field.wide} error={error} hint={disabled ? 'Für diese Zuordnung fehlt die separate Zugriffsberechtigung. Eine bestehende Zuordnung bleibt erhalten.' : field.hint}>
        {field.type === 'select' ? <NativeSelect {...shared}>{!field.choices && <NativeOption value="">Nicht zugeordnet</NativeOption>}{value && !options[value] && <NativeOption value={value}>{disabled ? 'Geschützte Zuordnung' : 'Bestehende Zuordnung (nicht auswählbar)'}</NativeOption>}{Object.entries(options).map(([key, label]) => <NativeOption key={key} value={key}>{label}</NativeOption>)}</NativeSelect> : field.type === 'textarea' ? <NativeTextarea {...shared} maxLength={12000}/> : <NativeInput {...shared} autoFocus={field.key === (kind === 'vehicle' ? 'plate' : 'title')} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} inputMode={field.type === 'money' ? 'decimal' : field.type === 'number' ? 'numeric' : undefined} min={field.type === 'number' ? 0 : undefined} maxLength={500} list={field.suggestions ? `${listId}-${field.key}` : undefined}/>}
        {field.suggestions && <NativeDatalist id={`${listId}-${field.key}`}>{field.suggestions.map(value => <NativeOption key={value} value={value}/>)}</NativeDatalist>}
      </Field>}</NativeWorkspaceStyleScope>;
            })}</NativeDiv></NativeSection>)}
  </Frame>}</NativeWorkspaceStyleScope>;
}
function AllocationEditor({ vehicle, allocation, ...props }: EditorProps & {
    vehicle: CompanyVehicle;
    allocation?: CompanyVehicleAllocation;
}) {
    const [initial] = useState(() => ({ employeeId: allocation?.employeeId ?? '', startsAt: allocation ? localDateTime(new Date(allocation.startsAt)) : localDateTime(), endsAt: allocation?.endsAt ? localDateTime(new Date(allocation.endsAt)) : '', status: allocation?.status === 'active' ? 'active' : 'planned', issueMileage: String(allocation?.issueMileage ?? vehicle.mileage), issueCondition: allocation?.issueCondition ?? '', notes: allocation?.notes ?? '' }));
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    async function submit() {
        const e: Record<string, string> = {};
        const cancelling = draft.status === 'cancelled';
        const editingActive = allocation?.status === 'active';
        if (!cancelling && !draft.employeeId)
            e.employeeId = 'Bitte eine Person auswählen.';
        if (!cancelling && (!draft.startsAt || !Number.isFinite(Date.parse(draft.startsAt))))
            e.startsAt = 'Bitte den Beginn eintragen.';
        if (!cancelling && draft.endsAt && Date.parse(draft.endsAt) <= Date.parse(draft.startsAt))
            e.endsAt = 'Das Ende muss nach dem Beginn liegen.';
        if (!cancelling && !editingActive && (!draft.issueMileage || !Number.isInteger(Number(draft.issueMileage)) || Number(draft.issueMileage) < vehicle.mileage))
            e.issueMileage = `Mindestens den aktuellen Kilometerstand (${vehicle.mileage.toLocaleString('de-DE')}) eintragen.`;
        if (!cancelling && !draft.issueCondition.trim())
            e.issueCondition = 'Bitte den Zustand bei der Übergabe dokumentieren.';
        if (draft.status !== 'cancelled' && props.snapshot.allocations.some(row => row.id !== allocation?.id && row.vehicleId === vehicle.id && isAllocationOpen(row.status) && allocationsOverlap(draft.startsAt, draft.endsAt || null, row.startsAt, row.endsAt)))
            e.startsAt = 'In diesem Zeitraum ist das Fahrzeug bereits zugeordnet. Bitte einen freien Zeitraum wählen.';
        if (draft.status === 'active' && Date.parse(draft.startsAt) > Date.now())
            e.startsAt = 'Eine Ausgabe kann erst zum tatsächlichen Übergabezeitpunkt erfasst werden.';
        setErrors(e);
        if (Object.keys(e).length)
            return;
        if (await props.run(() => saveCompanyVehicleAllocation(props.scope, { id: allocation?.id, expectedVersion: allocation?.version, vehicleId: vehicle.id, employeeId: editingActive ? allocation.employeeId : draft.employeeId, startsAt: editingActive ? allocation.startsAt : new Date(draft.startsAt).toISOString(), endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null, status: draft.status as 'planned' | 'active' | 'cancelled', issueMileage: editingActive ? allocation.issueMileage : Number(draft.issueMileage), issueCondition: editingActive ? allocation.issueCondition : draft.issueCondition.trim(), notes: draft.notes.trim() || null }), draft.status === 'cancelled' ? 'Fahrzeugreservierung wurde storniert.' : 'Fahrzeugzuordnung wurde gespeichert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<Frame {...props} title={allocation ? 'Fahrzeugzuordnung bearbeiten' : 'Fahrzeug zuordnen'} subtitle={`${vehicle.plate} · ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`} action="Zuordnung speichern" dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit}>
    <NativeSection className="cr-form-section"><NativeH3>Person & Zeitraum</NativeH3><NativeDiv className="cr-form-grid">
      <Field label="Mitarbeitende Person" required wide error={errors.employeeId}><NativeSelect className="cr-input" value={draft.employeeId} disabled={allocation?.status === 'active'} onChange={event => patch('employeeId', event.target.value)}><NativeOption value="">Person auswählen</NativeOption>{props.snapshot.employees.filter(row => ['active', 'aktiv'].includes(row.status) || row.id === draft.employeeId).map(row => <NativeOption key={row.id} value={row.id}>{row.firstName} {row.lastName}</NativeOption>)}</NativeSelect></Field>
      <Field label="Beginn" required error={errors.startsAt}><NativeInput className="cr-input" type="datetime-local" value={draft.startsAt} disabled={allocation?.status === 'active'} onChange={event => patch('startsAt', event.target.value)}/></Field><Field label="Geplante Rückgabe" error={errors.endsAt} hint="Ohne Rückgabedatum bleibt das Fahrzeug ab Beginn durchgehend zugeordnet."><NativeInput className="cr-input" type="datetime-local" value={draft.endsAt} onChange={event => patch('endsAt', event.target.value)}/></Field>
      <Field label="Vorgang" wide><NativeSelect className="cr-input" value={draft.status} disabled={allocation?.status === 'active'} onChange={event => patch('status', event.target.value)}>{allocation?.status !== 'active' && <NativeOption value="planned">Reservierung planen</NativeOption>}<NativeOption value="active">Tatsächliche Ausgabe dokumentieren</NativeOption>{allocation?.status === 'planned' && <NativeOption value="cancelled">Reservierung stornieren</NativeOption>}</NativeSelect></Field>
    </NativeDiv></NativeSection><NativeSection className="cr-form-section"><NativeH3>Übergabe</NativeH3><NativeDiv className="cr-form-grid"><Field label="Kilometerstand" required error={errors.issueMileage}><NativeInput className="cr-input" type="number" min={vehicle.mileage} value={draft.issueMileage} disabled={allocation?.status === 'active'} onChange={event => patch('issueMileage', event.target.value)}/></Field><Field label="Zustand bei der Übergabe" required error={errors.issueCondition}><NativeInput className="cr-input" value={draft.issueCondition} disabled={allocation?.status === 'active'} onChange={event => patch('issueCondition', event.target.value)} list="cr-issue-condition" maxLength={2000}/><NativeDatalist id="cr-issue-condition"><NativeOption value="Keine erkennbaren Schäden"/><NativeOption value="Vorhandene Schäden dokumentiert"/><NativeOption value="Zustand muss vor Ausgabe geprüft werden"/></NativeDatalist></Field><Field label="Notizen" wide><NativeTextarea className="cr-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={12000}/></Field></NativeDiv></NativeSection>
  </Frame>}</NativeWorkspaceStyleScope>;
}
function ReturnEditor({ vehicle, allocation, ...props }: EditorProps & {
    vehicle: CompanyVehicle;
    allocation: CompanyVehicleAllocation;
}) {
    const [initial] = useState(() => ({ returnedAt: localDateTime(), returnMileage: '', returnCondition: '', notes: '' }));
    const [draft, setDraft] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    async function submit() {
        const e: Record<string, string> = {};
        const time = Date.parse(draft.returnedAt);
        if (!Number.isFinite(time) || time < Date.parse(allocation.startsAt) || time > Date.now() + 60000)
            e.returnedAt = 'Bitte den tatsächlichen Rückgabezeitpunkt nach der Ausgabe und spätestens jetzt eintragen.';
        if (!draft.returnMileage || !Number.isInteger(Number(draft.returnMileage)) || Number(draft.returnMileage) < Math.max(vehicle.mileage, allocation.issueMileage))
            e.returnMileage = 'Der Rückgabestand darf nicht unter dem bisherigen Kilometerstand liegen.';
        if (!draft.returnCondition.trim())
            e.returnCondition = 'Bitte den tatsächlichen Fahrzeugzustand dokumentieren.';
        setErrors(e);
        if (Object.keys(e).length)
            return;
        if (await props.run(() => returnCompanyVehicle(props.scope, { id: allocation.id, expectedVersion: allocation.version, returnedAt: new Date(draft.returnedAt).toISOString(), returnMileage: Number(draft.returnMileage), returnCondition: draft.returnCondition.trim(), notes: draft.notes.trim() || null }), 'Fahrzeugrückgabe wurde dokumentiert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<Frame {...props} title="Fahrzeug zurücknehmen" subtitle={`${vehicle.plate} · ausgegeben am ${resourceDate(allocation.startsAt, true)}`} action="Rückgabe dokumentieren" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}><NativeSection className="cr-form-section"><NativeH3>Tatsächliche Rückgabe</NativeH3><NativeDiv className="cr-form-grid"><Field label="Rückgabezeitpunkt" required error={errors.returnedAt}><NativeInput className="cr-input" type="datetime-local" value={draft.returnedAt} onChange={event => patch('returnedAt', event.target.value)}/></Field><Field label="Kilometerstand bei Rückgabe" required error={errors.returnMileage}><NativeInput className="cr-input" type="number" min={Math.max(vehicle.mileage, allocation.issueMileage)} value={draft.returnMileage} onChange={event => patch('returnMileage', event.target.value)}/></Field><Field label="Zustand bei Rückgabe" required wide error={errors.returnCondition}><NativeTextarea className="cr-input" value={draft.returnCondition} onChange={event => patch('returnCondition', event.target.value)} maxLength={2000}/></Field><Field label="Weitere Notizen" wide><NativeTextarea className="cr-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={12000}/></Field></NativeDiv></NativeSection></Frame>}</NativeWorkspaceStyleScope>;
}
function LogbookEditor({ vehicle, ...props }: EditorProps & {
    vehicle: CompanyVehicle;
}) {
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const rows = props.snapshot.logbookVehicles.filter(row => row.active && row.ownership === 'company' && !row.companyVehicleId);
    async function submit() { if (!selected) {
        setError('Bitte ein Fahrtenbuch-Fahrzeug auswählen.');
        return;
    } if (await props.run(() => linkCompanyLogbookVehicle(props.scope, { vehicleId: vehicle.id, logbookVehicleId: selected, expectedVersion: vehicle.version }), 'Fahrtenbuch-Fahrzeug wurde verknüpft.'))
        props.onSaved(); }
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<Frame {...props} title="Fahrtenbuch verknüpfen" subtitle={vehicle.plate} action="Verknüpfung speichern" dirty={Boolean(selected)} submit={submit}><NativeSection className="cr-form-section"><NativeH3>Bestehendes Fahrzeug verbinden</NativeH3><NativeP className="cr-note">Verknüpfen Sie den vorhandenen Fahrtenbuch-Eintrag mit dieser Unternehmensakte. Bereits gespeicherte Fahrten bleiben erhalten.</NativeP><Field label="Fahrzeug im Fahrtenbuch" required error={error}><NativeSelect className="cr-input" value={selected} onChange={event => setSelected(event.target.value)}><NativeOption value="">Eintrag auswählen</NativeOption>{rows.map(row => { const employee = props.snapshot.employees.find(person => person.id === row.employeeId); return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<NativeOption key={row.id} value={row.id}>{row.plate} · {employee ? `${employee.firstName} ${employee.lastName}` : 'Person nicht verfügbar'}{row.companyVehicleId ? ' · bereits verknüpft' : ''}</NativeOption>}</NativeWorkspaceStyleScope>; })}</NativeSelect></Field>{!rows.length && <NativeP className="cr-note">Es ist kein zugängliches, unverknüpftes Fahrzeug im Fahrtenbuch vorhanden.</NativeP>}</NativeSection></Frame>}</NativeWorkspaceStyleScope>;
}
function AssetEditor({ vehicle, asset, initialItemId, ...props }: EditorProps & {
    vehicle?: CompanyVehicle;
    asset?: CompanyAssetLink;
    initialItemId?: string;
}) {
    const [initial] = useState(() => ({ inventoryItemId: asset?.inventoryItemId ?? initialItemId ?? '', vehicleId: asset?.vehicleId ?? vehicle?.id ?? '', entityId: asset?.entityId ?? vehicle?.entityId ?? '', siteId: asset?.siteId ?? vehicle?.siteId ?? '', departmentId: asset?.departmentId ?? vehicle?.departmentId ?? '', notes: asset?.notes ?? '' }));
    const [draft, setDraft] = useState(initial);
    const [error, setError] = useState('');
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value, ...(key === 'entityId' ? { siteId: '', departmentId: '' } : key === 'siteId' ? { departmentId: '' } : {}) }));
    async function submit() { if (!draft.inventoryItemId) {
        setError('Bitte einen Inventareintrag auswählen.');
        return;
    } if (await props.run(() => saveCompanyAssetLink(props.scope, { id: asset?.id, expectedVersion: asset?.version, inventoryItemId: draft.inventoryItemId, vehicleId: draft.vehicleId || null, entityId: draft.entityId || null, siteId: draft.siteId || null, departmentId: draft.departmentId || null, status: 'active', notes: draft.notes.trim() || null }), 'Inventarzuordnung wurde gespeichert.'))
        props.onSaved(); }
    const selectors = [
        { key: 'entityId' as const, label: 'Gesellschaft', rows: props.snapshot.entities.filter(row => row.status !== 'archived' || row.id === draft.entityId) },
        { key: 'siteId' as const, label: 'Standort', rows: props.snapshot.sites.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (row.status !== 'archived' || row.id === draft.siteId)) },
        { key: 'departmentId' as const, label: 'Abteilung', rows: props.snapshot.departments.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (!draft.siteId || !row.siteId || row.siteId === draft.siteId) && (row.status !== 'archived' || row.id === draft.departmentId)) },
        { key: 'vehicleId' as const, label: 'Fahrzeug', rows: props.snapshot.vehicles.filter(row => row.status !== 'archived' || row.id === draft.vehicleId).map(row => ({ id: row.id, label: row.plate })) },
    ];
    return <NativeWorkspaceStyleScope css={[companyResourcesCss]}>{<Frame {...props} title="Inventar zuordnen" subtitle={vehicle ? vehicle.plate : 'Organisatorische Zuordnung im Unternehmen'} action="Zuordnung speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}><NativeSection className="cr-form-section"><NativeH3>Inventar & Organisation</NativeH3><NativeP className="cr-note">Diese Zuordnung beschreibt, wo der Gegenstand organisatorisch geführt wird. Persönliche Ausgaben und Rückgaben bleiben in der Inventarakte dokumentiert.</NativeP><NativeDiv className="cr-form-grid"><Field label="Inventareintrag" required wide error={error}><NativeSelect className="cr-input" value={draft.inventoryItemId} onChange={event => patch('inventoryItemId', event.target.value)}><NativeOption value="">Gegenstand auswählen</NativeOption>{draft.inventoryItemId && !props.snapshot.inventoryItems.some(item => item.id === draft.inventoryItemId) && <NativeOption value={draft.inventoryItemId}>Eintrag nicht verfügbar</NativeOption>}{props.snapshot.inventoryItems.filter(item => !['archived', 'decommissioned'].includes(item.status ?? '') || item.id === draft.inventoryItemId).map(item => <NativeOption key={item.id} value={item.id}>{item.label}</NativeOption>)}</NativeSelect></Field>{selectors.map(({ key, label, rows }) => <Field key={key} label={label}><NativeSelect className="cr-input" value={draft[key]} onChange={event => patch(key, event.target.value)}><NativeOption value="">Nicht zugeordnet</NativeOption>{draft[key] && !rows.some(row => row.id === draft[key]) && <NativeOption value={draft[key]}>Bestehende Zuordnung</NativeOption>}{rows.map(row => <NativeOption key={row.id} value={row.id}>{row.label}</NativeOption>)}</NativeSelect></Field>)}<Field label="Notizen zur Zuordnung" wide><NativeTextarea className="cr-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={12000}/></Field></NativeDiv></NativeSection></Frame>}</NativeWorkspaceStyleScope>;
}
