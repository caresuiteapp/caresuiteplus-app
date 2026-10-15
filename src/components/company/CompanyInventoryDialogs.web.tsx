import { useEffect, useId, useState, type ReactNode } from 'react';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import type {
  InventoryAssignment, InventoryCategory, InventoryCategoryGroup, InventoryCondition,
  InventoryItem, InventoryLocation, InventoryReturnCapture, InventoryDamageReport,
} from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';
import {
  saveCompanyInventoryItem, saveCompanyInventoryCategory, saveCompanyInventoryLocation,
  issueCompanyInventoryItem, returnCompanyInventoryItem, reportCompanyInventoryDamage, resolveCompanyInventoryDamage,
  type CompanyInventoryResult, type CompanyInventoryScope, type CompanyInventorySnapshot,
} from '@/lib/inventory/companyInventoryService.web';
import {
  CONDITION_LABELS, EDITABLE_ITEM_STATUSES, INVENTORY_STATUS_LABELS,
  inventoryItemDraft, isAssignmentOpen, validateInventoryItemDraft,
} from './companyInventoryModel.web';
import { companyInventoryCss } from './companyInventoryCss.web';

export type InventoryEditDialog =
  | { kind: 'item'; item?: InventoryItem }
  | { kind: 'category'; category?: InventoryCategory }
  | { kind: 'location'; location?: InventoryLocation }
  | { kind: 'issue'; item: InventoryItem }
  | { kind: 'return'; assignment: InventoryAssignment }
  | { kind: 'damage'; item?: InventoryItem }
  | { kind: 'resolveDamage'; report: InventoryDamageReport };
export type RunInventoryMutation = <T>(
  operation: () => Promise<CompanyInventoryResult<T>>, message: string,
) => Promise<boolean>;

type EditorProps = {
  scope: CompanyInventoryScope;
  snapshot: CompanyInventorySnapshot;
  busy: boolean;
  blocked: boolean;
  error: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => Promise<boolean>;
  run: RunInventoryMutation;
};

function Field({ label, required, error, children, hint, wide }: {
  label: string; required?: boolean; error?: string; children: ReactNode; hint?: string; wide?: boolean;
}) {
  return <label className={`ci-field${wide ? ' ci-span-2' : ''}`}>
    <span>
      {label}{required && <small>Pflichtangabe</small>}
    </span>
    {children}
    {hint && <small className="ci-note">
      {hint}
    </small>}
    {error && <small className="ci-field-error">
      {error}
    </small>}
  </label>;
}
function Toggle({ label, hint, value, onChange }: {
  label: string; hint: string; value: boolean; onChange: (value: boolean) => void;
}) {
  return <label className="ci-toggle">
    <input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} />
    <span>
      <strong>
        {label}
      </strong>
      <small>
        {hint}
      </small>
    </span>
  </label>;
}
function Conditions({ value, onChange, excludeLost = false, disabled = false, invalid = false }: {
  value: InventoryCondition; onChange: (value: InventoryCondition) => void; excludeLost?: boolean; disabled?: boolean; invalid?: boolean;
}) {
  return <select className="ci-input" value={value} disabled={disabled} aria-invalid={invalid} onChange={event => onChange(event.target.value as InventoryCondition)}>
    {Object.entries(CONDITION_LABELS).filter(([key]) => !excludeLost || key !== 'lost').map(([key, label]) => <option key={key} value={key}>
      {label}
    </option>)}
  </select>;
}
function EditorFrame({ title, subtitle, action, dirty, submit, children, ...props }: EditorProps & {
  title: string; subtitle: string; action: string; dirty: boolean; submit: () => Promise<void>; children: ReactNode;
}) {
  const formId = useId();
  const { onDirtyChange } = props;
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  return <PlatformModal visible surfaceScope="company" title={title} subtitle={subtitle}
    onClose={props.onClose} dismissOnBackdrop={!props.busy} maxWidth={850} minWidth={260} maxHeightRatio={0.93}
    bodyStyle={{ backgroundColor: '#0b1a2c', padding: 20 }} sheetStyle={{ backgroundColor: '#0b1a2c' }}
    footerContent={<div className="ci-dialog ci-form-footer">
      <div className="ci-footer-row">
        <span aria-live="polite">
          {props.busy ? 'Änderung wird gespeichert …' : props.blocked ? 'Bestand muss neu geladen werden' : dirty ? 'Ungespeicherte Eingaben' : 'Inventar im Unternehmen'}
        </span>
        <div className="ci-actions">
          <button type="button" className="ci-button ci-button--quiet" disabled={props.busy} onClick={props.onClose}>Abbrechen</button>
          <button type="submit" form={formId} className="ci-button ci-button--primary" disabled={props.busy || props.blocked}>
            {props.busy ? 'Wird gespeichert …' : action}
          </button>
        </div>
      </div>
    </div>}>
    <style>
      {companyInventoryCss}
    </style>
    <form id={formId} className="ci-dialog" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      {props.error && <div className="ci-banner ci-banner--error" role="alert">
        {props.error}
      </div>}
      {props.blocked && <div className="ci-banner ci-banner--info" role="status">
        <div>
          <strong>Speicherstand prüfen</strong>
          <p>Der Vorgang wurde möglicherweise bereits teilweise gespeichert. Laden Sie den Bestand neu und prüfen Sie ihn. Der bisherige Entwurf wird dabei geschlossen, um doppeltes Speichern zu vermeiden.</p>
          <div className="ci-actions">
            <button type="button" className="ci-button" disabled={props.busy} onClick={() => void props.onReload()}>Bestand neu laden und Entwurf schließen</button>
          </div>
        </div>
      </div>}
      <fieldset disabled={props.busy || props.blocked}>
        {children}
      </fieldset>
    </form>
  </PlatformModal>;
}

