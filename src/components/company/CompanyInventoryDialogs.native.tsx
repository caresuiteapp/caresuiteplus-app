// Generated native presentation from src/components/company/CompanyInventoryDialogs.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {NativeLabel,NativeSpan,NativeSmall,NativeInput,NativeStrong,NativeSelect,NativeOption,NativeDiv,NativeButton,NativeStyle,NativeForm,NativeP,NativeFieldset,NativeSection,NativeH3,NativeTextarea,NativeWorkspaceStyleScope} from '@/components/layout/NativeWorkspaceElements.native';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { PlatformModal } from "../layout/platform/platformmodal.tsx";
import type { InventoryAssignment, InventoryCategory, InventoryCategoryGroup, InventoryCondition, InventoryItem, InventoryLocation, InventoryReturnCapture, InventoryDamageReport, } from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';
import { saveCompanyInventoryItem, saveCompanyInventoryCategory, saveCompanyInventoryLocation, issueCompanyInventoryItem, returnCompanyInventoryItem, reportCompanyInventoryDamage, resolveCompanyInventoryDamage, type CompanyInventoryResult, type CompanyInventoryScope, type CompanyInventorySnapshot, } from "../../lib/inventory/companyInventoryService.ts";
import { CONDITION_LABELS, EDITABLE_ITEM_STATUSES, INVENTORY_STATUS_LABELS, inventoryItemDraft, isAssignmentOpen, validateInventoryItemDraft, } from "./companyInventoryModel.ts";
import { companyInventoryCss } from "./companyInventoryCss.native.ts";
export type InventoryEditDialog = {
    kind: 'item';
    item?: InventoryItem;
} | {
    kind: 'category';
    category?: InventoryCategory;
} | {
    kind: 'location';
    location?: InventoryLocation;
} | {
    kind: 'issue';
    item: InventoryItem;
} | {
    kind: 'return';
    assignment: InventoryAssignment;
} | {
    kind: 'damage';
    item?: InventoryItem;
} | {
    kind: 'resolveDamage';
    report: InventoryDamageReport;
};
export type RunInventoryMutation = <T>(operation: () => Promise<CompanyInventoryResult<T>>, message: string) => Promise<boolean>;
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
    label: string;
    required?: boolean;
    error?: string;
    children: ReactNode;
    hint?: string;
    wide?: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeLabel className={`ci-field${wide ? ' ci-span-2' : ''}`}>
    <NativeSpan>
      {label}{required && <NativeSmall>Pflichtangabe</NativeSmall>}
    </NativeSpan>
    {children}
    {hint && <NativeSmall className="ci-note">
      {hint}
    </NativeSmall>}
    {error && <NativeSmall className="ci-field-error">
      {error}
    </NativeSmall>}
  </NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Toggle({ label, hint, value, onChange }: {
    label: string;
    hint: string;
    value: boolean;
    onChange: (value: boolean) => void;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeLabel className="ci-toggle">
    <NativeInput type="checkbox" checked={value} onChange={event => onChange(event.target.checked)}/>
    <NativeSpan>
      <NativeStrong>
        {label}
      </NativeStrong>
      <NativeSmall>
        {hint}
      </NativeSmall>
    </NativeSpan>
  </NativeLabel>}</NativeWorkspaceStyleScope>;
}
function Conditions({ value, onChange, excludeLost = false, disabled = false, invalid = false }: {
    value: InventoryCondition;
    onChange: (value: InventoryCondition) => void;
    excludeLost?: boolean;
    disabled?: boolean;
    invalid?: boolean;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<NativeSelect className="ci-input" value={value} disabled={disabled} aria-invalid={invalid} onChange={event => onChange(event.target.value as InventoryCondition)}>
    {Object.entries(CONDITION_LABELS).filter(([key]) => !excludeLost || key !== 'lost').map(([key, label]) => <NativeOption key={key} value={key}>
      {label}
    </NativeOption>)}
  </NativeSelect>}</NativeWorkspaceStyleScope>;
}
function EditorFrame({ title, subtitle, action, dirty, submit, children, ...props }: EditorProps & {
    title: string;
    subtitle: string;
    action: string;
    dirty: boolean;
    submit: () => Promise<void>;
    children: ReactNode;
}) {
    const formId = useId();
    const { onDirtyChange } = props;
    useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
    return <NativeWorkspaceStyleScope css={[companyInventoryCss, companyInventoryCss]}>{<PlatformModal visible surfaceScope="company" title={title} subtitle={subtitle} onClose={props.onClose} dismissOnBackdrop={!props.busy} maxWidth={850} minWidth={260} maxHeightRatio={0.93} bodyStyle={{ backgroundColor: '#f4f8fd', padding: 20 }} sheetStyle={{ backgroundColor: '#f4f8fd' }} footerContent={<NativeDiv className="ci-dialog ci-form-footer">
      <NativeDiv className="ci-footer-row">
        <NativeSpan aria-live="polite">
          {props.busy ? 'Änderung wird gespeichert …' : props.blocked ? 'Bestand muss neu geladen werden' : dirty ? 'Ungespeicherte Eingaben' : 'Inventar im Unternehmen'}
        </NativeSpan>
        <NativeDiv className="ci-actions">
          <NativeButton type="button" className="ci-button ci-button--quiet" disabled={props.busy} onClick={props.onClose}>Abbrechen</NativeButton>
          <NativeButton type="submit" form={formId} className="ci-button ci-button--primary" disabled={props.busy || props.blocked}>
            {props.busy ? 'Wird gespeichert …' : action}
          </NativeButton>
        </NativeDiv>
      </NativeDiv>
    </NativeDiv>}>
    <NativeStyle>
      {companyInventoryCss}
    </NativeStyle>
    <NativeForm id={formId} className="ci-dialog" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
      {props.error && <NativeDiv className="ci-banner ci-banner--error" role="alert">
        {props.error}
      </NativeDiv>}
      {props.blocked && <NativeDiv className="ci-banner ci-banner--info" role="status">
        <NativeDiv>
          <NativeStrong>Speicherstand prüfen</NativeStrong>
          <NativeP>Der Vorgang wurde möglicherweise bereits teilweise gespeichert. Laden Sie den Bestand neu und prüfen Sie ihn. Der bisherige Entwurf wird dabei geschlossen, um doppeltes Speichern zu vermeiden.</NativeP>
          <NativeDiv className="ci-actions">
            <NativeButton type="button" className="ci-button" disabled={props.busy} onClick={() => void props.onReload()}>Bestand neu laden und Entwurf schließen</NativeButton>
          </NativeDiv>
        </NativeDiv>
      </NativeDiv>}
      <NativeFieldset disabled={props.busy || props.blocked}>
        {children}
      </NativeFieldset>
    </NativeForm>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
}
export function CompanyInventoryEditor({ dialog, ...props }: EditorProps & {
    dialog: InventoryEditDialog;
}) {
    if (props.snapshot.scopeLimited && (dialog.kind === 'category' || dialog.kind === 'location' || (dialog.kind === 'item' && !dialog.item)))
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<PlatformModal visible surfaceScope="company" title="Zentrale Inventarverwaltung" onClose={props.onClose}>
    <NativeP>Neue Inventarposten, Kategorien und Lagerorte werden durch die zentrale Verwaltung gepflegt.</NativeP>
  </PlatformModal>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'item')
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<ItemEditor {...props} item={dialog.item}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'category')
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<CategoryEditor {...props} category={dialog.category}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'location')
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<LocationEditor {...props} location={dialog.location}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'issue')
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<IssueEditor {...props} item={dialog.item}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'resolveDamage')
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<ResolveDamageEditor {...props} report={dialog.report}/>}</NativeWorkspaceStyleScope>;
    if (dialog.kind === 'return')
        return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<ReturnEditor {...props} assignment={dialog.assignment}/>}</NativeWorkspaceStyleScope>;
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<DamageEditor {...props} item={dialog.item}/>}</NativeWorkspaceStyleScope>;
}
function ItemEditor({ item, ...props }: EditorProps & {
    item?: InventoryItem;
}) {
    const [initial] = useState(() => inventoryItemDraft(item));
    const [draft, setDraft] = useState(initial);
    const [submitted, setSubmitted] = useState(false);
    const errors = validateInventoryItemDraft(draft);
    const hasAssignment = props.snapshot.assignments.some(assignment => assignment.itemId === item?.id && isAssignmentOpen(assignment));
    const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
    const fieldError = (key: string) => submitted ? errors[key] : undefined;
    async function submit() {
        setSubmitted(true);
        if (Object.keys(errors).length)
            return;
        const input = {
            ...draft, id: item?.id, name: draft.name.trim(), expectedUpdatedAt: item?.updatedAt,
            locationId: draft.locationId || null, purchaseDate: draft.purchaseDate || null,
            warrantyUntil: draft.warrantyUntil || null,
            status: !hasAssignment && EDITABLE_ITEM_STATUSES.includes(draft.status) ? draft.status : undefined,
        };
        if (await props.run(() => saveCompanyInventoryItem(props.scope, input), item ? 'Inventar wurde aktualisiert.' : 'Inventar wurde angelegt.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title={item ? 'Inventar bearbeiten' : 'Inventar anlegen'} subtitle="Stammdaten, Aufbewahrung und Rückgabe" action={item ? 'Änderungen speichern' : 'Inventar anlegen'} dirty={JSON.stringify(draft) !== JSON.stringify(initial)} submit={submit}>
    <NativeSection className="ci-form-section">
      <NativeH3>Gegenstand & Kennzeichnung</NativeH3>
      <NativeP className="ci-note">Erfassen Sie jeden einzeln ausgegebenen Gegenstand als eigenen Bestandsposten.</NativeP>
      <NativeDiv className="ci-form-grid">
        <Field label="Bezeichnung" required wide error={fieldError('name')}>
          <NativeInput className="ci-input" autoFocus value={draft.name} aria-invalid={Boolean(fieldError('name'))} onChange={event => patch('name', event.target.value)} placeholder="Zum Beispiel: Diensttelefon Verwaltung" maxLength={200}/>
        </Field>
        <Field label="Kategorie" required error={fieldError('categoryId')}>
          <NativeSelect className="ci-input" value={draft.categoryId} aria-invalid={Boolean(fieldError('categoryId'))} onChange={event => {
            const category = props.snapshot.categories.find(entry => entry.id === event.target.value);
            setDraft(current => ({ ...current, categoryId: event.target.value, ...(!item && category ? { requiresReturnOnExit: category.requiresReturnOnExit, portalVisibleToEmployee: category.portalVisibleToEmployee } : {}) }));
        }}>
            <NativeOption value="">Kategorie auswählen</NativeOption>
            {props.snapshot.categories.map(category => <NativeOption key={category.id} value={category.id}>
              {category.label}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Field label="Inventarnummer / Kennung">
          <NativeInput className="ci-input" value={draft.sku} onChange={event => patch('sku', event.target.value)} maxLength={120}/>
        </Field>
        <Field label="Seriennummer">
          <NativeInput className="ci-input" value={draft.serialNumber} onChange={event => patch('serialNumber', event.target.value)} maxLength={160}/>
        </Field>
        <Field label="Barcode-Kennung" hint="Vorhandene Kennung als Text hinterlegen.">
          <NativeInput className="ci-input" value={draft.barcode} onChange={event => patch('barcode', event.target.value)} maxLength={160}/>
        </Field>
        <Field label="Hersteller">
          <NativeInput className="ci-input" value={draft.manufacturer} onChange={event => patch('manufacturer', event.target.value)} maxLength={160}/>
        </Field>
        <Field label="Modell">
          <NativeInput className="ci-input" value={draft.model} onChange={event => patch('model', event.target.value)} maxLength={160}/>
        </Field>
      </NativeDiv>
    </NativeSection>
    <NativeSection className="ci-form-section">
      <NativeH3>Aufbewahrung & Zustand</NativeH3>
      <NativeP className="ci-note">Lagerorte beschreiben die Aufbewahrung, zum Beispiel Gebäude und Raum.</NativeP>
      <NativeDiv className="ci-form-grid">
        <Field label="Lagerort">
          <NativeSelect className="ci-input" value={draft.locationId} onChange={event => patch('locationId', event.target.value)}>
            <NativeOption value="">Ohne festen Lagerort</NativeOption>
            {props.snapshot.locations.map(location => <NativeOption key={location.id} value={location.id}>
              {location.label}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Field label="Zustand" error={fieldError('condition')} hint={hasAssignment ? 'Bei einer offenen Ausgabe bitte Rücknahme oder Schadenmeldung verwenden.' : undefined}>
          <Conditions value={draft.condition} disabled={hasAssignment} invalid={Boolean(fieldError('condition'))} onChange={value => patch('condition', value)}/>
        </Field>
        <Field label="Bestandsstatus" hint={hasAssignment ? 'Bei einer offenen Ausgabe wird der Status durch Ausgabe und Rücknahme geführt.' : undefined}>
          <NativeSelect className="ci-input" value={draft.status} disabled={hasAssignment} onChange={event => patch('status', event.target.value as typeof draft.status)}>
            {!EDITABLE_ITEM_STATUSES.includes(draft.status) && <NativeOption value={draft.status}>
              {INVENTORY_STATUS_LABELS[draft.status]}
            </NativeOption>}
            {EDITABLE_ITEM_STATUSES.map(status => <NativeOption key={status} value={status}>
              {INVENTORY_STATUS_LABELS[status]}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Field label="Kaufdatum">
          <NativeInput className="ci-input" type="date" value={draft.purchaseDate} onChange={event => patch('purchaseDate', event.target.value)}/>
        </Field>
        <Field label="Garantie bis" error={fieldError('warrantyUntil')}>
          <NativeInput className="ci-input" type="date" value={draft.warrantyUntil} aria-invalid={Boolean(fieldError('warrantyUntil'))} onChange={event => patch('warrantyUntil', event.target.value)}/>
        </Field>
        <Field label="Hinweise" wide>
          <NativeTextarea className="ci-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={5000} placeholder="Zubehör, Aufbewahrung oder weitere Angaben"/>
        </Field>
      </NativeDiv>
    </NativeSection>
    <NativeSection className="ci-form-section">
      <NativeH3>Ausgabe & Rückgabe</NativeH3>
      <NativeP className="ci-note">Die Vorgaben gelten für neue Ausgaben. Bereits dokumentierte Ausgaben behalten ihre Angaben.</NativeP>
      <NativeDiv className="ci-form-grid">
        <Toggle label="Bei Austritt zurückgeben" hint="Für diesen Gegenstand ist eine Personalrückgabe vorgesehen." value={draft.requiresReturnOnExit} onChange={value => patch('requiresReturnOnExit', value)}/>
        <Toggle label="Im Mitarbeitendenportal anzeigen" hint="Die ausgegebene Ausstattung darf der betreffenden Person angezeigt werden." value={draft.portalVisibleToEmployee} onChange={value => patch('portalVisibleToEmployee', value)}/>
      </NativeDiv>
    </NativeSection>
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
function CategoryEditor({ category, ...props }: EditorProps & {
    category?: InventoryCategory;
}) {
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
        if (!draft.label.trim())
            return;
        if (await props.run(() => saveCompanyInventoryCategory(props.scope, { ...draft, label: draft.label.trim(), id: category?.id, expectedUpdatedAt: category?.updatedAt }), 'Kategorie wurde gespeichert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title={category ? 'Kategorie bearbeiten' : 'Kategorie anlegen'} subtitle="Bestand verständlich gruppieren" action="Kategorie speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <NativeSection className="ci-form-section">
      <NativeDiv className="ci-form-grid">
        <Field label="Bezeichnung" required error={submitted && !draft.label.trim() ? 'Bitte eine Bezeichnung eingeben.' : undefined}>
          <NativeInput autoFocus className="ci-input" value={draft.label} onChange={event => patch('label', event.target.value)} maxLength={160}/>
        </Field>
        <Field label="Gruppe" hint={category ? 'Die Gruppe bleibt für vorhandene Bestände unverändert.' : undefined}>
          <NativeSelect className="ci-input" value={draft.group} disabled={Boolean(category)} onChange={event => patch('group', event.target.value as InventoryCategoryGroup)}>
            {Object.entries(INVENTORY_CATEGORY_LABELS).map(([key, label]) => <NativeOption key={key} value={key}>
              {label}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Toggle label="Rückgabe bei Austritt vorsehen" hint="Wird beim Anlegen neuer Gegenstände als Vorschlag übernommen." value={draft.requiresReturnOnExit} onChange={value => patch('requiresReturnOnExit', value)}/>
        <Toggle label="Im Mitarbeitendenportal anzeigen" hint="Vorgabe für neue Gegenstände dieser Kategorie." value={draft.portalVisibleToEmployee} onChange={value => patch('portalVisibleToEmployee', value)}/>
      </NativeDiv>
    </NativeSection>
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
function LocationEditor({ location, ...props }: EditorProps & {
    location?: InventoryLocation;
}) {
    const [initial] = useState(() => ({ label: location?.label ?? '', building: location?.building ?? '', room: location?.room ?? '', notes: location?.notes ?? '' }));
    const [draft, setDraft] = useState(initial);
    const [submitted, setSubmitted] = useState(false);
    const patch = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
    async function submit() {
        setSubmitted(true);
        if (!draft.label.trim())
            return;
        if (await props.run(() => saveCompanyInventoryLocation(props.scope, { ...draft, label: draft.label.trim(), id: location?.id, expectedUpdatedAt: location?.updatedAt }), 'Lagerort wurde gespeichert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title={location ? 'Lagerort bearbeiten' : 'Lagerort anlegen'} subtitle="Aufbewahrung im Unternehmen" action="Lagerort speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <NativeSection className="ci-form-section">
      <NativeDiv className="ci-form-grid">
        <Field label="Bezeichnung" required wide error={submitted && !draft.label.trim() ? 'Bitte eine Bezeichnung eingeben.' : undefined}>
          <NativeInput autoFocus className="ci-input" value={draft.label} onChange={event => patch('label', event.target.value)} maxLength={160} placeholder="Zum Beispiel: Materiallager Hauptsitz"/>
        </Field>
        <Field label="Gebäude">
          <NativeInput className="ci-input" value={draft.building} onChange={event => patch('building', event.target.value)} maxLength={160}/>
        </Field>
        <Field label="Raum">
          <NativeInput className="ci-input" value={draft.room} onChange={event => patch('room', event.target.value)} maxLength={160}/>
        </Field>
        <Field label="Hinweise" wide>
          <NativeTextarea className="ci-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={5000}/>
        </Field>
      </NativeDiv>
    </NativeSection>
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
function IssueEditor({ item, ...props }: EditorProps & {
    item: InventoryItem;
}) {
    const [initial] = useState(() => ({ recipientEmployeeId: '', responsibleEmployeeId: '', expectedReturnAt: '', issueCondition: item.condition, issueNotes: '' }));
    const [draft, setDraft] = useState(initial);
    const [submitted, setSubmitted] = useState(false);
    const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => ({ ...current, [key]: value }));
    const employees = props.snapshot.employees.filter(employee => ['active', 'aktiv'].includes(employee.status));
    async function submit() {
        setSubmitted(true);
        if (!draft.recipientEmployeeId)
            return;
        if (await props.run(() => issueCompanyInventoryItem(props.scope, {
            ...draft, itemId: item.id, expectedUpdatedAt: item.updatedAt,
            responsibleEmployeeId: draft.responsibleEmployeeId || null,
            expectedReturnAt: draft.expectedReturnAt ? `${draft.expectedReturnAt}T23:59:59` : null,
        }), 'Ausgabe wurde dokumentiert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title="Inventar ausgeben" subtitle={item.name} action="Ausgabe dokumentieren" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    {!props.snapshot.employeesVisible || !employees.length ? <NativeDiv className="ci-banner ci-banner--info">
      {props.snapshot.employeesVisible ? 'Es ist keine auswählbare Person vorhanden. Legen Sie Mitarbeitende zunächst im Personalbereich an.' : 'Für die Ausgabe benötigen Sie Zugriff auf die Personalauswahl.'}
    </NativeDiv> : null}
    <NativeSection className="ci-form-section">
      <NativeH3>Empfang & Verantwortung</NativeH3>
      <NativeP className="ci-note">Der Bestandsposten wird einer Person zugeordnet.</NativeP>
      <NativeDiv className="ci-form-grid">
        <Field label="Empfänger:in" required error={submitted && !draft.recipientEmployeeId ? 'Bitte eine Person auswählen.' : undefined}>
          <NativeSelect className="ci-input" autoFocus value={draft.recipientEmployeeId} onChange={event => patch('recipientEmployeeId', event.target.value)}>
            <NativeOption value="">Person auswählen</NativeOption>
            {employees.map(employee => <NativeOption key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Field label="Weitere verantwortliche Person">
          <NativeSelect className="ci-input" value={draft.responsibleEmployeeId} onChange={event => patch('responsibleEmployeeId', event.target.value)}>
            <NativeOption value="">Keine zusätzliche Person</NativeOption>
            {employees.map(employee => <NativeOption key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Field label="Rückgabe spätestens am">
          <NativeInput type="date" className="ci-input" value={draft.expectedReturnAt} onChange={event => patch('expectedReturnAt', event.target.value)}/>
        </Field>
        <Field label="Zustand bei Ausgabe">
          <Conditions value={draft.issueCondition} onChange={value => patch('issueCondition', value)} excludeLost/>
        </Field>
        <Field label="Übergabehinweise" wide>
          <NativeTextarea className="ci-input" value={draft.issueNotes} onChange={event => patch('issueNotes', event.target.value)} placeholder="Zum Beispiel: ausgegebenes Zubehör, Hinweise zur Nutzung" maxLength={5000}/>
        </Field>
      </NativeDiv>
    </NativeSection>
    <NativeP className="ci-note">
      {item.requiresReturnOnExit ? 'Dieser Gegenstand ist bei einem Austritt zurückzugeben.' : 'Für diesen Gegenstand ist keine Rückgabe bei Austritt vorgemerkt.'}
    </NativeP>
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
type TriState = '' | 'yes' | 'no';
function TriStateField({ label, value, onChange, required = false, error }: {
    label: string;
    value: TriState;
    onChange: (value: TriState) => void;
    required?: boolean;
    error?: string;
}) {
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<Field label={label} required={required} error={error}>
    <NativeSelect className="ci-input" value={value} aria-invalid={Boolean(error)} onChange={event => onChange(event.target.value as TriState)}>
      <NativeOption value="">
        {required ? 'Bitte auswählen' : 'Nicht geprüft / nicht zutreffend'}
      </NativeOption>
      <NativeOption value="yes">Ja</NativeOption>
      <NativeOption value="no">Nein</NativeOption>
    </NativeSelect>
  </Field>}</NativeWorkspaceStyleScope>;
}
function ReturnEditor({ assignment, ...props }: EditorProps & {
    assignment: InventoryAssignment;
}) {
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
        if (!draft.returned || (draft.returned === 'yes' && !draft.complete) || (damaged && !draft.damageDescription.trim()) || incompleteAccessories || missingExplanation)
            return;
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
        }), 'Rücknahme wurde dokumentiert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title="Rücknahme erfassen" subtitle={item?.name ?? 'Zugewiesenes Inventar'} action="Rücknahme dokumentieren" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <NativeSection className="ci-form-section">
      <NativeH3>Tatsächlicher Rückgabestand</NativeH3>
      <NativeP className="ci-note">Bestätigen Sie nur, was bei der Rücknahme tatsächlich geprüft wurde.</NativeP>
      <NativeDiv className="ci-form-grid">
        <TriStateField label="Gegenstand zurückgegeben?" required value={draft.returned} onChange={value => patch('returned', value)} error={requiredError(draft.returned)}/>
        {draft.returned === 'yes' && <>
          <TriStateField label="Rückgabe vollständig?" required value={draft.complete} onChange={value => patch('complete', value)} error={requiredError(draft.complete) ?? (submitted && incompleteAccessories ? 'Fehlendes Zubehör: Bitte die Rückgabe als unvollständig erfassen.' : undefined)}/>
          <Field label="Zustand bei Rücknahme">
            <Conditions value={draft.condition} onChange={value => patch('condition', value)} excludeLost/>
          </Field>
          <TriStateField label="Zubehör vollständig?" value={draft.accessoriesComplete} onChange={value => patch('accessoriesComplete', value)}/>
        </>}
        {draft.returned === 'no' && <NativeP className="ci-note ci-span-2">Die Ausgabe bleibt zur Klärung offen. Die Person wird damit nicht von der Rückgabe entlastet.</NativeP>}
        {damaged && <Field label="Schaden / Abweichung" wide required error={submitted && !draft.damageDescription.trim() ? 'Bitte die Abweichung beschreiben.' : undefined}>
          <NativeTextarea className="ci-input" value={draft.damageDescription} onChange={event => patch('damageDescription', event.target.value)} maxLength={5000}/>
        </Field>}
        <Field label="Hinweise zur Rücknahme" wide required={draft.returned === 'no'} error={submitted && missingExplanation ? 'Bitte die fehlende Rückgabe beschreiben.' : undefined}>
          <NativeTextarea className="ci-input" value={draft.notes} onChange={event => patch('notes', event.target.value)} maxLength={5000} placeholder="Fehlende Teile, vereinbarte Nachreichung oder ungeklärte Angaben"/>
        </Field>
      </NativeDiv>
    </NativeSection>
    {digital && draft.returned === 'yes' && <NativeSection className="ci-form-section">
      <NativeH3>Prüfung des Geräts</NativeH3>
      <NativeP className="ci-note">Diese Angaben dokumentieren Ihre Prüfung. Es werden keine Geräteaktionen ausgeführt.</NativeP>
      <NativeDiv className="ci-form-grid">
        <TriStateField label="Ladegerät zurückgegeben?" value={draft.chargerReturned} onChange={value => patch('chargerReturned', value)}/>
        <TriStateField label="SIM-Karte entfernt?" value={draft.simRemoved} onChange={value => patch('simRemoved', value)}/>
        <TriStateField label="Gerät zurückgesetzt?" value={draft.deviceReset} onChange={value => patch('deviceReset', value)}/>
        <TriStateField label="Daten gelöscht?" value={draft.dataDeleted} onChange={value => patch('dataDeleted', value)}/>
      </NativeDiv>
    </NativeSection>}
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
function DamageEditor({ item, ...props }: EditorProps & {
    item?: InventoryItem;
}) {
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
        if (!draft.itemId || !draft.description.trim())
            return;
        if (await props.run(() => reportCompanyInventoryDamage(props.scope, {
            ...draft, description: draft.description.trim(), assignmentId: activeAssignment?.id,
            expectedUpdatedAt: props.snapshot.items.find(entry => entry.id === draft.itemId)?.updatedAt,
            condition: draft.reportType === 'loss' ? 'lost' : draft.reportType === 'missing_return' ? props.snapshot.items.find(entry => entry.id === draft.itemId)?.condition ?? 'unknown' : draft.condition,
        }), 'Meldung wurde dokumentiert.'))
            props.onSaved();
    }
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title="Schaden oder Verlust melden" subtitle="Abweichungen am Inventar nachvollziehbar erfassen" action="Meldung speichern" dirty={JSON.stringify(initial) !== JSON.stringify(draft)} submit={submit}>
    <NativeSection className="ci-form-section">
      <NativeDiv className="ci-form-grid">
        <Field label="Gegenstand" required wide error={submitted && !draft.itemId ? 'Bitte einen Gegenstand auswählen.' : undefined}>
          <NativeSelect autoFocus className="ci-input" value={draft.itemId} disabled={Boolean(item)} onChange={event => patch('itemId', event.target.value)}>
            <NativeOption value="">Gegenstand auswählen</NativeOption>
            {props.snapshot.items.map(entry => <NativeOption key={entry.id} value={entry.id}>
              {entry.name}{entry.sku ? ` · ${entry.sku}` : ''}
            </NativeOption>)}
          </NativeSelect>
        </Field>
        <Field label="Art der Meldung">
          <NativeSelect className="ci-input" value={draft.reportType} onChange={event => patch('reportType', event.target.value as typeof draft.reportType)}>
            <NativeOption value="damage">Schaden</NativeOption>
            <NativeOption value="loss">Verlust</NativeOption>
            <NativeOption value="missing_return">Fehlende Rückgabe</NativeOption>
          </NativeSelect>
        </Field>
        {draft.reportType === 'damage' && <Field label="Zustand">
          <NativeSelect className="ci-input" value={draft.condition} onChange={event => patch('condition', event.target.value as InventoryCondition)}>
            <NativeOption value="damaged">Beschädigt</NativeOption>
            <NativeOption value="unusable">Nicht nutzbar</NativeOption>
          </NativeSelect>
        </Field>}
        <Field label="Beschreibung" required wide error={submitted && !draft.description.trim() ? 'Bitte die Meldung beschreiben.' : undefined}>
          <NativeTextarea className="ci-input" value={draft.description} onChange={event => patch('description', event.target.value)} maxLength={5000} placeholder="Was wurde festgestellt? Wann und unter welchen Umständen?"/>
        </Field>
      </NativeDiv>
    </NativeSection>
    <NativeP className="ci-note">Eine offene Ausgabe bleibt bestehen. Die Meldung ersetzt keine dokumentierte Rücknahme.</NativeP>
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
function ResolveDamageEditor({ report, ...props }: EditorProps & {
    report: InventoryDamageReport;
}) {
    const [notes, setNotes] = useState('');
    const [submitted, setSubmitted] = useState(false);
    async function submit() {
        setSubmitted(true);
        if (!notes.trim())
            return;
        if (await props.run(() => resolveCompanyInventoryDamage(props.scope, report.id, notes.trim(), report.description), 'Meldung wurde mit Klärungsvermerk abgeschlossen.'))
            props.onSaved();
    }
    const item = props.snapshot.items.find(entry => entry.id === report.itemId);
    return <NativeWorkspaceStyleScope css={[companyInventoryCss]}>{<EditorFrame {...props} title="Meldung abschließen" subtitle={item?.name ?? 'Inventarmeldung'} action="Klärung dokumentieren" dirty={Boolean(notes)} submit={submit}>
    <NativeSection className="ci-form-section">
      <NativeH3>Vorliegende Meldung</NativeH3>
      <NativeP className="ci-note" style={{ whiteSpace: 'pre-line' }}>
        {report.description}
      </NativeP>
      <Field label="Wie wurde der Fall geklärt?" required error={submitted && !notes.trim() ? 'Bitte die Klärung beschreiben.' : undefined}>
        <NativeTextarea className="ci-input" autoFocus value={notes} onChange={event => setNotes(event.target.value)} maxLength={5000} placeholder="Zum Beispiel: repariert, wiedergefunden oder weiterer Verbleib dokumentiert"/>
      </Field>
    </NativeSection>
    <NativeP className="ci-note">Damit wird diese Meldung abgeschlossen. Eine Rücknahme oder Änderung des Bestandsstatus erfassen Sie separat am Gegenstand.</NativeP>
  </EditorFrame>}</NativeWorkspaceStyleScope>;
}
