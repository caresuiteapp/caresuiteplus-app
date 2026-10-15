import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import type { CompanyOrganizationPermissions, CompanyOrganizationResult, CompanyOrganizationScope, CompanyOrganizationSnapshot } from '@/types/tenant/companyOrganization';
import { saveCompanyDepartment, saveCompanyEmployeePlacement, saveCompanyLegalEntity, saveCompanyRelationship, saveCompanySite } from '@/lib/tenant/companyOrganizationService.web';
import {
  nullableOrganizationValue as nullable, organizationDescendants, organizationDraft, organizationPersonName, organizationVersion,
  ORGANIZATION_STATUS, RELATIONSHIP_KINDS, SITE_KINDS, validateOrganizationDraft,
  type OrganizationDraft, type OrganizationEditDialog,
} from './companyOrganizationModel.web';
import { companyOrganizationCss } from './companyOrganizationCss.web';

export type RunOrganizationMutation = <T>(operation: () => Promise<CompanyOrganizationResult<T>>, message: string) => Promise<boolean>;
type Props = {
  dialog: OrganizationEditDialog; scope: CompanyOrganizationScope; snapshot: CompanyOrganizationSnapshot; permissions: CompanyOrganizationPermissions;
  busy: boolean; blocked: boolean; error: string | null; run: RunOrganizationMutation;
  onDirtyChange: (dirty: boolean) => void; onClose: () => void; onSaved: () => void; onReload: () => Promise<boolean>;
};
function Field({ label, required, hint, error, wide, children }: { label: string; required?: boolean; hint?: string; error?: string; wide?: boolean; children: ReactNode }) {
  return <label className={`cg-field${wide ? ' cg-span-2' : ''}`}>
    <span>{label}{required && <small>Pflichtangabe</small>}</span>{children}
    {hint && <small className="cg-note">{hint}</small>}
    {error && <small className="cg-field-error" role="alert">{error}</small>}
  </label>;
}
function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="cg-form-section"><h3>{title}</h3>{description && <p>{description}</p>}<div className="cg-form-grid">{children}</div></section>;
}
const TITLES = { entity: 'Gesellschaft', site: 'Standort', department: 'Abteilung', placement: 'Personalzuordnung', relationship: 'Beziehung' };