export function CompanyInventoryEditor({ dialog, ...props }: EditorProps & { dialog: InventoryEditDialog }) {
  if (props.snapshot.scopeLimited && (dialog.kind === 'category' || dialog.kind === 'location' || (dialog.kind === 'item' && !dialog.item))) return <PlatformModal visible surfaceScope="company" title="Zentrale Inventarverwaltung" onClose={props.onClose}>
    <p>Neue Inventarposten, Kategorien und Lagerorte werden durch die zentrale Verwaltung gepflegt.</p>
  </PlatformModal>;
  if (dialog.kind === 'item') return <ItemEditor {...props} item={dialog.item} />;
  if (dialog.kind === 'category') return <CategoryEditor {...props} category={dialog.category} />;
  if (dialog.kind === 'location') return <LocationEditor {...props} location={dialog.location} />;
  if (dialog.kind === 'issue') return <IssueEditor {...props} item={dialog.item} />;
  if (dialog.kind === 'resolveDamage') return <ResolveDamageEditor {...props} report={dialog.report} />;
  if (dialog.kind === 'return') return <ReturnEditor {...props} assignment={dialog.assignment} />;
  return <DamageEditor {...props} item={dialog.item} />;
}

function ItemEditor({ item, ...props }: EditorProps & { item?: InventoryItem }) {
  const [initial] = useState(() => inventoryItemDraft(item));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateInventoryItemDraft(draft);
  const hasAssignment = props.snapshot.assignments.some(assignment => assignment.itemId === item?.id && isAssignmentOpen(assignment));
  const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const fieldError = (key: string) => submitted ? errors[key] : undefined;
  async function submit() {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const input = {
      ...draft, id: item?.id, name: draft.name.trim(), expectedUpdatedAt: item?.updatedAt,
      locationId: draft.locationId || null, purchaseDate: draft.purchaseDate || null,
      warrantyUntil: draft.warrantyUntil || null,
      status: !hasAssignment && EDITABLE_ITEM_STATUSES.includes(draft.status) ? draft.status : undefined,
    };
    if (await props.run(() => saveCompanyInventoryItem(props.scope, input), item ? 'Inventar wurde aktualisiert.' : 'Inventar wurde angelegt.')) props.onSaved();
  }
  return <EditorFrame {...props} title={item ? 'Inventar bearbeiten' : 'Inventar anlegen'}
    subtitle="Stammdaten, Aufbewahrung und Rückgabe" action={item ? 'Änderungen speichern' : 'Inventar anlegen'}
    dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit}>
    <section className="ci-form-section">
      <h3>Gegenstand & Kennzeichnung</h3>
      <p className="ci-note">Erfassen Sie jeden einzeln ausgegebenen Gegenstand als eigenen Bestandsposten.</p>
      <div className="ci-form-grid">
        <Field label="Bezeichnung" required wide error={fieldError('name')}>
          <input className="ci-input" autoFocus value={draft.name} aria-invalid={Boolean(fieldError('name'))} onChange={event => patch('name', event.target.value)} placeholder="Zum Beispiel: Diensttelefon Verwaltung" maxLength={200} />
        </Field>
        <Field label="Kategorie" required error={fieldError('categoryId')}>
          <select className="ci-input" value={draft.categoryId} aria-invalid={Boolean(fieldError('categoryId'))} onChange={event => {
            const category = props.snapshot.categories.find(entry => entry.id === event.target.value);
            setDraft(current => ({ ...current, categoryId: event.target.value, ...(!item && category ? { requiresReturnOnExit: category.requiresReturnOnExit, portalVisibleToEmployee: category.portalVisibleToEmployee } : {}) }));
          }}>
            <option value="">Kategorie auswählen</option>
            {props.snapshot.categories.map(category => <option key={category.id} value={category.id}>
              {category.label}
            </option>)}
          </select>
        </Field>
        <Field label="Inventarnummer / Kennung">
          <input className="ci-input" value={draft.sku} onChange={event => patch('sku', event.target.value)} maxLength={120} />
        </Field>
        <Field label="Seriennummer">
          <input className="ci-input" value={draft.serialNumber} onChange={event => patch('serialNumber', event.target.value)} maxLength={160} />
        </Field>
        <Field label="Barcode-Kennung" hint="Vorhandene Kennung als Text hinterlegen.">
          <input className="ci-input" value={draft.barcode} onChange={event => patch('barcode', event.target.value)} maxLength={160} />
        </Field>
        <Field label="Hersteller">
          <input className="ci-input" value={draft.manufacturer} onChange={event => patch('manufacturer', event.target.value)} maxLength={160} />
        </Field>
        <Field label="Modell">
          <input className="ci-input" value={draft.model} onChange={event => patch('model', event.target.value)} maxLength={160} />
        </Field>
      </div>
    </section>
    <section className="ci-form-section">
      <h3>Aufbewahrung & Zustand</h3>
      <p className="ci-note">Lagerorte beschreiben die Aufbewahrung, zum Beispiel Gebäude und Raum.</p>
      <div className="ci-form-grid">
        <Field label="Lagerort">
          <select className="ci-input" value={draft.locationId} onChange={event => patch('locationId', event.target.value)}>
            <option value="">Ohne festen Lagerort</option>
            {props.snapshot.locations.map(location => <option key={location.id} value={location.id}>
              {location.label}
            </option>)}
          </select>
        </Field>
        <Field label="Zustand" error={fieldError('condition')} hint={hasAssignment ? 'Bei einer offenen Ausgabe bitte Rücknahme oder Schadenmeldung verwenden.' : undefined}>
          <Conditions value={draft.condition} disabled={hasAssignment} invalid={Boolean(fieldError('condition'))} onChange={value => patch('condition', value)} />
        </Field>
        <Field label="Bestandsstatus" hint={hasAssignment ? 'Bei einer offenen Ausgabe wird der Status durch Ausgabe und Rücknahme geführt.' : undefined}>
          <select className="ci-input" value={draft.status} disabled={hasAssignment} onChange={event => patch('status', event.target.value as typeof draft.status)}>
            {!EDITABLE_ITEM_STATUSES.includes(draft.status) && <option value={draft.status}>
              {INVENTORY_STATUS_LABELS[draft.status]}
            </option>}
            {EDITABLE_ITEM_STATUSES.map(status => <option key={status} value={status}>
              {INVENTORY_STATUS_LABELS[status]}
            </option>)}
          </select>
        </Field>
        <Field label="Kaufdatum">
          <input className="ci-input" type="date" value={draft.purchaseDate} onChange={event => patch('purchaseDate', event.target.value)} />
        </Field>
        <Field label="Garantie bis" error={fieldError('warrantyUntil')}>
          <input className="ci-input" type="date" value={draft.warrantyUntil} aria-invalid={Boolean(fieldError('warrantyUntil'))} onChange={event => patch('warrantyUntil', event.target.value)} />
        </Field>
        <Field label="Hinweise" wide>
          <textarea className="ci-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={5000} placeholder="Zubehör, Aufbewahrung oder weitere Angaben" />
        </Field>
      </div>
    </section>
    <section className="ci-form-section">
      <h3>Ausgabe & Rückgabe</h3>
      <p className="ci-note">Die Vorgaben gelten für neue Ausgaben. Bereits dokumentierte Ausgaben behalten ihre Angaben.</p>
      <div className="ci-form-grid">
        <Toggle label="Bei Austritt zurückgeben" hint="Für diesen Gegenstand ist eine Personalrückgabe vorgesehen." value={draft.requiresReturnOnExit} onChange={value => patch('requiresReturnOnExit', value)} />
        <Toggle label="Im Mitarbeitendenportal anzeigen" hint="Die ausgegebene Ausstattung darf der betreffenden Person angezeigt werden." value={draft.portalVisibleToEmployee} onChange={value => patch('portalVisibleToEmployee', value)} />
      </div>
    </section>
  </EditorFrame>;
}

