import { useEffect, useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import type { CompanyAssetLink, CompanyContract, CompanyContractInput, CompanyInsuranceInput, CompanyInsurancePolicy, CompanyResourceResult, CompanyResourceScope, CompanyResourcesSnapshot, CompanyVehicle, CompanyVehicleAllocation, CompanyVehicleInput } from '@/types/tenant/companyResources';
import { getCompanyResourcesPermissions, linkCompanyLogbookVehicle, returnCompanyVehicle, saveCompanyAssetLink, saveCompanyContract, saveCompanyInsurancePolicy, saveCompanyVehicle, saveCompanyVehicleAllocation } from '@/lib/tenant/companyResourcesService.web';
import { allocationsOverlap, isAllocationOpen, localDateTime, resourceDate, resourceDraft, resourceFields, validateResourceDraft, type ResourceField, type ResourceRecord, type ResourceRecordKind } from './companyResourcesModel.web';
import { companyResourcesCss } from './companyResourcesCss.web';

export type ResourcesEditDialog =
  | { kind: 'contract'; record?: CompanyContract }
  | { kind: 'insurance'; record?: CompanyInsurancePolicy }
  | { kind: 'vehicle'; record?: CompanyVehicle }
  | { kind: 'allocation'; vehicle: CompanyVehicle; allocation?: CompanyVehicleAllocation }
  | { kind: 'return'; vehicle: CompanyVehicle; allocation: CompanyVehicleAllocation }
  | { kind: 'logbook'; vehicle: CompanyVehicle }
  | { kind: 'asset'; vehicle?: CompanyVehicle; asset?: CompanyAssetLink; initialItemId?: string };
export type RunResourceMutation = <T>(operation: () => Promise<CompanyResourceResult<T>>, message: string) => Promise<boolean>;
type EditorProps = {
  scope: CompanyResourceScope; snapshot: CompanyResourcesSnapshot; busy: boolean; blocked: boolean; error: string | null;
  onDirtyChange: (dirty: boolean) => void; onClose: () => void; onSaved: () => void; onReload: () => Promise<boolean>; run: RunResourceMutation;
};
function Field({ label, required, error, hint, wide, children }: { label: string; required?: boolean; error?: string; hint?: string; wide?: boolean; children: ReactNode }) {
  return <label className={`cr-field${wide ? ' cr-wide' : ''}`}><span>{label}{required && <small>Pflichtangabe</small>}</span>{children}{hint && <small className="cr-note">{hint}</small>}{error && <small className="cr-field-error">{error}</small>}</label>;
}
function Frame({ title, subtitle, dirty, action, submit, children, ...props }: EditorProps & { title: string; subtitle: string; dirty: boolean; action: string; submit: () => Promise<void>; children: ReactNode }) {
  const formId = useId(); const { onDirtyChange } = props;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  return <PlatformModal visible surfaceScope="company" title={title} subtitle={subtitle} maxWidth={880} minWidth={260} maxHeightRatio={0.94} onClose={props.onClose} dismissOnBackdrop={!props.busy}
    bodyStyle={{ backgroundColor: '#f4f8fd', padding: 20 }} sheetStyle={{ backgroundColor: '#f4f8fd' }}
    footerContent={<div className="cr-dialog cr-form-footer"><span aria-live="polite">{props.busy ? 'Wird gespeichert …' : props.blocked ? 'Aktuellen Stand neu laden' : dirty ? 'Ungespeicherte Eingaben' : 'Unternehmensakte'}</span><div className="cr-actions"><button className="cr-button cr-button--quiet" type="button" disabled={props.busy} onClick={props.onClose}>Abbrechen</button><button className="cr-button cr-button--primary" type="submit" form={formId} disabled={props.busy || props.blocked}>{props.busy ? 'Wird gespeichert …' : action}</button></div></div>}>
    <style>{companyResourcesCss}</style><form id={formId} className="cr-dialog" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      {props.error && <div className="cr-banner cr-banner--error" role="alert">{props.error}</div>}
      {props.blocked && <div className="cr-banner" role="status">Der aktuelle Speicherstand muss geprüft werden. Beim Neuladen wird dieser Entwurf geschlossen, damit keine Änderung doppelt gespeichert wird.<div className="cr-actions"><button type="button" className="cr-button" disabled={props.busy} onClick={() => void props.onReload()}>Neu laden und Entwurf schließen</button></div></div>}
      <fieldset disabled={props.busy || props.blocked}>{children}</fieldset>
    </form>
  </PlatformModal>;
}
export function CompanyResourcesEditor({ dialog, ...props }: EditorProps & { dialog: ResourcesEditDialog }) {
  if (dialog.kind === 'allocation') return <AllocationEditor {...props} vehicle={dialog.vehicle} allocation={dialog.allocation} />;
  if (dialog.kind === 'return') return <ReturnEditor {...props} vehicle={dialog.vehicle} allocation={dialog.allocation} />;
  if (dialog.kind === 'logbook') return <LogbookEditor {...props} vehicle={dialog.vehicle} />;
  if (dialog.kind === 'asset') return <AssetEditor {...props} vehicle={dialog.vehicle} asset={dialog.asset} initialItemId={dialog.initialItemId} />;
  return <ResourceEditor {...props} kind={dialog.kind} record={dialog.record} />;
}
function ResourceEditor({ kind, record, ...props }: EditorProps & { kind: ResourceRecordKind; record?: ResourceRecord }) {
  const [initial] = useState(() => resourceDraft(kind, record)); const [draft, setDraft] = useState(initial); const [submitted, setSubmitted] = useState(false);
  const errors = validateResourceDraft(kind, draft); const permissions = getCompanyResourcesPermissions(props.scope); const listId = useId();
  const patch = (key: string, value: string) => setDraft(current => ({ ...current, [key]: value, ...(key === 'entityId' ? { siteId: '', departmentId: '' } : key === 'siteId' ? { departmentId: '' } : {}) }));
  function choices(field: ResourceField): Record<string, string> {
    if (field.choices) return field.choices;
    const from = (rows: { id: string; label: string }[]) => Object.fromEntries(rows.map(row => [row.id, row.label]));
    if (field.key === 'entityId') return from(props.snapshot.entities.filter(row => row.status !== 'archived' || row.id === draft.entityId));
    if (field.key === 'siteId') return from(props.snapshot.sites.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (row.status !== 'archived' || row.id === draft.siteId)));
    if (field.key === 'departmentId') return from(props.snapshot.departments.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (!draft.siteId || !row.siteId || row.siteId === draft.siteId) && (row.status !== 'archived' || row.id === draft.departmentId)));
    if (field.key === 'responsibleEmployeeId') return permissions.viewEmployees ? Object.fromEntries(props.snapshot.employees.filter(row => ['active', 'aktiv'].includes(row.status) || row.id === draft.responsibleEmployeeId).map(row => [row.id, `${row.firstName} ${row.lastName}`])) : {};
    if (field.key === 'documentId') return permissions.viewDocuments ? from(props.snapshot.documents) : {};
    if (field.key === 'inventoryItemId') return permissions.viewInventory ? from(props.snapshot.inventoryItems.filter(row => (row.groupKey === 'vehicles' && !['archived', 'decommissioned'].includes(row.status ?? '')) || row.id === draft.inventoryItemId)) : {};
    if (field.key === 'insurancePolicyId') return Object.fromEntries(props.snapshot.policies.filter(row => row.status !== 'archived' || row.id === draft.insurancePolicyId).map(row => [row.id, `${row.title} · ${row.policyNumber}`]));
    if (field.key === 'contractId') return Object.fromEntries(props.snapshot.contracts.filter(row => row.status !== 'archived' || row.id === draft.contractId).map(row => [row.id, row.title]));
    return {};
  }
  const blockedField = (key: string) => key === 'responsibleEmployeeId' ? !permissions.viewEmployees : key === 'documentId' ? !permissions.viewDocuments : key === 'inventoryItemId' ? !permissions.viewInventory : false;
  async function submit() {
    setSubmitted(true); if (Object.keys(errors).length) return;
    const nullable = (key: string) => draft[key]?.trim() || null;
    const cents = (key: string) => draft[key]?.trim() ? Math.round(Number(draft[key].replace(',', '.')) * 100) : null;
    const base = { id: record?.id, expectedVersion: record?.version, entityId: nullable('entityId'), siteId: nullable('siteId'), departmentId: nullable('departmentId'), documentId: nullable('documentId'), notes: nullable('notes') };
    const financial = { ...base, title: draft.title?.trim(), startsOn: nullable('startsOn'), endsOn: nullable('endsOn'), noticeOn: nullable('noticeOn'), reviewOn: nullable('reviewOn'), responsibleEmployeeId: nullable('responsibleEmployeeId'), paymentInterval: draft.paymentInterval as CompanyContractInput['paymentInterval'], currency: 'EUR' as const, status: draft.status as CompanyContractInput['status'] };
    let result: boolean;
    if (kind === 'contract') { const input: CompanyContractInput = { ...financial, contractType: draft.contractType.trim(), counterparty: draft.counterparty.trim(), reference: nullable('reference'), noticeRule: nullable('noticeRule'), renewalRule: nullable('renewalRule'), costCents: cents('costCents') }; result = await props.run(() => saveCompanyContract(props.scope, input), 'Vertrag wurde gespeichert.'); }
    else if (kind === 'insurance') { const input: CompanyInsuranceInput = { ...financial, insuranceType: draft.insuranceType.trim(), provider: draft.provider.trim(), policyNumber: draft.policyNumber.trim(), coverageCents: cents('coverageCents'), excessCents: cents('excessCents'), premiumCents: cents('premiumCents'), coverageDescription: nullable('coverageDescription'), contractId: nullable('contractId') }; result = await props.run(() => saveCompanyInsurancePolicy(props.scope, input), 'Versicherung wurde gespeichert.'); }
    else { const input: CompanyVehicleInput = { ...base, plate: draft.plate.trim().toUpperCase(), vin: nullable('vin')?.toUpperCase() ?? null, make: nullable('make'), model: nullable('model'), vehicleType: draft.vehicleType.trim(), ownership: draft.ownership as CompanyVehicleInput['ownership'], status: draft.status as CompanyVehicleInput['status'], mileage: Number(draft.mileage), firstRegistrationOn: nullable('firstRegistrationOn'), purchasedOn: nullable('purchasedOn'), leaseEndsOn: nullable('leaseEndsOn'), huDueOn: nullable('huDueOn'), serviceDueOn: nullable('serviceDueOn'), serviceDueMileage: draft.serviceDueMileage.trim() ? Number(draft.serviceDueMileage) : null, insurancePolicyId: nullable('insurancePolicyId'), contractId: nullable('contractId'), inventoryItemId: nullable('inventoryItemId') }; result = await props.run(() => saveCompanyVehicle(props.scope, input), 'Fahrzeugakte wurde gespeichert.'); }
    if (result) props.onSaved();
  }
  const name = kind === 'contract' ? 'Vertrag' : kind === 'insurance' ? 'Versicherung' : 'Fahrzeug';
  return <Frame {...props} title={`${name} ${record ? 'bearbeiten' : 'anlegen'}`} subtitle="Stammdaten, Zuordnung und Fristen" action="Speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    {resourceFields(kind).map(group => <section className="cr-form-section" key={group.title}><h3>{group.title}</h3><div className="cr-form-grid">{group.fields.map(field => {
      const error = submitted ? errors[field.key] : undefined; const options = choices(field); const value = draft[field.key] ?? ''; const disabled = blockedField(field.key);
      const shared = { className: 'cr-input', value, disabled, 'aria-invalid': Boolean(error), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => patch(field.key, event.target.value) };
      return <Field key={field.key} label={field.label} required={field.required} wide={field.wide} error={error} hint={disabled ? 'Für diese Zuordnung fehlt die separate Zugriffsberechtigung. Eine bestehende Zuordnung bleibt erhalten.' : field.hint}>
        {field.type === 'select' ? <select {...shared}>{!field.choices && <option value="">Nicht zugeordnet</option>}{value && !options[value] && <option value={value}>{disabled ? 'Geschützte Zuordnung' : 'Bestehende Zuordnung (nicht auswählbar)'}</option>}{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select> : field.type === 'textarea' ? <textarea {...shared} maxLength={12000} /> : <input {...shared} autoFocus={field.key === (kind === 'vehicle' ? 'plate' : 'title')} type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} inputMode={field.type === 'money' ? 'decimal' : field.type === 'number' ? 'numeric' : undefined} min={field.type === 'number' ? 0 : undefined} maxLength={500} list={field.suggestions ? `${listId}-${field.key}` : undefined} />}
        {field.suggestions && <datalist id={`${listId}-${field.key}`}>{field.suggestions.map(value => <option key={value} value={value} />)}</datalist>}
      </Field>;
    })}</div></section>)}
  </Frame>;
}
function AllocationEditor({ vehicle, allocation, ...props }: EditorProps & { vehicle: CompanyVehicle; allocation?: CompanyVehicleAllocation }) {
  const [initial] = useState(() => ({ employeeId: allocation?.employeeId ?? '', startsAt: allocation ? localDateTime(new Date(allocation.startsAt)) : localDateTime(), endsAt: allocation?.endsAt ? localDateTime(new Date(allocation.endsAt)) : '', status: allocation?.status === 'active' ? 'active' : 'planned', issueMileage: String(allocation?.issueMileage ?? vehicle.mileage), issueCondition: allocation?.issueCondition ?? '', notes: allocation?.notes ?? '' }));
  const [draft, setDraft] = useState(initial); const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  async function submit() {
    const e: Record<string, string> = {};
    const cancelling = draft.status === 'cancelled'; const editingActive = allocation?.status === 'active';
    if (!cancelling && !draft.employeeId) e.employeeId = 'Bitte eine Person auswählen.';
    if (!cancelling && (!draft.startsAt || !Number.isFinite(Date.parse(draft.startsAt)))) e.startsAt = 'Bitte den Beginn eintragen.';
    if (!cancelling && draft.endsAt && Date.parse(draft.endsAt) <= Date.parse(draft.startsAt)) e.endsAt = 'Das Ende muss nach dem Beginn liegen.';
    if (!cancelling && !editingActive && (!draft.issueMileage || !Number.isInteger(Number(draft.issueMileage)) || Number(draft.issueMileage) < vehicle.mileage)) e.issueMileage = `Mindestens den aktuellen Kilometerstand (${vehicle.mileage.toLocaleString('de-DE')}) eintragen.`;
    if (!cancelling && !draft.issueCondition.trim()) e.issueCondition = 'Bitte den Zustand bei der Übergabe dokumentieren.';
    if (draft.status !== 'cancelled' && props.snapshot.allocations.some(row => row.id !== allocation?.id && row.vehicleId === vehicle.id && isAllocationOpen(row.status) && allocationsOverlap(draft.startsAt, draft.endsAt || null, row.startsAt, row.endsAt))) e.startsAt = 'In diesem Zeitraum ist das Fahrzeug bereits zugeordnet. Bitte einen freien Zeitraum wählen.';
    if (draft.status === 'active' && Date.parse(draft.startsAt) > Date.now()) e.startsAt = 'Eine Ausgabe kann erst zum tatsächlichen Übergabezeitpunkt erfasst werden.';
    setErrors(e); if (Object.keys(e).length) return;
    if (await props.run(() => saveCompanyVehicleAllocation(props.scope, { id: allocation?.id, expectedVersion: allocation?.version, vehicleId: vehicle.id, employeeId: editingActive ? allocation.employeeId : draft.employeeId, startsAt: editingActive ? allocation.startsAt : new Date(draft.startsAt).toISOString(), endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null, status: draft.status as 'planned' | 'active' | 'cancelled', issueMileage: editingActive ? allocation.issueMileage : Number(draft.issueMileage), issueCondition: editingActive ? allocation.issueCondition : draft.issueCondition.trim(), notes: draft.notes.trim() || null }), draft.status === 'cancelled' ? 'Fahrzeugreservierung wurde storniert.' : 'Fahrzeugzuordnung wurde gespeichert.')) props.onSaved();
  }
  return <Frame {...props} title={allocation ? 'Fahrzeugzuordnung bearbeiten' : 'Fahrzeug zuordnen'} subtitle={`${vehicle.plate} · ${[vehicle.make, vehicle.model].filter(Boolean).join(' ')}`} action="Zuordnung speichern" dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit}>
    <section className="cr-form-section"><h3>Person & Zeitraum</h3><div className="cr-form-grid">
      <Field label="Mitarbeitende Person" required wide error={errors.employeeId}><select className="cr-input" value={draft.employeeId} disabled={allocation?.status === 'active'} onChange={event => patch('employeeId', event.target.value)}><option value="">Person auswählen</option>{props.snapshot.employees.filter(row => ['active', 'aktiv'].includes(row.status) || row.id === draft.employeeId).map(row => <option key={row.id} value={row.id}>{row.firstName} {row.lastName}</option>)}</select></Field>
      <Field label="Beginn" required error={errors.startsAt}><input className="cr-input" type="datetime-local" value={draft.startsAt} disabled={allocation?.status === 'active'} onChange={event => patch('startsAt', event.target.value)} /></Field><Field label="Geplante Rückgabe" error={errors.endsAt} hint="Ohne Rückgabedatum bleibt das Fahrzeug ab Beginn durchgehend zugeordnet."><input className="cr-input" type="datetime-local" value={draft.endsAt} onChange={event => patch('endsAt', event.target.value)} /></Field>
      <Field label="Vorgang" wide><select className="cr-input" value={draft.status} disabled={allocation?.status === 'active'} onChange={event => patch('status', event.target.value)}>{allocation?.status !== 'active' && <option value="planned">Reservierung planen</option>}<option value="active">Tatsächliche Ausgabe dokumentieren</option>{allocation?.status === 'planned' && <option value="cancelled">Reservierung stornieren</option>}</select></Field>
    </div></section><section className="cr-form-section"><h3>Übergabe</h3><div className="cr-form-grid"><Field label="Kilometerstand" required error={errors.issueMileage}><input className="cr-input" type="number" min={vehicle.mileage} value={draft.issueMileage} disabled={allocation?.status === 'active'} onChange={event => patch('issueMileage', event.target.value)} /></Field><Field label="Zustand bei der Übergabe" required error={errors.issueCondition}><input className="cr-input" value={draft.issueCondition} disabled={allocation?.status === 'active'} onChange={event => patch('issueCondition', event.target.value)} list="cr-issue-condition" maxLength={2000} /><datalist id="cr-issue-condition"><option value="Keine erkennbaren Schäden" /><option value="Vorhandene Schäden dokumentiert" /><option value="Zustand muss vor Ausgabe geprüft werden" /></datalist></Field><Field label="Notizen" wide><textarea className="cr-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={12000} /></Field></div></section>
  </Frame>;
}
function ReturnEditor({ vehicle, allocation, ...props }: EditorProps & { vehicle: CompanyVehicle; allocation: CompanyVehicleAllocation }) {
  const [initial] = useState(() => ({ returnedAt: localDateTime(), returnMileage: '', returnCondition: '', notes: '' })); const [draft, setDraft] = useState(initial); const [errors, setErrors] = useState<Record<string, string>>({});
  const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  async function submit() {
    const e: Record<string, string> = {}; const time = Date.parse(draft.returnedAt);
    if (!Number.isFinite(time) || time < Date.parse(allocation.startsAt) || time > Date.now() + 60000) e.returnedAt = 'Bitte den tatsächlichen Rückgabezeitpunkt nach der Ausgabe und spätestens jetzt eintragen.';
    if (!draft.returnMileage || !Number.isInteger(Number(draft.returnMileage)) || Number(draft.returnMileage) < Math.max(vehicle.mileage, allocation.issueMileage)) e.returnMileage = 'Der Rückgabestand darf nicht unter dem bisherigen Kilometerstand liegen.';
    if (!draft.returnCondition.trim()) e.returnCondition = 'Bitte den tatsächlichen Fahrzeugzustand dokumentieren.';
    setErrors(e); if (Object.keys(e).length) return;
    if (await props.run(() => returnCompanyVehicle(props.scope, { id: allocation.id, expectedVersion: allocation.version, returnedAt: new Date(draft.returnedAt).toISOString(), returnMileage: Number(draft.returnMileage), returnCondition: draft.returnCondition.trim(), notes: draft.notes.trim() || null }), 'Fahrzeugrückgabe wurde dokumentiert.')) props.onSaved();
  }
  return <Frame {...props} title="Fahrzeug zurücknehmen" subtitle={`${vehicle.plate} · ausgegeben am ${resourceDate(allocation.startsAt, true)}`} action="Rückgabe dokumentieren" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}><section className="cr-form-section"><h3>Tatsächliche Rückgabe</h3><div className="cr-form-grid"><Field label="Rückgabezeitpunkt" required error={errors.returnedAt}><input className="cr-input" type="datetime-local" value={draft.returnedAt} onChange={event => patch('returnedAt', event.target.value)} /></Field><Field label="Kilometerstand bei Rückgabe" required error={errors.returnMileage}><input className="cr-input" type="number" min={Math.max(vehicle.mileage, allocation.issueMileage)} value={draft.returnMileage} onChange={event => patch('returnMileage', event.target.value)} /></Field><Field label="Zustand bei Rückgabe" required wide error={errors.returnCondition}><textarea className="cr-input" value={draft.returnCondition} onChange={event => patch('returnCondition', event.target.value)} maxLength={2000} /></Field><Field label="Weitere Notizen" wide><textarea className="cr-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={12000} /></Field></div></section></Frame>;
}
function LogbookEditor({ vehicle, ...props }: EditorProps & { vehicle: CompanyVehicle }) {
  const [selected, setSelected] = useState(''); const [error, setError] = useState('');
  const rows = props.snapshot.logbookVehicles.filter(row => row.active && row.ownership === 'company' && !row.companyVehicleId);
  async function submit() { if (!selected) { setError('Bitte ein Fahrtenbuch-Fahrzeug auswählen.'); return; } if (await props.run(() => linkCompanyLogbookVehicle(props.scope, { vehicleId: vehicle.id, logbookVehicleId: selected, expectedVersion: vehicle.version }), 'Fahrtenbuch-Fahrzeug wurde verknüpft.')) props.onSaved(); }
  return <Frame {...props} title="Fahrtenbuch verknüpfen" subtitle={vehicle.plate} action="Verknüpfung speichern" dirty={Boolean(selected)} submit={submit}><section className="cr-form-section"><h3>Bestehendes Fahrzeug verbinden</h3><p className="cr-note">Verknüpfen Sie den vorhandenen Fahrtenbuch-Eintrag mit dieser Unternehmensakte. Bereits gespeicherte Fahrten bleiben erhalten.</p><Field label="Fahrzeug im Fahrtenbuch" required error={error}><select className="cr-input" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Eintrag auswählen</option>{rows.map(row => { const employee = props.snapshot.employees.find(person => person.id === row.employeeId); return <option key={row.id} value={row.id}>{row.plate} · {employee ? `${employee.firstName} ${employee.lastName}` : 'Person nicht verfügbar'}{row.companyVehicleId ? ' · bereits verknüpft' : ''}</option>; })}</select></Field>{!rows.length && <p className="cr-note">Es ist kein zugängliches, unverknüpftes Fahrzeug im Fahrtenbuch vorhanden.</p>}</section></Frame>;
}
function AssetEditor({ vehicle, asset, initialItemId, ...props }: EditorProps & { vehicle?: CompanyVehicle; asset?: CompanyAssetLink; initialItemId?: string }) {
  const [initial] = useState(() => ({ inventoryItemId: asset?.inventoryItemId ?? initialItemId ?? '', vehicleId: asset?.vehicleId ?? vehicle?.id ?? '', entityId: asset?.entityId ?? vehicle?.entityId ?? '', siteId: asset?.siteId ?? vehicle?.siteId ?? '', departmentId: asset?.departmentId ?? vehicle?.departmentId ?? '', notes: asset?.notes ?? '' })); const [draft, setDraft] = useState(initial); const [error, setError] = useState('');
  const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value, ...(key === 'entityId' ? { siteId: '', departmentId: '' } : key === 'siteId' ? { departmentId: '' } : {}) }));
  async function submit() { if (!draft.inventoryItemId) { setError('Bitte einen Inventareintrag auswählen.'); return; } if (await props.run(() => saveCompanyAssetLink(props.scope, { id: asset?.id, expectedVersion: asset?.version, inventoryItemId: draft.inventoryItemId, vehicleId: draft.vehicleId || null, entityId: draft.entityId || null, siteId: draft.siteId || null, departmentId: draft.departmentId || null, status: 'active', notes: draft.notes.trim() || null }), 'Inventarzuordnung wurde gespeichert.')) props.onSaved(); }
  const selectors = [
    { key: 'entityId' as const, label: 'Gesellschaft', rows: props.snapshot.entities.filter(row => row.status !== 'archived' || row.id === draft.entityId) },
    { key: 'siteId' as const, label: 'Standort', rows: props.snapshot.sites.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (row.status !== 'archived' || row.id === draft.siteId)) },
    { key: 'departmentId' as const, label: 'Abteilung', rows: props.snapshot.departments.filter(row => (!draft.entityId || row.entityId === draft.entityId) && (!draft.siteId || !row.siteId || row.siteId === draft.siteId) && (row.status !== 'archived' || row.id === draft.departmentId)) },
    { key: 'vehicleId' as const, label: 'Fahrzeug', rows: props.snapshot.vehicles.filter(row => row.status !== 'archived' || row.id === draft.vehicleId).map(row => ({ id: row.id, label: row.plate })) },
  ];
  return <Frame {...props} title="Inventar zuordnen" subtitle={vehicle ? vehicle.plate : 'Organisatorische Zuordnung im Unternehmen'} action="Zuordnung speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}><section className="cr-form-section"><h3>Inventar & Organisation</h3><p className="cr-note">Diese Zuordnung beschreibt, wo der Gegenstand organisatorisch geführt wird. Persönliche Ausgaben und Rückgaben bleiben in der Inventarakte dokumentiert.</p><div className="cr-form-grid"><Field label="Inventareintrag" required wide error={error}><select className="cr-input" value={draft.inventoryItemId} onChange={event => patch('inventoryItemId', event.target.value)}><option value="">Gegenstand auswählen</option>{draft.inventoryItemId && !props.snapshot.inventoryItems.some(item => item.id === draft.inventoryItemId) && <option value={draft.inventoryItemId}>Eintrag nicht verfügbar</option>}{props.snapshot.inventoryItems.filter(item => !['archived', 'decommissioned'].includes(item.status ?? '') || item.id === draft.inventoryItemId).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field>{selectors.map(({ key, label, rows }) => <Field key={key} label={label}><select className="cr-input" value={draft[key]} onChange={event => patch(key, event.target.value)}><option value="">Nicht zugeordnet</option>{draft[key] && !rows.some(row => row.id === draft[key]) && <option value={draft[key]}>Bestehende Zuordnung</option>}{rows.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></Field>)}<Field label="Notizen zur Zuordnung" wide><textarea className="cr-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={12000} /></Field></div></section></Frame>;
}
