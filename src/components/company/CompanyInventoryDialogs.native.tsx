import { useState, type ReactNode } from 'react';
import { Alert, Text, View } from 'react-native';
import { MobileButton, MobileField, MobileSheet, m } from '@/components/mobile/MobileWorkspace';
import { MobileSelect } from '@/components/mobile/MobileSelect';
import type {
  InventoryAssignment, InventoryCategory, InventoryCategoryGroup, InventoryCondition,
  InventoryItem, InventoryLocation, InventoryReturnCapture, InventoryDamageReport,
} from '@/types/inventory';
import { INVENTORY_CATEGORY_LABELS } from '@/types/inventory';
import {
  saveCompanyInventoryItem, saveCompanyInventoryCategory, saveCompanyInventoryLocation,
  issueCompanyInventoryItem, returnCompanyInventoryItem, reportCompanyInventoryDamage, resolveCompanyInventoryDamage,
  type CompanyInventoryResult, type CompanyInventoryScope, type CompanyInventorySnapshot,
} from '@/lib/inventory/companyInventoryService';
import {
  CONDITION_LABELS, EDITABLE_ITEM_STATUSES, INVENTORY_STATUS_LABELS,
  inventoryItemDraft, isAssignmentOpen, validateInventoryItemDraft,
} from './companyInventoryModel';

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