function CategoryEditor({ category, ...props }: EditorProps & { category?: InventoryCategory }) {
  const [initial] = useState(() => ({
    label: category?.label ?? '', group: category?.group ?? 'devices' as InventoryCategoryGroup,
    requiresReturnOnExit: category?.requiresReturnOnExit ?? true, portalVisibleToEmployee: category?.portalVisibleToEmployee ?? true,
    barcodeEnabled: category?.barcodeEnabled ?? false
  }));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  async function submit() {
    setSubmitted(true);
    if (!draft.label.trim()) return;
    if (await props.run(() => saveCompanyInventoryCategory(props.scope, { ...draft, label: draft.label.trim(), id: category?.id, expectedUpdatedAt: category?.updatedAt }), 'Kategorie wurde gespeichert.')) props.onSaved();
  }
  return <EditorFrame {...props} title={category ? 'Kategorie bearbeiten' : 'Kategorie anlegen'} subtitle="Bestand verständlich gruppieren"
    action="Kategorie speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <section className="ci-form-section">
      <div className="ci-form-grid">
        <Field label="Bezeichnung" required error={submitted && !draft.label.trim() ? 'Bitte eine Bezeichnung eingeben.' : undefined}>
          <input autoFocus className="ci-input" value={draft.label} onChange={event => patch('label', event.target.value)} maxLength={160} />
        </Field>
        <Field label="Gruppe" hint={category ? 'Die Gruppe bleibt für vorhandene Bestände unverändert.' : undefined}>
          <select className="ci-input" value={draft.group} disabled={Boolean(category)} onChange={event => patch('group', event.target.value as InventoryCategoryGroup)}>
            {Object.entries(INVENTORY_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>
              {label}
            </option>)}
          </select>
        </Field>
        <Toggle label="Rückgabe bei Austritt vorsehen" hint="Wird beim Anlegen neuer Gegenstände als Vorschlag übernommen." value={draft.requiresReturnOnExit} onChange={value => patch('requiresReturnOnExit', value)} />
        <Toggle label="Im Mitarbeitendenportal anzeigen" hint="Vorgabe für neue Gegenstände dieser Kategorie." value={draft.portalVisibleToEmployee} onChange={value => patch('portalVisibleToEmployee', value)} />
      </div>
    </section>
  </EditorFrame>;
}