export function CompanyOrganizationEditor(props: Props) {
  const { dialog, snapshot, permissions, onDirtyChange } = props;
  const formId = useId();
  const initial = useMemo(() => {
    const value = organizationDraft(dialog);
    if (dialog.record || !snapshot.scopeLimited) return value;
    const department = dialog.kind === 'placement' ? snapshot.departments.find(entry => entry.status === 'active') : undefined;
    const site = snapshot.sites.find(entry => entry.status === 'active' && (!department || entry.id === department.siteId));
    const entity = snapshot.entities.find(entry => entry.status === 'active');
    const locationScope = dialog.kind === 'department' || dialog.kind === 'placement';
    return { ...value, entityId: locationScope ? department ? department.entityId ?? '' : site ? site.entityId ?? '' : entity?.id ?? '' : entity?.id ?? '', siteId: locationScope ? department?.siteId ?? site?.id ?? '' : '', departmentId: department?.id ?? '' };
  }, [dialog, snapshot]);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const set = <K extends keyof OrganizationDraft>(key: K, value: OrganizationDraft[K]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: '' }));
  };
  const input = (key: keyof OrganizationDraft, label: string, options: { type?: string; required?: boolean; hint?: string; wide?: boolean; list?: string; placeholder?: string } = {}) => <Field label={label} required={options.required} error={errors[key]} hint={options.hint} wide={options.wide}>
    <input className="cg-input" type={options.type ?? 'text'} value={String(draft[key])} aria-invalid={Boolean(errors[key])} autoComplete="off" maxLength={key === 'notes' ? 10000 : 1000} list={options.list} placeholder={options.placeholder}
      onChange={event => set(key, event.target.value)} />
  </Field>;
  const textarea = (key: keyof OrganizationDraft, label: string, hint?: string) => <Field label={label} wide error={errors[key]} hint={hint}>
    <textarea className="cg-input" value={String(draft[key])} maxLength={10000} onChange={event => set(key, event.target.value)} />
  </Field>;
  const select = (key: keyof OrganizationDraft, label: string, choices: { id: string; name: string }[], options: { empty?: string; required?: boolean; hint?: string; disabled?: boolean; onChange?: (value: string) => void } = {}) => {
    const selected = String(draft[key]);
    const available = !selected || choices.some(choice => choice.id === selected);
    return <Field label={label} required={options.required} error={errors[key]} hint={options.hint}>
      <select className="cg-input" value={selected} aria-invalid={Boolean(errors[key])} disabled={options.disabled} onChange={event => options.onChange ? options.onChange(event.target.value) : set(key, event.target.value)}>
        <option value="">{options.empty ?? 'Bitte auswählen'}</option>
        {!available && <option value={selected}>Bestehende Zuordnung beibehalten</option>}
        {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
      </select>
    </Field>;
  };
  const activeChoice = <T extends { id: string; name: string; status: string }>(items: T[], current?: string) => items.filter(item => item.status === 'active' || item.id === current).map(item => ({ id: item.id, name: `${item.name}${item.status !== 'active' ? ` · ${ORGANIZATION_STATUS[item.status as keyof typeof ORGANIZATION_STATUS]}` : ''}` }));
  const forbiddenEntities = organizationDescendants(snapshot.entities, dialog.kind === 'entity' ? dialog.record?.id : undefined);
  const forbiddenDepartments = organizationDescendants(snapshot.departments, dialog.kind === 'department' ? dialog.record?.id : undefined);
  const entities = activeChoice(snapshot.entities, draft.entityId);
  const sites = activeChoice(snapshot.sites.filter(site => (site.entityId ?? '') === draft.entityId), draft.siteId);
  const departments = activeChoice(snapshot.departments.filter(department => (department.entityId ?? '') === draft.entityId && (!draft.siteId || !department.siteId || department.siteId === draft.siteId)), draft.departmentId);
  const employees = snapshot.employees.filter(employee => employee.status === 'active' || employee.id === draft.employeeId || employee.id === draft.leaderEmployeeId).map(employee => ({ id: employee.id, name: `${employee.firstName} ${employee.lastName}${employee.status !== 'active' ? ' · inaktiv' : ''}`.trim() }));
  const changeEntity = (value: string) => { setDraft(previous => ({ ...previous, entityId: value, siteId: '', departmentId: '', parentDepartmentId: '', partnerEntityId: previous.partnerEntityId === value ? '' : previous.partnerEntityId })); setErrors({}); };
  const fixedHierarchy = snapshot.scopeLimited && Boolean(dialog.record) && (dialog.kind === 'site' || dialog.kind === 'department');
  const entitySelect = select('entityId', 'Gesellschaft', entities, { empty: 'Hauptunternehmen', onChange: changeEntity, disabled: fixedHierarchy, hint: fixedHierarchy ? 'Die Zuordnung wird zentral verwaltet.' : undefined });
  const leadership = select('leaderEmployeeId', 'Leitung', employees, { empty: 'Noch keine Leitung zuordnen', disabled: !permissions.viewEmployees || !snapshot.employeesVisible, hint: permissions.viewEmployees ? 'Aus dem vorhandenen Personal auswählen.' : draft.leaderEmployeeId ? organizationPersonName(snapshot, draft.leaderEmployeeId, false) : 'Für die Personalauswahl fehlt die Personalberechtigung.' });
  const costCenter = select('costCenterId', 'Kostenstelle', snapshot.costCenters.filter(entry => entry.isActive || entry.id === draft.costCenterId).map(entry => ({ id: entry.id, name: `${entry.code} · ${entry.name}${entry.isActive ? '' : ' · inaktiv'}` })), { empty: 'Keine Kostenstelle zuordnen', hint: snapshot.costCenters.length ? 'Vorhandene Kostenstellen des Unternehmens.' : 'Es sind noch keine Kostenstellen hinterlegt.' });
  const address = <Section title="Adresse">{input('street', 'Straße und Hausnummer', { wide: true })}{input('postalCode', 'Postleitzahl')}{input('city', 'Ort')}{input('country', 'Land', { required: true, list: `${formId}-countries`, hint: 'Zweistelliges Länderkürzel, z. B. DE.' })}<datalist id={`${formId}-countries`}><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option><option value="NL">Niederlande</option><option value="BE">Belgien</option><option value="LU">Luxemburg</option></datalist></Section>;
  const contacts = <Section title="Kontakt & Hinweise">{input('contactName', 'Ansprechperson')}{input('phone', 'Telefon', { type: 'tel' })}{input('email', 'E-Mail', { type: 'email', wide: true })}{textarea('notes', 'Interne Hinweise')}</Section>;

  async function submit() {
    if (props.busy || props.blocked) return;
    const validation = validateOrganizationDraft(dialog.kind, draft); setErrors(validation);
    if (Object.keys(validation).length) return;
    const base = { ...organizationVersion(dialog.record), status: draft.status };
    const contact = { contactName: nullable(draft.contactName), email: nullable(draft.email), phone: nullable(draft.phone), notes: nullable(draft.notes) };
    const addressData = { street: nullable(draft.street), postalCode: nullable(draft.postalCode), city: nullable(draft.city), country: draft.country.trim().toUpperCase() };
    const common = { name: draft.name.trim(), code: nullable(draft.code), leaderEmployeeId: nullable(draft.leaderEmployeeId) };
    const entityId = nullable(draft.entityId);
    const message = dialog.record ? `${TITLES[dialog.kind]} wurde gespeichert.` : `${TITLES[dialog.kind]} wurde angelegt.`;
    let result = false;
    if (dialog.kind === 'entity') result = await props.run(() => saveCompanyLegalEntity(props.scope, { ...base, ...common, ...contact, ...addressData, parentEntityId: nullable(draft.parentEntityId), legalForm: nullable(draft.legalForm), registrationNumber: nullable(draft.registrationNumber), taxNumber: nullable(draft.taxNumber), vatId: nullable(draft.vatId), website: draft.website.trim() ? draft.website.includes('://') ? draft.website.trim() : `https://${draft.website.trim()}` : null }), message);
    if (dialog.kind === 'site') result = await props.run(() => saveCompanySite(props.scope, { ...base, ...common, ...contact, ...addressData, entityId, kind: draft.siteKind, costCenterId: nullable(draft.costCenterId), openingHours: nullable(draft.openingHours) }), message);
    if (dialog.kind === 'department') result = await props.run(() => saveCompanyDepartment(props.scope, { ...base, ...common, ...contact, entityId, siteId: nullable(draft.siteId), parentDepartmentId: nullable(draft.parentDepartmentId), costCenterId: nullable(draft.costCenterId) }), message);
    if (dialog.kind === 'placement') result = await props.run(() => saveCompanyEmployeePlacement(props.scope, { ...base, employeeId: draft.employeeId, entityId, siteId: nullable(draft.siteId), departmentId: nullable(draft.departmentId), roleTitle: nullable(draft.roleTitle), startsOn: draft.startsOn, endsOn: nullable(draft.endsOn), isPrimary: draft.isPrimary, allocationPercent: draft.allocationPercent ? Number(draft.allocationPercent.replace(',', '.')) : null, notes: nullable(draft.notes) }), message);
    if (dialog.kind === 'relationship') result = await props.run(() => saveCompanyRelationship(props.scope, { ...base, ...contact, entityId, partnerEntityId: nullable(draft.partnerEntityId), partnerName: draft.partnerEntityId ? snapshot.entities.find(entity => entity.id === draft.partnerEntityId)?.name ?? draft.partnerName.trim() : draft.partnerName.trim(), kind: draft.relationKind, territory: nullable(draft.territory), ownershipPercent: draft.ownershipPercent ? Number(draft.ownershipPercent.replace(',', '.')) : null, startsOn: nullable(draft.startsOn), endsOn: nullable(draft.endsOn), contractReference: nullable(draft.contractReference), responsibilities: nullable(draft.responsibilities) }), message);
    if (result) props.onSaved();
  }

  return <PlatformModal visible surfaceScope="company" title={`${TITLES[dialog.kind]} ${dialog.record ? 'bearbeiten' : 'anlegen'}`}
    subtitle="Unternehmensstruktur" onClose={props.onClose} dismissOnBackdrop={!props.busy} maxWidth={880} minWidth={260} maxHeightRatio={0.93}
    bodyStyle={{ backgroundColor: '#0b1d30', padding: 20 }} sheetStyle={{ backgroundColor: '#0b1d30' }}
    footerContent={<div className="cg-dialog cg-form-footer"><span aria-live="polite">{props.busy ? 'Änderung wird gespeichert …' : props.blocked ? 'Aktuellen Speicherstand laden' : dirty ? 'Ungespeicherte Eingaben' : 'Unternehmen · Organisation'}</span><div className="cg-actions"><button type="button" className="cg-button cg-button--quiet" disabled={props.busy} onClick={props.onClose}>Abbrechen</button><button type="submit" form={formId} className="cg-button cg-button--primary" disabled={props.busy || props.blocked}>{props.busy ? 'Wird gespeichert …' : dialog.record ? 'Änderungen speichern' : `${TITLES[dialog.kind]} anlegen`}</button></div></div>}>
    <style>{companyOrganizationCss}</style>
    <form id={formId} className="cg-dialog" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      {props.error && <div className="cg-banner cg-banner--error" role="alert">{props.error}</div>}
      {props.blocked && <div className="cg-banner" role="status"><div><strong>Speicherstand prüfen</strong><p>Der Datensatz muss neu geladen werden, bevor weitere Änderungen möglich sind. Ihr bisheriger Entwurf wird dabei geschlossen. Prüfen Sie danach die aktuellen Angaben.</p><div className="cg-actions"><button type="button" className="cg-button" disabled={props.busy} onClick={() => void props.onReload()}>Neu laden und Entwurf schließen</button></div></div></div>}
      <fieldset disabled={props.busy || props.blocked}>
        <Section title={dialog.kind === 'relationship' ? 'Partner & Beziehung' : dialog.kind === 'placement' ? 'Person & Zuordnung' : 'Grundangaben'}>
          {['entity', 'site', 'department'].includes(dialog.kind) && <>{input('name', 'Bezeichnung', { required: true, wide: true })}{input('code', 'Kürzel', { hint: 'Zum schnellen Wiederfinden, z. B. HER oder VERW.' })}</>}
          <Field label="Status"><select className="cg-input" value={draft.status} onChange={event => set('status', event.target.value as OrganizationDraft['status'])}>{Object.entries(ORGANIZATION_STATUS).filter(([key]) => key !== 'archived' || dialog.record?.status === 'archived').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          {dialog.kind === 'entity' && <>{input('legalForm', 'Rechtsform', { list: `${formId}-legal` })}<datalist id={`${formId}-legal`}>{['UG (haftungsbeschränkt)', 'GmbH', 'GmbH & Co. KG', 'AG', 'GbR', 'e. V.', 'Einzelunternehmen'].map(value => <option key={value} value={value} />)}</datalist>{select('parentEntityId', 'Übergeordnete Gesellschaft', activeChoice(snapshot.entities.filter(entity => !forbiddenEntities.has(entity.id)), draft.parentEntityId), { empty: 'Keine übergeordnete Gesellschaft', hint: 'Eine Zuordnung vergibt keine Zugriffsrechte.' })}{leadership}</>}
          {dialog.kind === 'site' && <>{entitySelect}<Field label="Standortart"><select className="cg-input" value={draft.siteKind} onChange={event => set('siteKind', event.target.value as OrganizationDraft['siteKind'])}>{Object.entries(SITE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>{leadership}{costCenter}</>}
          {dialog.kind === 'department' && <>{entitySelect}{select('siteId', 'Standort', sites, { empty: 'Standortübergreifend', disabled: fixedHierarchy, hint: fixedHierarchy ? 'Die Zuordnung wird zentral verwaltet.' : undefined, onChange: value => { setDraft(previous => ({ ...previous, siteId: value, parentDepartmentId: '' })); setErrors({}); } })}{select('parentDepartmentId', 'Übergeordnete Abteilung', activeChoice(snapshot.departments.filter(department => !forbiddenDepartments.has(department.id) && (department.entityId ?? '') === draft.entityId && (!department.siteId || department.siteId === draft.siteId)), draft.parentDepartmentId), { empty: 'Keine übergeordnete Abteilung', disabled: fixedHierarchy, hint: fixedHierarchy ? 'Die Zuordnung wird zentral verwaltet.' : undefined })}{leadership}{costCenter}</>}
          {dialog.kind === 'placement' && <>{select('employeeId', 'Mitarbeitende Person', employees, { required: true })}{entitySelect}{select('siteId', 'Standort', sites, { empty: 'Standortübergreifend', onChange: value => { setDraft(previous => ({ ...previous, siteId: value, departmentId: '' })); setErrors({}); } })}{select('departmentId', 'Abteilung', departments, { empty: 'Keine Abteilung zuordnen', onChange: value => { const department = snapshot.departments.find(entry => entry.id === value); setDraft(previous => ({ ...previous, departmentId: value, siteId: department?.siteId ?? previous.siteId })); setErrors({}); } })}{input('roleTitle', 'Aufgabe / Funktion', { list: `${formId}-roles`, wide: true })}<datalist id={`${formId}-roles`}>{['Standortleitung', 'Abteilungsleitung', 'Teamleitung', 'Stellvertretung', 'Verwaltung', 'Mitarbeit'].map(value => <option key={value} value={value} />)}</datalist></>}
          {dialog.kind === 'relationship' && <>{entitySelect}<Field label="Beziehungsart"><select className="cg-input" value={draft.relationKind} onChange={event => set('relationKind', event.target.value as OrganizationDraft['relationKind'])}>{Object.entries(RELATIONSHIP_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>{select('partnerEntityId', 'Vertragspartner', activeChoice(snapshot.entities.filter(entity => entity.id !== draft.entityId), draft.partnerEntityId), { empty: 'Externen Vertragspartner erfassen', hint: 'Gespeicherte Gesellschaft auswählen oder einen externen Partner benennen.', onChange: value => { setDraft(previous => ({ ...previous, partnerEntityId: value, partnerName: snapshot.entities.find(entity => entity.id === value)?.name ?? '' })); setErrors({}); } })}{!draft.partnerEntityId && input('partnerName', 'Name des externen Vertragspartners', { required: true, wide: true })}<p className="cg-note cg-span-2">Diese Beziehung dokumentiert die Unternehmensstruktur. Sie erteilt keine Berechtigung für Daten anderer Unternehmen.</p></>}
        </Section>
        {(dialog.kind === 'entity' || dialog.kind === 'site') && address}
        {dialog.kind === 'entity' && <Section title="Register & Steuerdaten">{input('registrationNumber', 'Handelsregister / Registernummer')}{input('taxNumber', 'Steuernummer')}{input('vatId', 'Umsatzsteuer-ID')}{input('website', 'Website', { placeholder: 'https://' })}</Section>}
        {dialog.kind === 'site' && <Section title="Erreichbarkeit">{textarea('openingHours', 'Öffnungs- und Erreichbarkeitszeiten', 'Wochentage, Zeiten und abweichende Erreichbarkeit eintragen.')}</Section>}
        {dialog.kind === 'placement' && <Section title="Zeitraum & Umfang" description="Mehrere Zuordnungen sind möglich. Eine Hauptzuordnung kennzeichnet den vorrangigen Einsatzort.">{input('startsOn', 'Gültig ab', { type: 'date', required: true })}{input('endsOn', 'Gültig bis', { type: 'date', hint: 'Leer lassen, wenn die Zuordnung unbefristet gilt.' })}{input('allocationPercent', 'Anteil in Prozent', { hint: 'Optionaler Anteil dieser Zuordnung, 0 bis 100.' })}<label className="cg-checkbox"><input type="checkbox" checked={draft.isPrimary} onChange={event => set('isPrimary', event.target.checked)} /><span><strong>Hauptzuordnung</strong><small>Als vorrangige organisatorische Zuordnung führen.</small></span></label>{textarea('notes', 'Interne Hinweise')}</Section>}
        {dialog.kind === 'relationship' && <Section title="Vertrag & Zuständigkeit">{input('startsOn', 'Beginn', { type: 'date' })}{input('endsOn', 'Ende', { type: 'date' })}{input('territory', 'Gebiet / Region', { hint: 'Zum Beispiel Stadtgebiet, Postleitzahlen oder Vertragsgebiet.' })}{input('ownershipPercent', 'Beteiligung in Prozent', { hint: 'Nur bei einer gesellschaftlichen Beteiligung ausfüllen.' })}{input('contractReference', 'Vertragsbezeichnung / Aktenzeichen', { wide: true })}{textarea('responsibilities', 'Aufgaben und Zuständigkeiten')}</Section>}
        {dialog.kind !== 'placement' && contacts}
      </fieldset>
    </form>
  </PlatformModal>;
}
