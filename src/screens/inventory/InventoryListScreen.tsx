import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { demoEmployees } from '@/data/demo/employees';
import {
  createInventoryItem,
  fetchInventoryAssignments,
  fetchInventoryAuditEvents,
  fetchInventoryCategories,
  fetchInventoryDamageReports,
  fetchInventoryItems,
  fetchInventoryLocations,
  fetchInventoryReturnProtocols,
  fetchInventoryReturnRecords,
  issueInventoryItem,
  recordInventoryReturn,
  reportInventoryDamageOrLoss,
  INVENTORY_CATEGORY_LABELS,
} from '@/lib/inventory';
import type { InventoryAssignment, InventoryCategory, InventoryCondition, InventoryDamageReport, InventoryItem, InventoryLocation } from '@/types/inventory';
import type { InventoryListScreenProps } from './inventoryListConfig';

const ITEM_STATUS: Record<string, string> = { available: 'Verfügbar', assigned: 'Ausgegeben', in_use: 'In Benutzung', reserved: 'Reserviert', maintenance: 'In Wartung', damaged: 'Beschädigt', lost: 'Verloren', returned: 'Zurückgegeben', decommissioned: 'Ausgemustert', archived: 'Archiviert' };
const ASSIGNMENT_STATUS: Record<string, string> = { planned: 'Geplant', issued: 'Ausgegeben', acknowledged: 'Bestätigt', return_requested: 'Rückgabe angefordert', partially_returned: 'Teilweise zurückgegeben', returned: 'Zurückgegeben', overdue: 'Überfällig', damaged_returned: 'Beschädigt zurück', lost: 'Verloren', disputed: 'Klärungsbedarf', archived: 'Archiviert' };
const CONDITION: Record<string, string> = { new: 'Neu', very_good: 'Sehr gut', good: 'Gut', used: 'Gebraucht', damaged: 'Beschädigt', unusable: 'Nicht nutzbar', lost: 'Verloren', unknown: 'Unbekannt' };
const TITLES: Record<InventoryListScreenProps['variant'], { title: string; subtitle: string }> = {
  items: { title: 'Inventarbestand', subtitle: 'Posten erfassen, finden und verwalten' }, assignments: { title: 'Ausgaben', subtitle: 'Ausstattung zuordnen und Verantwortlichkeiten dokumentieren' },
  returns: { title: 'Rücknahmen', subtitle: 'Rückgaben prüfen und vollständig abschließen' }, damage: { title: 'Schaden & Verlust', subtitle: 'Vorfälle dokumentieren und offene Fälle nachhalten' },
  categories: { title: 'Inventarkategorien', subtitle: 'Regeln für Rückgabe, Portal und Kennzeichnung' }, locations: { title: 'Lagerorte', subtitle: 'Standorte und Räume des Bestands' },
  protocols: { title: 'Rückgabeprotokolle', subtitle: 'Nachvollziehbare Abschlussdokumentation' }, audit: { title: 'Inventar-Audit', subtitle: 'Lückenlose Änderungshistorie' },
  employees: { title: 'Personalausstattung', subtitle: 'Aktive Ausgaben nach Mitarbeitenden' }, offboarding: { title: 'Offboarding-Check', subtitle: 'Offene Rückgaben vor Austritt' },
  mdm: { title: 'Geräteverwaltung', subtitle: 'Technischer Gerätestatus' }, barcode: { title: 'Barcode & QR', subtitle: 'Kennzeichnungen erfassen und prüfen' }, settings: { title: 'Inventar-Einstellungen', subtitle: 'Regeln und Vorgaben' },
};

type EditorMode = 'create' | 'issue' | 'return' | 'damage' | null;
type InventoryData = { items: InventoryItem[]; assignments: InventoryAssignment[]; categories: InventoryCategory[]; locations: InventoryLocation[]; damage: InventoryDamageReport[]; returns: Record<string, unknown>[]; protocols: Record<string, unknown>[]; audit: Record<string, unknown>[] };