function LocationEditor({ location, ...props }: EditorProps & { location?: InventoryLocation }) {
  const [initial] = useState(() => ({ label: location?.label ?? '', building: location?.building ?? '', room: location?.room ?? '', notes: location?.notes ?? '' }));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  async function submit() {
    setSubmitted(true);
    if (!draft.label.trim()) return;
    if (await props.run(() => saveCompanyInventoryLocation(props.scope, { ...draft, label: draft.label.trim(), id: location?.id, expectedUpdatedAt: location?.updatedAt }), 'Lagerort wurde gespeichert.')) props.onSaved();
  }
  return <EditorFrame {...props} title={location ? 'Lagerort bearbeiten' : 'Lagerort anlegen'} subtitle="Aufbewahrung im Unternehmen"
    action="Lagerort speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <section className="ci-form-section">
      <div className="ci-form-grid">
        <Field label="Bezeichnung" required wide error={submitted && !draft.label.trim() ? 'Bitte eine Bezeichnung eingeben.' : undefined}>
          <input autoFocus className="ci-input" value={draft.label} onChange={event => patch('label', event.target.value)} maxLength={160} placeholder="Zum Beispiel: Materiallager Hauptsitz" />
        </Field>
        <Field label="Gebäude">
          <input className="ci-input" value={draft.building} onChange={event => patch('building', event.target.value)} maxLength={160} />
        </Field>
        <Field label="Raum">
          <input className="ci-input" value={draft.room} onChange={event => patch('room', event.target.value)} maxLength={160} />
        </Field>
        <Field label="Hinweise" wide>
          <textarea className="ci-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={5000} />
        </Field>
      </div>
    </section>
  </EditorFrame>;
}