type TriState = '' | 'yes' | 'no';
function EditorFrame({ title, dirty, submit, children, ...props }: EditorProps & { title: string; dirty: boolean; submit: () => Promise<void>; children: ReactNode }) {
  const close = () => { if (props.busy) return; if (!dirty) props.onClose(); else Alert.alert('Änderungen verwerfen?', 'Ihre Eingaben sind noch nicht gespeichert.', [{ text: 'Weiter bearbeiten', style: 'cancel' }, { text: 'Verwerfen', style: 'destructive', onPress: props.onClose }]); };
  return <MobileSheet visible title={title} onClose={close} footer={<>{props.error ? <Text accessibilityRole="alert" style={m.error}>{props.error}</Text> : null}<View style={m.wrap}><MobileButton primary label="Speichern" busy={props.busy} disabled={props.blocked} onPress={() => void submit()} /><MobileButton label="Abbrechen" disabled={props.busy} onPress={close} />{props.blocked ? <MobileButton label="Bestand neu laden und Entwurf schließen" disabled={props.busy} onPress={() => void props.onReload()} /> : null}</View></>}>{children}</MobileSheet>;
}
type Field<T> = { key: keyof T; label: string; options?: Record<string,string>; disabled?: boolean; multiline?: boolean; required?: boolean; hint?: string };
function Fields<T extends Record<string, string | boolean>>({ draft, patch, fields, disabled, errors = {} }: { draft: T; patch: <K extends keyof T>(key: K, value: T[K]) => void; fields: Field<T>[]; disabled: boolean; errors?: Record<string,string|undefined> }) {
  return <>{fields.map(field => <View key={String(field.key)} style={m.field}>{typeof draft[field.key] === 'boolean' ? <MobileButton label={field.label} selected={!!draft[field.key]} disabled={disabled || field.disabled} onPress={() => patch(field.key, !draft[field.key] as T[keyof T])} /> : field.options ? <MobileSelect label={field.label} value={String(draft[field.key])} options={field.options} disabled={disabled || field.disabled} onChange={value => { if (value || !field.required) patch(field.key, value as T[keyof T]); }} /> : <MobileField label={field.label} value={String(draft[field.key])} multiline={field.multiline} editable={!disabled && !field.disabled} onChangeText={value => patch(field.key, value as T[keyof T])} />}{field.hint ? <Text style={m.muted}>{field.hint}</Text> : null}{errors[String(field.key)] ? <Text style={m.error}>{errors[String(field.key)]}</Text> : null}</View>)}</>;
}
export function CompanyInventoryEditor({ dialog, ...props }: EditorProps & { dialog: InventoryEditDialog }) {
 if (dialog.kind === 'item') return <ItemEditor {...props} item={dialog.item} />;
 if (dialog.kind === 'category') return <CategoryEditor {...props} category={dialog.category} />;
 if (dialog.kind === 'location') return <LocationEditor {...props} location={dialog.location} />;
 if (dialog.kind === 'issue') return <IssueEditor {...props} item={dialog.item} />;
 if (dialog.kind === 'return') return <ReturnEditor {...props} assignment={dialog.assignment} />;
 if (dialog.kind === 'resolveDamage') return <ResolveDamageEditor {...props} report={dialog.report} />;
 return <DamageEditor {...props} item={dialog.item} />;
}
function ItemEditor({ item, ...props }: EditorProps & { item?: InventoryItem }) {
  const [initial] = useState(() => inventoryItemDraft(item));
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateInventoryItemDraft(draft);
  const hasAssignment = props.snapshot.assignments.some(assignment => assignment.itemId === item?.id && isAssignmentOpen(assignment));
  const patch = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft(current => { const category = !item && key === 'categoryId' ? props.snapshot.categories.find(row => row.id === value) : null; return { ...current, [key]: value, ...(category ? { requiresReturnOnExit: category.requiresReturnOnExit, portalVisibleToEmployee: category.portalVisibleToEmployee } : {}) }; });
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
  return <EditorFrame {...props} title={item ? 'Inventar bearbeiten' : 'Inventar anlegen'} dirty={JSON.stringify(initial)!==JSON.stringify(draft)} submit={submit}><Fields draft={draft} patch={patch} fields={[
 {key:'name',label:'Bezeichnung *'}, {key:'categoryId',label:'Kategorie *',required:true,options:Object.fromEntries(props.snapshot.categories.map(row=>[row.id,row.label]))},
 {key:'sku',label:'Inventarnummer'}, {key:'serialNumber',label:'Seriennummer'}, {key:'barcode',label:'Barcode-Kennung'}, {key:'manufacturer',label:'Hersteller'}, {key:'model',label:'Modell'},
 {key:'locationId',label:'Lagerort',options:Object.fromEntries(props.snapshot.locations.map(row=>[row.id,row.label]))},
 {key:'condition',label:'Zustand',options:CONDITION_LABELS,disabled:hasAssignment,required:true},
 {key:'status',label:'Bestandsstatus',options:Object.fromEntries(EDITABLE_ITEM_STATUSES.map(key=>[key,INVENTORY_STATUS_LABELS[key]])),disabled:hasAssignment,required:true},
 {key:'purchaseDate',label:'Kaufdatum',hint:'JJJJ-MM-TT'}, {key:'warrantyUntil',label:'Garantie bis',hint:'JJJJ-MM-TT'}, {key:'notes',label:'Hinweise',multiline:true},
 {key:'requiresReturnOnExit',label:'Bei Austritt zurückgeben'}, {key:'portalVisibleToEmployee',label:'Im Mitarbeitendenportal anzeigen'}]} disabled={props.busy||props.blocked} errors={submitted ? errors : {}} /></EditorFrame>;
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
  return <EditorFrame {...props} title={category ? 'Kategorie bearbeiten' : 'Kategorie anlegen'} dirty={JSON.stringify(initial)!==JSON.stringify(draft)} submit={submit}><Fields draft={draft} patch={patch} fields={[{key:'label',label:'Bezeichnung *'},{key:'group',label:'Gruppe',options:INVENTORY_CATEGORY_LABELS,disabled:!!category,required:true},{key:'requiresReturnOnExit',label:'Rückgabe bei Austritt vorsehen'},{key:'portalVisibleToEmployee',label:'Im Mitarbeitendenportal anzeigen'}]} disabled={props.busy||props.blocked} errors={submitted && !draft.label.trim() ? {label:'Bitte eine Bezeichnung eingeben.'} : {}} /></EditorFrame>;
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
  return <EditorFrame {...props} title={location ? 'Lagerort bearbeiten' : 'Lagerort anlegen'} dirty={JSON.stringify(initial)!==JSON.stringify(draft)} submit={submit}><Fields draft={draft} patch={patch} fields={[{key:'label',label:'Bezeichnung *'},{key:'building',label:'Gebäude'},{key:'room',label:'Raum'},{key:'notes',label:'Hinweise',multiline:true}]} disabled={props.busy||props.blocked} errors={submitted && !draft.label.trim() ? {label:'Bitte eine Bezeichnung eingeben.'} : {}} /></EditorFrame>;
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
  return <EditorFrame {...props} title={'Inventar ausgeben'} dirty={JSON.stringify(initial)!==JSON.stringify(draft)} submit={submit}><Fields draft={draft} patch={patch} fields={[{key:'recipientEmployeeId',label:'Empfänger:in *',options:Object.fromEntries(employees.map(row=>[row.id,`${row.firstName} ${row.lastName}`])),required:true},{key:'responsibleEmployeeId',label:'Weitere verantwortliche Person',options:Object.fromEntries(employees.map(row=>[row.id,`${row.firstName} ${row.lastName}`]))},{key:'expectedReturnAt',label:'Rückgabe spätestens am',hint:'JJJJ-MM-TT'},{key:'issueCondition',label:'Zustand bei Ausgabe',options:Object.fromEntries(Object.entries(CONDITION_LABELS).filter(([key])=>key!=='lost')),required:true},{key:'issueNotes',label:'Übergabehinweise',multiline:true}]} disabled={props.busy||props.blocked} errors={submitted && !draft.recipientEmployeeId ? {recipientEmployeeId:'Bitte eine Person auswählen.'} : {}} /></EditorFrame>;
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
  return <EditorFrame {...props} title={'Rücknahme dokumentieren'} dirty={JSON.stringify(initial)!==JSON.stringify(draft)} submit={submit}><Fields draft={draft} patch={patch} fields={[{key:'returned',label:'Gegenstand zurückgegeben? *',options:{yes:'Ja',no:'Nein'},required:true},...(draft.returned==='yes' ? [
 {key:'complete' as const,label:'Vollständig zurückgegeben? *',options:{yes:'Ja',no:'Nein'},required:true}, {key:'condition' as const,label:'Tatsächlicher Zustand',options:CONDITION_LABELS,required:true}, {key:'accessoriesComplete' as const,label:'Zubehör vollständig?',options:{yes:'Ja',no:'Nein'}},
 ...(digital ? [{key:'chargerReturned' as const,label:'Ladegerät zurückgegeben?',options:{yes:'Ja',no:'Nein'}},{key:'simRemoved' as const,label:'SIM entfernt?',options:{yes:'Ja',no:'Nein'}},{key:'deviceReset' as const,label:'Gerät zurückgesetzt?',options:{yes:'Ja',no:'Nein'}},{key:'dataDeleted' as const,label:'Daten gelöscht?',options:{yes:'Ja',no:'Nein'}}] : []),
 ...(damaged ? [{key:'damageDescription' as const,label:'Schaden beschreiben *',multiline:true}] : [])] : []), {key:'notes',label:'Hinweise / fehlende Rückgabe begründen',multiline:true}]} disabled={props.busy||props.blocked} errors={submitted ? {returned:requiredError(draft.returned),complete:draft.returned==='yes'?requiredError(draft.complete):undefined,damageDescription:damaged&&!draft.damageDescription.trim()?'Bitte den Schaden beschreiben.':undefined,accessoriesComplete:incompleteAccessories?'Fehlendes Zubehör widerspricht einer vollständigen Rückgabe.':undefined,notes:missingExplanation?'Bitte die fehlende Rückgabe begründen.':undefined} : {}} /></EditorFrame>;
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
  return <EditorFrame {...props} title={'Schaden oder Verlust melden'} dirty={JSON.stringify(initial)!==JSON.stringify(draft)} submit={submit}><Fields draft={draft} patch={patch} fields={[{key:'itemId',label:'Gegenstand *',options:Object.fromEntries(props.snapshot.items.map(row=>[row.id,row.name])),disabled:!!item,required:true},{key:'reportType',label:'Meldungsart',options:{damage:'Schaden',loss:'Verlust',missing_return:'Fehlende Rückgabe'},required:true},{key:'description',label:'Beschreibung *',multiline:true},{key:'condition',label:'Zustand',options:CONDITION_LABELS,disabled:draft.reportType!=='damage',required:true}]} disabled={props.busy||props.blocked} errors={submitted ? {itemId:!draft.itemId?'Bitte einen Gegenstand auswählen.':undefined,description:!draft.description.trim()?'Bitte den Vorfall beschreiben.':undefined} : {}} /></EditorFrame>;
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
  return <EditorFrame {...props} title="Meldung abschließen" dirty={!!notes.trim()} submit={submit}><Text style={m.body}>{item?.name} · {report.description}</Text><MobileField label="Klärungsvermerk *" multiline value={notes} editable={!props.busy&&!props.blocked} onChangeText={setNotes} />{submitted&&!notes.trim()?<Text style={m.error}>Bitte den Abschluss begründen.</Text>:null}</EditorFrame>;
}