export function InventoryListScreen({
  variant,
  categoryGroupFilter,
  titleOverride,
  subtitleOverride,
  backRoute = '/business/office/inventory',
}: InventoryListScreenProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const { c } = useCareLightPalette();
  const styles = useMemo(() => createStyles(c), [c]);
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const roleKey = profile?.roleKey ?? null;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editor, setEditor] = useState<EditorMode>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [condition, setCondition] = useState<InventoryCondition>('good');
  const [reportType, setReportType] = useState<InventoryDamageReport['reportType']>('damage');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const query = useAsyncQuery(async (): Promise<{ ok: true; data: InventoryData } | { ok: false; error: string }> => {
    if (!tenantId) return { ok: false, error: 'Kein Mandant.' };
    const results = await Promise.all([
      fetchInventoryItems(tenantId, roleKey), fetchInventoryAssignments(tenantId, roleKey), fetchInventoryCategories(tenantId, roleKey),
      fetchInventoryLocations(tenantId, roleKey), fetchInventoryDamageReports(tenantId, roleKey), fetchInventoryReturnRecords(tenantId, roleKey),
      fetchInventoryReturnProtocols(tenantId, roleKey), fetchInventoryAuditEvents(tenantId, roleKey),
    ]);
    const failed = results.find((result) => !result.ok);
    if (failed && !failed.ok) return { ok: false, error: failed.error };
    return { ok: true, data: {
      items: results[0].ok ? results[0].data : [], assignments: results[1].ok ? results[1].data : [], categories: results[2].ok ? results[2].data : [],
      locations: results[3].ok ? results[3].data : [], damage: results[4].ok ? results[4].data : [], returns: results[5].ok ? results[5].data as unknown as Record<string, unknown>[] : [],
      protocols: results[6].ok ? results[6].data as unknown as Record<string, unknown>[] : [], audit: results[7].ok ? results[7].data as unknown as Record<string, unknown>[] : [],
    } };
  }, [tenantId, roleKey]);

  const data = query.data ?? { items: [], assignments: [], categories: [], locations: [], damage: [], returns: [], protocols: [], audit: [] };
  const itemMap = new Map(data.items.map((item) => [item.id, item]));
  const employeeName = (id: string | null | undefined) => {
    if (!id) return 'Nicht zugeordnet';
    const employee = demoEmployees.find((entry) => entry.id === id);
    return employee ? `${employee.firstName} ${employee.lastName}` : id;
  };
  const openAssignments = data.assignments.filter((entry) => !['returned', 'archived', 'lost'].includes(entry.status));
  const searchLower = search.trim().toLowerCase();
  const matches = (...values: unknown[]) => !searchLower || values.some((value) => String(value ?? '').toLowerCase().includes(searchLower));
  const visibleCategories = categoryGroupFilter
    ? data.categories.filter((entry) => entry.group === categoryGroupFilter)
    : data.categories;
  const visibleItems = categoryGroupFilter
    ? data.items.filter((item) => item.categoryGroup === categoryGroupFilter)
    : data.items;
  const filteredItems = visibleItems.filter((item) => (statusFilter === 'all' || item.status === statusFilter) && matches(item.name, item.serialNumber, item.barcode, item.manufacturer, item.model, INVENTORY_CATEGORY_LABELS[item.categoryGroup]));
  const filteredAssignments = openAssignments.filter((entry) => (statusFilter === 'all' || entry.status === statusFilter) && matches(itemMap.get(entry.itemId)?.name, employeeName(entry.recipientEmployeeId), entry.status));
  const filteredDamage = data.damage.filter((entry) => (statusFilter === 'all' || (statusFilter === 'open' ? !entry.resolvedAt : Boolean(entry.resolvedAt))) && matches(itemMap.get(entry.itemId)?.name, entry.description, entry.reportType));
  const title = {
    title: titleOverride ?? TITLES[variant].title,
    subtitle: subtitleOverride ?? TITLES[variant].subtitle,
  };

  function resetEditor() { setEditor(null); setSelectedItemId(''); setSelectedAssignmentId(''); setSelectedEmployeeId(''); setName(''); setCategoryId(''); setSerialNumber(''); setNotes(''); setCondition('good'); setReportType('damage'); }
  async function save() {
    if (!tenantId || !editor) return;
    if (editor === 'create' && (!name.trim() || !categoryId)) { setFeedback({ kind: 'error', text: 'Bezeichnung und Kategorie sind erforderlich.' }); return; }
    if (editor === 'issue' && (!selectedItemId || !selectedEmployeeId)) { setFeedback({ kind: 'error', text: 'Inventarposten und Empfänger:in sind erforderlich.' }); return; }
    if (editor === 'return' && !selectedAssignmentId) { setFeedback({ kind: 'error', text: 'Keine Ausgabe für die Rücknahme ausgewählt.' }); return; }
    if (editor === 'damage' && (!selectedItemId || !notes.trim())) { setFeedback({ kind: 'error', text: 'Inventarposten und Beschreibung sind erforderlich.' }); return; }
    setSaving(true); setFeedback(null);
    try {
      let result: { ok: boolean; error?: string };
      if (editor === 'create') result = await createInventoryItem(tenantId, { name, categoryId, serialNumber: serialNumber.trim() || null, condition, notes: notes.trim() || null }, roleKey);
      else if (editor === 'issue') result = await issueInventoryItem(tenantId, { itemId: selectedItemId, recipientEmployeeId: selectedEmployeeId, responsibleEmployeeId: selectedEmployeeId, issueCondition: itemMap.get(selectedItemId)?.condition ?? 'good', issueNotes: notes.trim() || null, issuedByProfileId: profile?.id ?? null }, roleKey);
      else if (editor === 'return') result = await recordInventoryReturn(tenantId, { assignmentId: selectedAssignmentId, capture: { returned: true, complete: true, condition, notes: notes.trim() || null, accessoriesComplete: true } }, roleKey, profile?.id ?? null);
      else result = await reportInventoryDamageOrLoss(tenantId, { itemId: selectedItemId, reportType, description: notes, condition: reportType === 'loss' ? 'lost' : 'damaged' }, roleKey, profile?.id ?? null);
      if (!result.ok) { setFeedback({ kind: 'error', text: result.error ?? 'Vorgang konnte nicht gespeichert werden.' }); return; }
      setFeedback({ kind: 'ok', text: editor === 'create' ? 'Inventarposten angelegt.' : editor === 'issue' ? 'Ausgabe dokumentiert.' : editor === 'return' ? 'Rücknahme abgeschlossen.' : 'Vorfall dokumentiert.' });
      resetEditor(); query.refresh();
    } finally { setSaving(false); }
  }

  if (query.loading && !query.data) return <ScreenShell title={title.title} subtitle={title.subtitle}><LoadingState message="Inventardaten werden geladen…" /></ScreenShell>;
  if (query.error && !query.data) return <ScreenShell title={title.title} subtitle={title.subtitle}><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;

  const mainAction = variant === 'items' ? { label: '+ Inventarposten', mode: 'create' as EditorMode } : variant === 'assignments' ? { label: '+ Ausgabe starten', mode: 'issue' as EditorMode } : variant === 'returns' ? null : variant === 'damage' ? { label: '+ Schaden / Verlust', mode: 'damage' as EditorMode } : null;
  const filterOptions = variant === 'items' ? [['all', 'Alle'], ['available', 'Verfügbar'], ['assigned', 'Ausgegeben'], ['maintenance', 'Wartung'], ['damaged', 'Beschädigt']] : variant === 'damage' ? [['all', 'Alle'], ['open', 'Offen'], ['closed', 'Erledigt']] : [['all', 'Alle'], ['issued', 'Ausgegeben'], ['return_requested', 'Rückgabe angefordert'], ['overdue', 'Überfällig']];

  return (
    <ScreenShell title={title.title} subtitle={title.subtitle}>
      <View style={styles.toolbar}>
        <TextInput accessibilityLabel="Inventar durchsuchen" value={search} onChangeText={setSearch} placeholder="Bezeichnung, Seriennummer, Person oder Status suchen" placeholderTextColor={c.muted} style={styles.search} />
        <Pressable onPress={query.refresh} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>↻ Aktualisieren</Text></Pressable>
        {mainAction ? <Pressable onPress={() => setEditor(mainAction.mode)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{mainAction.label}</Text></Pressable> : null}
      </View>
      {feedback ? <View style={[styles.feedback, feedback.kind === 'error' ? styles.feedbackError : styles.feedbackOk]}><Text style={styles.feedbackText}>{feedback.text}</Text></View> : null}
      {['items', 'assignments', 'returns', 'damage'].includes(variant) ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filterOptions.map(([value, label]) => <Pressable key={value} onPress={() => setStatusFilter(value)} style={[styles.filter, statusFilter === value && styles.filterActive]}><Text style={[styles.filterText, statusFilter === value && styles.filterTextActive]}>{label}</Text></Pressable>)}</ScrollView> : null}

      {variant === 'items' ? <View style={styles.panel}><View style={[styles.tableHead, compact && styles.hidden]}><Text style={[styles.headText, styles.assetCol]}>Inventarposten</Text><Text style={[styles.headText, styles.idCol]}>Kennzeichnung</Text><Text style={[styles.headText, styles.ownerCol]}>Kategorie</Text><Text style={[styles.headText, styles.statusCol]}>Status</Text></View>{filteredItems.map((item) => <View key={item.id} style={[styles.row, compact && styles.rowCompact]}><View style={styles.assetCol}><Text style={styles.rowTitle}>{item.name}</Text><Text style={styles.rowMeta}>{[item.manufacturer, item.model].filter(Boolean).join(' ') || 'Ohne Herstellerangabe'}</Text></View><View style={styles.idCol}><Text style={styles.rowText}>{item.serialNumber || item.barcode || '—'}</Text><Text style={styles.rowMeta}>{CONDITION[item.condition]}</Text></View><View style={styles.ownerCol}><Text style={styles.rowText}>{INVENTORY_CATEGORY_LABELS[item.categoryGroup]}</Text></View><View style={styles.statusCol}><Status text={ITEM_STATUS[item.status] ?? item.status} tone={item.status === 'available' ? 'ok' : item.status === 'damaged' || item.status === 'lost' ? 'danger' : 'neutral'} styles={styles} /></View></View>)}{filteredItems.length === 0 ? <Empty styles={styles} title="Keine passenden Inventarposten" text={data.items.length === 0 ? 'Legen Sie den ersten Inventarposten an.' : 'Ändern Sie Suche oder Filter.'} /> : null}</View> : null}

      {variant === 'assignments' || variant === 'returns' ? <View style={styles.panel}>{filteredAssignments.map((entry) => { const item = itemMap.get(entry.itemId); return <View key={entry.id} style={[styles.row, compact && styles.rowCompact]}><View style={styles.assetCol}><Text style={styles.rowTitle}>{item?.name ?? 'Unbekannter Posten'}</Text><Text style={styles.rowMeta}>{item?.serialNumber || item?.barcode || 'Ohne Kennnummer'}</Text></View><View style={styles.ownerCol}><Text style={styles.rowText}>{employeeName(entry.recipientEmployeeId)}</Text><Text style={styles.rowMeta}>{entry.expectedReturnAt ? `Rückgabe: ${new Date(entry.expectedReturnAt).toLocaleDateString('de-DE')}` : 'Keine Rückgabefrist'}</Text></View><View style={styles.statusCol}><Status text={ASSIGNMENT_STATUS[entry.status] ?? entry.status} tone={entry.status === 'overdue' ? 'danger' : entry.status === 'return_requested' ? 'warning' : 'neutral'} styles={styles} /></View>{variant === 'returns' ? <Pressable onPress={() => { setSelectedAssignmentId(entry.id); setCondition(item?.condition ?? 'good'); setEditor('return'); }} style={styles.rowAction}><Text style={styles.rowActionText}>Rücknahme buchen</Text></Pressable> : null}</View>; })}{filteredAssignments.length === 0 ? <Empty styles={styles} title="Keine offenen Vorgänge" text="Es gibt aktuell keine offenen Ausgaben oder Rücknahmen." /> : null}</View> : null}

      {variant === 'damage' ? <View style={styles.panel}>{filteredDamage.map((entry) => <View key={entry.id} style={[styles.row, compact && styles.rowCompact]}><View style={styles.assetCol}><Text style={styles.rowTitle}>{itemMap.get(entry.itemId)?.name ?? 'Unbekannter Posten'}</Text><Text style={styles.rowMeta}>{entry.reportType === 'loss' ? 'Verlust' : entry.reportType === 'missing_return' ? 'Fehlende Rückgabe' : 'Schaden'} · {new Date(entry.reportedAt).toLocaleDateString('de-DE')}</Text></View><View style={styles.ownerCol}><Text style={styles.rowText}>{entry.description}</Text></View><View style={styles.statusCol}><Status text={entry.resolvedAt ? 'Erledigt' : 'Offen'} tone={entry.resolvedAt ? 'ok' : 'danger'} styles={styles} /></View></View>)}{filteredDamage.length === 0 ? <Empty styles={styles} title="Keine Vorfälle" text="Es liegen keine passenden Schaden- oder Verlustmeldungen vor." /> : null}</View> : null}

      {variant === 'categories' ? <CardGrid styles={styles} rows={visibleCategories.map((entry) => ({ id: entry.id, title: entry.label, meta: INVENTORY_CATEGORY_LABELS[entry.group], details: `${entry.requiresReturnOnExit ? 'Rückgabe bei Austritt' : 'Keine Pflicht-Rückgabe'} · ${entry.barcodeEnabled ? 'Barcode aktiv' : 'Ohne Barcode'}` }))} /> : null}
      {variant === 'locations' ? <CardGrid styles={styles} rows={data.locations.map((entry) => ({ id: entry.id, title: entry.label, meta: [entry.building, entry.room].filter(Boolean).join(' · ') || 'Ohne Raumangabe', details: entry.notes || 'Keine Hinweise' }))} /> : null}
      {variant === 'employees' || variant === 'offboarding' ? <CardGrid styles={styles} rows={demoEmployees.map((employee) => { const assigned = openAssignments.filter((entry) => entry.recipientEmployeeId === employee.id || entry.responsibleEmployeeId === employee.id); return { id: employee.id, title: `${employee.firstName} ${employee.lastName}`, meta: employee.jobTitle || 'Mitarbeitende:r', details: assigned.length ? `${assigned.length} aktive Ausgabe${assigned.length === 1 ? '' : 'n'}` : 'Keine aktive Ausstattung' }; }).filter((row) => matches(row.title, row.meta, row.details))} /> : null}
      {variant === 'protocols' ? <GenericRows styles={styles} rows={data.protocols} empty="Noch keine Rückgabeprotokolle." /> : null}
      {variant === 'audit' ? <GenericRows styles={styles} rows={data.audit} empty="Noch keine protokollierten Änderungen." /> : null}
      {variant === 'mdm' || variant === 'barcode' || variant === 'settings' ? <View style={styles.panel}><Empty styles={styles} title="Dieser Bereich ist noch nicht produktiv freigeschaltet" text="Es werden keine Funktionen vorgetäuscht. Die Ansicht wird aktiviert, sobald die technische Anbindung vollständig verfügbar ist." /></View> : null}
      <Pressable onPress={() => router.replace(backRoute as never)} style={styles.backButton}><Text style={styles.secondaryButtonText}>← Zur Inventarzentrale</Text></Pressable>

      <Modal visible={editor !== null} transparent animationType="fade" onRequestClose={resetEditor}>
        <View style={styles.scrim}><View style={styles.dialog}><ScrollView contentContainerStyle={styles.dialogContent}>
          <View style={styles.dialogHeader}><View><Text style={styles.dialogTitle}>{editor === 'create' ? 'Inventarposten anlegen' : editor === 'issue' ? 'Inventar ausgeben' : editor === 'return' ? 'Rücknahme dokumentieren' : 'Schaden oder Verlust melden'}</Text><Text style={styles.dialogSubtitle}>Pflichtangaben vollständig erfassen</Text></View><Pressable onPress={resetEditor} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
          {editor === 'create' ? <><Field label="Bezeichnung *" value={name} onChangeText={setName} styles={styles} /><Text style={styles.fieldLabel}>Kategorie *</Text><ChoiceList values={visibleCategories.map((entry) => ({ value: entry.id, label: entry.label }))} selected={categoryId} onSelect={setCategoryId} styles={styles} /><Field label="Seriennummer / Kennzeichnung" value={serialNumber} onChangeText={setSerialNumber} styles={styles} /></> : null}
          {editor === 'issue' ? <><Text style={styles.fieldLabel}>Verfügbarer Inventarposten *</Text><ChoiceList values={data.items.filter((item) => item.status === 'available').map((item) => ({ value: item.id, label: `${item.name}${item.serialNumber ? ` · ${item.serialNumber}` : ''}` }))} selected={selectedItemId} onSelect={setSelectedItemId} styles={styles} /><Text style={styles.fieldLabel}>Empfänger:in *</Text><ChoiceList values={demoEmployees.filter((entry) => entry.status === 'aktiv').map((entry) => ({ value: entry.id, label: `${entry.firstName} ${entry.lastName}` }))} selected={selectedEmployeeId} onSelect={setSelectedEmployeeId} styles={styles} /></> : null}
          {editor === 'return' ? <><Text style={styles.fieldLabel}>Zustand bei Rückgabe *</Text><ChoiceList values={['very_good', 'good', 'used', 'damaged', 'unusable'].map((value) => ({ value, label: CONDITION[value] }))} selected={condition} onSelect={(value) => setCondition(value as InventoryCondition)} styles={styles} /></> : null}
          {editor === 'damage' ? <><Text style={styles.fieldLabel}>Inventarposten *</Text><ChoiceList values={data.items.map((item) => ({ value: item.id, label: item.name }))} selected={selectedItemId} onSelect={setSelectedItemId} styles={styles} /><Text style={styles.fieldLabel}>Meldungsart *</Text><ChoiceList values={[{ value: 'damage', label: 'Schaden' }, { value: 'loss', label: 'Verlust' }, { value: 'missing_return', label: 'Fehlende Rückgabe' }]} selected={reportType} onSelect={(value) => setReportType(value as InventoryDamageReport['reportType'])} styles={styles} /></> : null}
          <Field label={editor === 'damage' ? 'Beschreibung *' : 'Notiz'} value={notes} onChangeText={setNotes} multiline styles={styles} />
          {feedback?.kind === 'error' ? <Text style={styles.formError}>{feedback.text}</Text> : null}
          <View style={styles.dialogActions}><Pressable onPress={resetEditor} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Abbrechen</Text></Pressable><Pressable disabled={saving} onPress={save} style={[styles.primaryButton, saving && styles.disabled]}><Text style={styles.primaryButtonText}>{saving ? 'Speichert…' : 'Speichern'}</Text></Pressable></View>
        </ScrollView></View></View>
      </Modal>
    </ScreenShell>
  );
}