function IssueEditor({ item, ...props }: EditorProps & { item: InventoryItem }) {
  const [initial] = useState(() => ({ recipientEmployeeId: '', responsibleEmployeeId: '', expectedReturnAt: '', issueCondition: item.condition, issueNotes: '' }));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const employees = props.snapshot.employees.filter(employee => ['active', 'aktiv'].includes(employee.status));
  async function submit() {
    setSubmitted(true);
    if (!draft.recipientEmployeeId) return;
    if (await props.run(() => issueCompanyInventoryItem(props.scope, {
      ...draft, itemId: item.id, expectedUpdatedAt: item.updatedAt,
      responsibleEmployeeId: draft.responsibleEmployeeId || null,
      expectedReturnAt: draft.expectedReturnAt ? `${draft.expectedReturnAt}T23:59:59` : null,
    }), 'Ausgabe wurde dokumentiert.')) props.onSaved();
  }
  return <EditorFrame {...props} title="Inventar ausgeben" subtitle={item.name} action="Ausgabe dokumentieren"
    dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    {!props.snapshot.employeesVisible || !employees.length ? <div className="ci-banner ci-banner--info">
      {props.snapshot.employeesVisible ? 'Es ist keine auswählbare Person vorhanden. Legen Sie Mitarbeitende zunächst im Personalbereich an.' : 'Für die Ausgabe benötigen Sie Zugriff auf die Personalauswahl.'}
    </div> : null}
    <section className="ci-form-section">
      <h3>Empfang & Verantwortung</h3>
      <p className="ci-note">Der Bestandsposten wird einer Person zugeordnet.</p>
      <div className="ci-form-grid">
        <Field label="Empfänger:in" required error={submitted && !draft.recipientEmployeeId ? 'Bitte eine Person auswählen.' : undefined}>
          <select className="ci-input" autoFocus value={draft.recipientEmployeeId} onChange={event => patch('recipientEmployeeId', event.target.value)}>
            <option value="">Person auswählen</option>
            {employees.map(employee => <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>)}
          </select>
        </Field>
        <Field label="Weitere verantwortliche Person">
          <select className="ci-input" value={draft.responsibleEmployeeId} onChange={event => patch('responsibleEmployeeId', event.target.value)}>
            <option value="">Keine zusätzliche Person</option>
            {employees.map(employee => <option key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </option>)}
          </select>
        </Field>
        <Field label="Rückgabe spätestens am">
          <input type="date" className="ci-input" value={draft.expectedReturnAt} onChange={event => patch('expectedReturnAt', event.target.value)} />
        </Field>
        <Field label="Zustand bei Ausgabe">
          <Conditions value={draft.issueCondition} onChange={value => patch('issueCondition', value)} excludeLost />
        </Field>
        <Field label="Übergabehinweise" wide>
          <textarea className="ci-input" value={draft.issueNotes} onChange={event => patch('issueNotes', event.target.value)} placeholder="Zum Beispiel: ausgegebenes Zubehör, Hinweise zur Nutzung" maxLength={5000} />
        </Field>
      </div>
    </section>
    <p className="ci-note">
      {item.requiresReturnOnExit ? 'Dieser Gegenstand ist bei einem Austritt zurückzugeben.' : 'Für diesen Gegenstand ist keine Rückgabe bei Austritt vorgemerkt.'}
    </p>
  </EditorFrame>;
}

type TriState = '' | 'yes' | 'no';
function TriStateField({ label, value, onChange, required = false, error }: {
  label: string; value: TriState; onChange: (value: TriState) => void; required?: boolean; error?: string;
}) {
  return <Field label={label} required={required} error={error}>
    <select className="ci-input" value={value} aria-invalid={Boolean(error)} onChange={event => onChange(event.target.value as TriState)}>
      <option value="">
        {required ? 'Bitte auswählen' : 'Nicht geprüft / nicht zutreffend'}
      </option>
      <option value="yes">Ja</option>
      <option value="no">Nein</option>
    </select>
  </Field>;
}
function ReturnEditor({ assignment, ...props }: EditorProps & { assignment: InventoryAssignment }) {
  const item = props.snapshot.items.find(entry => entry.id === assignment.itemId);
  const [initial] = useState(() => ({
    returned: '' as TriState, complete: '' as TriState, condition: 'unknown' as InventoryCondition,
    damageDescription: '', accessoriesComplete: '' as TriState, chargerReturned: '' as TriState, simRemoved: '' as TriState,
    deviceReset: '' as TriState, dataDeleted: '' as TriState, notes: ''
  }));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const digital = item?.categoryGroup === 'devices' || item?.categoryGroup === 'mobile_sim';
  const damaged = draft.returned === 'yes' && (draft.condition === 'damaged' || draft.condition === 'unusable');
  const incompleteAccessories = draft.complete === 'yes' && (draft.accessoriesComplete === 'no' || (digital && draft.chargerReturned === 'no'));
  const missingExplanation = draft.returned === 'no' && !draft.notes.trim();
  const requiredError = (value: TriState) => submitted && !value ? 'Bitte den tatsächlichen Stand auswählen.' : undefined;
  const nullable = (value: TriState) => value === '' ? null : value === 'yes';
  async function submit() {
    setSubmitted(true);
    if (!draft.returned || (draft.returned === 'yes' && !draft.complete) || (damaged && !draft.damageDescription.trim()) || incompleteAccessories || missingExplanation) return;
    const capture: InventoryReturnCapture = {
      returned: draft.returned === 'yes', complete: draft.returned === 'yes' && draft.complete === 'yes',
      condition: draft.returned === 'yes' ? draft.condition : 'unknown',
      damageDescription: damaged ? draft.damageDescription.trim() || null : null,
      accessoriesComplete: draft.returned === 'yes' ? nullable(draft.accessoriesComplete) : null,
      chargerReturned: digital && draft.returned === 'yes' ? nullable(draft.chargerReturned) : null,
      simRemoved: digital && draft.returned === 'yes' ? nullable(draft.simRemoved) : null,
      deviceReset: digital && draft.returned === 'yes' ? nullable(draft.deviceReset) : null,
      dataDeleted: digital && draft.returned === 'yes' ? nullable(draft.dataDeleted) : null, notes: draft.notes.trim() || null,
    };
    if (await props.run(() => returnCompanyInventoryItem(props.scope, {
      assignmentId: assignment.id, expectedUpdatedAt: assignment.updatedAt, capture,
    }), 'Rücknahme wurde dokumentiert.')) props.onSaved();
  }
  return <EditorFrame {...props} title="Rücknahme erfassen" subtitle={item?.name ?? 'Zugewiesenes Inventar'} action="Rücknahme dokumentieren"
    dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <section className="ci-form-section">
      <h3>Tatsächlicher Rückgabestand</h3>
      <p className="ci-note">Bestätigen Sie nur, was bei der Rücknahme tatsächlich geprüft wurde.</p>
      <div className="ci-form-grid">
        <TriStateField label="Gegenstand zurückgegeben?" required value={draft.returned} onChange={value => patch('returned', value)} error={requiredError(draft.returned)} />
        {draft.returned === 'yes' && <>
          <TriStateField label="Rückgabe vollständig?" required value={draft.complete} onChange={value => patch('complete', value)} error={requiredError(draft.complete) ?? (submitted && incompleteAccessories ? 'Fehlendes Zubehör: Bitte die Rückgabe als unvollständig erfassen.' : undefined)} />
          <Field label="Zustand bei Rücknahme">
            <Conditions value={draft.condition} onChange={value => patch('condition', value)} excludeLost />
          </Field>
          <TriStateField label="Zubehör vollständig?" value={draft.accessoriesComplete} onChange={value => patch('accessoriesComplete', value)} />
        </>}
        {draft.returned === 'no' && <p className="ci-note ci-span-2">Die Ausgabe bleibt zur Klärung offen. Die Person wird damit nicht von der Rückgabe entlastet.</p>}
        {damaged && <Field label="Schaden / Abweichung" wide required error={submitted && !draft.damageDescription.trim() ? 'Bitte die Abweichung beschreiben.' : undefined}>
          <textarea className="ci-input" value={draft.damageDescription} onChange={event => patch('damageDescription', event.target.value)} maxLength={5000} />
        </Field>}
        <Field label="Hinweise zur Rücknahme" wide required={draft.returned === 'no'} error={submitted && missingExplanation ? 'Bitte die fehlende Rückgabe beschreiben.' : undefined}>
          <textarea className="ci-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={5000} placeholder="Fehlende Teile, vereinbarte Nachreichung oder ungeklärte Angaben" />
        </Field>
      </div>
    </section>
    {digital && draft.returned === 'yes' && <section className="ci-form-section">
      <h3>Prüfung des Geräts</h3>
      <p className="ci-note">Diese Angaben dokumentieren Ihre Prüfung. Es werden keine Geräteaktionen ausgeführt.</p>
      <div className="ci-form-grid">
        <TriStateField label="Ladegerät zurückgegeben?" value={draft.chargerReturned} onChange={value => patch('chargerReturned', value)} />
        <TriStateField label="SIM-Karte entfernt?" value={draft.simRemoved} onChange={value => patch('simRemoved', value)} />
        <TriStateField label="Gerät zurückgesetzt?" value={draft.deviceReset} onChange={value => patch('deviceReset', value)} />
        <TriStateField label="Daten gelöscht?" value={draft.dataDeleted} onChange={value => patch('dataDeleted', value)} />
      </div>
    </section>}
  </EditorFrame>;
}