function Field({ label, value, onChangeText, multiline, styles }: { label: string; value: string; onChangeText: (text: string) => void; multiline?: boolean; styles: ReturnType<typeof createStyles> }) { return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} multiline={multiline} style={[styles.input, multiline && styles.textarea]} /></View>; }
function ChoiceList({ values, selected, onSelect, styles }: { values: { value: string; label: string }[]; selected: string; onSelect: (value: string) => void; styles: ReturnType<typeof createStyles> }) { return <View style={styles.choiceList}>{values.length ? values.map((entry) => <Pressable key={entry.value} onPress={() => onSelect(entry.value)} style={[styles.choice, selected === entry.value && styles.choiceActive]}><Text style={[styles.choiceText, selected === entry.value && styles.choiceTextActive]}>{entry.label}</Text></Pressable>) : <Text style={styles.rowMeta}>Keine Auswahl verfügbar.</Text>}</View>; }
function Status({ text, tone, styles }: { text: string; tone: 'ok' | 'warning' | 'danger' | 'neutral'; styles: ReturnType<typeof createStyles> }) { return <Text style={[styles.badge, tone === 'ok' ? styles.badgeOk : tone === 'warning' ? styles.badgeWarning : tone === 'danger' ? styles.badgeDanger : styles.badgeNeutral]}>{text}</Text>; }
function Empty({ title, text, styles }: { title: string; text: string; styles: ReturnType<typeof createStyles> }) { return <View style={styles.empty}><Text style={styles.emptyMark}>✓</Text><View><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowMeta}>{text}</Text></View></View>; }
function CardGrid({ rows, styles }: { rows: { id: string; title: string; meta: string; details: string }[]; styles: ReturnType<typeof createStyles> }) { return <View style={styles.cardGrid}>{rows.map((row) => <View key={row.id} style={styles.card}><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.rowMeta}>{row.meta}</Text><Text style={styles.cardDetails}>{row.details}</Text></View>)}{rows.length === 0 ? <Empty styles={styles} title="Keine Einträge" text="In dieser Ansicht sind noch keine Daten vorhanden." /> : null}</View>; }
function GenericRows({ rows, empty, styles }: { rows: Record<string, unknown>[]; empty: string; styles: ReturnType<typeof createStyles> }) { return <View style={styles.panel}>{rows.map((row, index) => <View key={String(row.id ?? index)} style={styles.row}><View style={styles.workCopy}><Text style={styles.rowTitle}>{String(row.employeeName ?? row.action ?? row.status ?? row.id ?? 'Eintrag')}</Text><Text style={styles.rowMeta}>{String(row.protocolDate ?? row.createdAt ?? row.returnedAt ?? '')}</Text></View></View>)}{rows.length === 0 ? <Empty styles={styles} title="Keine Einträge" text={empty} /> : null}</View>; }

function createStyles(c: ReturnType<typeof useCareLightPalette>['c']) { return StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: 18 }, search: { flex: 1, minWidth: 260, minHeight: 46, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surfaceAlt, color: c.text, fontSize: 15 },
  primaryButton: { minHeight: 46, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#0878E8' }, primaryButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }, secondaryButton: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, secondaryButtonText: { color: c.text, fontWeight: '800', fontSize: 14 }, disabled: { opacity: 0.55 },
  feedback: { marginTop: 12, padding: 12, borderRadius: 12 }, feedbackOk: { backgroundColor: '#E5F7ED' }, feedbackError: { backgroundColor: '#FFE5E8' }, feedbackText: { color: c.text, fontWeight: '700' }, filters: { gap: 8, paddingVertical: 14 }, filter: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }, filterActive: { backgroundColor: '#E4F1FF', borderColor: '#7DB8FF' }, filterText: { color: c.muted, fontWeight: '700' }, filterTextActive: { color: '#0869CC' },
  panel: { overflow: 'hidden', borderWidth: 1, borderColor: c.border, borderRadius: 18, backgroundColor: c.surface }, tableHead: { minHeight: 42, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: c.surfaceAlt, borderBottomWidth: 1, borderBottomColor: c.border }, headText: { color: c.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: .5 }, hidden: { display: 'none' }, row: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }, rowCompact: { flexWrap: 'wrap', alignItems: 'flex-start' }, assetCol: { flex: 2, minWidth: 180 }, idCol: { flex: 1.2, minWidth: 130 }, ownerCol: { flex: 1.4, minWidth: 160 }, statusCol: { minWidth: 126, alignItems: 'flex-start' }, workCopy: { flex: 1 }, rowTitle: { color: c.text, fontSize: 15, fontWeight: '800' }, rowText: { color: c.text, fontSize: 14, fontWeight: '600' }, rowMeta: { color: c.muted, fontSize: 12, marginTop: 4 }, rowAction: { minHeight: 38, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#E4F1FF' }, rowActionText: { color: '#0869CC', fontSize: 12, fontWeight: '800' }, badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, fontSize: 12, fontWeight: '800' }, badgeOk: { color: '#087A44', backgroundColor: '#E5F7ED' }, badgeWarning: { color: '#965800', backgroundColor: '#FFF1D2' }, badgeDanger: { color: '#B42332', backgroundColor: '#FFE5E8' }, badgeNeutral: { color: c.text, backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  empty: { minHeight: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 22 }, emptyMark: { width: 42, height: 42, borderRadius: 21, textAlign: 'center', textAlignVertical: 'center', color: '#087A44', backgroundColor: '#E5F7ED', fontSize: 19, fontWeight: '900' }, cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { flexGrow: 1, flexBasis: 280, minHeight: 126, padding: 18, borderWidth: 1, borderColor: c.border, borderRadius: 17, backgroundColor: c.surface }, cardDetails: { color: c.text, fontSize: 13, marginTop: 18, fontWeight: '600' }, backButton: { alignSelf: 'flex-start', marginTop: 18, minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(16,35,63,0.35)', alignItems: 'center', justifyContent: 'center', padding: 18 }, dialog: { width: '100%', maxWidth: 720, maxHeight: '92%', overflow: 'hidden', borderRadius: 22, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }, dialogContent: { padding: 22, gap: 12 }, dialogHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }, dialogTitle: { color: c.text, fontSize: 22, fontWeight: '900' }, dialogSubtitle: { color: c.muted, fontSize: 13, marginTop: 4 }, close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: c.border }, closeText: { color: c.text, fontSize: 25 }, fieldLabel: { color: c.text, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 3 }, input: { minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 13, backgroundColor: c.surfaceAlt, color: c.text, fontSize: 15 }, textarea: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }, choiceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 }, choice: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceAlt }, choiceActive: { backgroundColor: '#E4F1FF', borderColor: '#7DB8FF' }, choiceText: { color: c.text, fontSize: 13, fontWeight: '700' }, choiceTextActive: { color: '#0869CC' }, formError: { color: '#B42332', fontSize: 13, fontWeight: '700' }, dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
}); }