function DamageEditor({ item, ...props }: EditorProps & { item?: InventoryItem }) {
  const [initial] = useState(() => ({
    itemId: item?.id ?? '', reportType: 'damage' as 'damage' | 'loss' | 'missing_return',
    description: '', condition: 'damaged' as InventoryCondition
  }));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const activeAssignment = props.snapshot.assignments.find(entry => entry.itemId === draft.itemId && isAssignmentOpen(entry));
  const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
  async function submit() {
    setSubmitted(true);
    if (!draft.itemId || !draft.description.trim()) return;
    if (await props.run(() => reportCompanyInventoryDamage(props.scope, {
      ...draft, description: draft.description.trim(), assignmentId: activeAssignment?.id,
      expectedUpdatedAt: props.snapshot.items.find(entry => entry.id === draft.itemId)?.updatedAt,
      condition: draft.reportType === 'loss' ? 'lost' : draft.reportType === 'missing_return' ? props.snapshot.items.find(entry => entry.id === draft.itemId)?.condition ?? 'unknown' : draft.condition,
    }), 'Meldung wurde dokumentiert.')) props.onSaved();
  }
  return <EditorFrame {...props} title="Schaden oder Verlust melden" subtitle="Abweichungen am Inventar nachvollziehbar erfassen" action="Meldung speichern"
    dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <section className="ci-form-section">
      <div className="ci-form-grid">
        <Field label="Gegenstand" required wide error={submitted && !draft.itemId ? 'Bitte einen Gegenstand auswählen.' : undefined}>
          <select autoFocus className="ci-input" value={draft.itemId} disabled={Boolean(item)} onChange={event => patch('itemId', event.target.value)}>
            <option value="">Gegenstand auswählen</option>
            {props.snapshot.items.map(entry => <option key={entry.id} value={entry.id}>
              {entry.name}{entry.sku ? ` · ${entry.sku}` : ''}
            </option>)}
          </select>
        </Field>
        <Field label="Art der Meldung">
          <select className="ci-input" value={draft.reportType} onChange={event => patch('reportType', event.target.value as typeof draft.reportType)}>
            <option value="damage">Schaden</option>
            <option value="loss">Verlust</option>
            <option value="missing_return">Fehlende Rückgabe</option>
          </select>
        </Field>
        {draft.reportType === 'damage' && <Field label="Zustand">
          <select className="ci-input" value={draft.condition} onChange={event => patch('condition', event.target.value as InventoryCondition)}>
            <option value="damaged">Beschädigt</option>
            <option value="unusable">Nicht nutzbar</option>
          </select>
        </Field>}
        <Field label="Beschreibung" required wide error={submitted && !draft.description.trim() ? 'Bitte die Meldung beschreiben.' : undefined}>
          <textarea className="ci-input" value={draft.description} onChange={event => patch('description', event.target.value)} maxLength={5000} placeholder="Was wurde festgestellt? Wann und unter welchen Umständen?" />
        </Field>
      </div>
    </section>
    <p className="ci-note">Eine offene Ausgabe bleibt bestehen. Die Meldung ersetzt keine dokumentierte Rücknahme.</p>
  </EditorFrame>;
}

function ResolveDamageEditor({ report, ...props }: EditorProps & { report: InventoryDamageReport }) {
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  async function submit() {
    setSubmitted(true);
    if (!notes.trim()) return;
    if (await props.run(() => resolveCompanyInventoryDamage(props.scope, report.id, notes.trim(), report.description), 'Meldung wurde mit Klärungsvermerk abgeschlossen.')) props.onSaved();
  }
  const item = props.snapshot.items.find(entry => entry.id === report.itemId);
  return <EditorFrame {...props} title="Meldung abschließen" subtitle={item?.name ?? 'Inventarmeldung'} action="Klärung dokumentieren" dirty={Boolean(notes)} submit={submit}>
    <section className="ci-form-section">
      <h3>Vorliegende Meldung</h3>
      <p className="ci-note" style={{ whiteSpace: 'pre-line' }}>
        {report.description}
      </p>
      <Field label="Wie wurde der Fall geklärt?" required error={submitted && !notes.trim() ? 'Bitte die Klärung beschreiben.' : undefined}>
        <textarea className="ci-input" autoFocus value={notes} onChange={event => setNotes(event.target.value)} maxLength={5000} placeholder="Zum Beispiel: repariert, wiedergefunden oder weiterer Verbleib dokumentiert" />
      </Field>
    </section>
    <p className="ci-note">Damit wird diese Meldung abgeschlossen. Eine Rücknahme oder Änderung des Bestandsstatus erfassen Sie separat am Gegenstand.</p>
  </EditorFrame>;
}
