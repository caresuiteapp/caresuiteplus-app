import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { ErrorState, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { confirmAction } from '@/lib/platform/confirmAction';
import { medicationPlanOriginalFields, medicationPlanPositionTitle, parseMedicationPlanPages, type MedicationPlanDraft } from '@/lib/pflege/medicationPlanImportDomain';
import { importMedicationPlanFile } from '@/lib/pflege/medicationPlanImportReader';
import { discardMedicationPlanOrderHandoff, startMedicationPlanOrderHandoff } from '@/lib/pflege/medicationPlanOrderHandoff';
import { prepareMedicationPlanOrderPrefill } from '@/lib/pflege/medicationPlanOrderPrefill';
import {
  confirmMedicationPlanImportPosition, findMedicationPlanClients, getMedicationPlanImport,
  listMedicationPlanImports, readMedicationPlanOriginal, saveMedicationPlanImport,
  type MedicationPlanAssignment, type MedicationPlanClient, type MedicationPlanImportScope,
  type StoredMedicationPlan, type StoredMedicationPlanListItem,
} from '@/lib/pflege/medicationPlanImportService';
import { spacing, typography, useLegacyTheme } from '@/theme';

type Picked = NonNullable<Awaited<ReturnType<typeof importMedicationPlanFile>>>;
type Prepared = { requestId: string; file: Picked; plan: MedicationPlanDraft };
type Submitted = { prepared: Prepared; assignment: MedicationPlanAssignment; client: MedicationPlanClient };
const PAGE_SIZE = 10;
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Der Vorgang konnte nicht abgeschlossen werden.';
const clientLabel = (client: MedicationPlanClient) => `${client.firstName} ${client.lastName}${client.birthDate ? ` · ${client.birthDate}` : ''}`;
const conflictsWithBirthDate = (prepared: Prepared | null, client: MedicationPlanClient | null) =>
  Boolean(prepared?.plan.patient.birthDate && client?.birthDate && prepared.plan.patient.birthDate !== client.birthDate);

/** Imported plans remain review records: no medication is created, activated, or administered here. */
export function MedicationPlanImportPanel(scope: MedicationPlanImportScope) {
  const router = useRouter();
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => StyleSheet.create({
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
    group: { gap: spacing.sm }, summary: { gap: spacing.xs },
    row: { gap: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 14, padding: spacing.md },
    heading: { ...typography.label, color: colors.textPrimary }, body: { ...typography.body, color: colors.textPrimary },
    hint: { ...typography.caption, color: colors.textMuted }, reviewed: { ...typography.label, color: colors.success },
    fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, field: { flexGrow: 1, flexBasis: 150, minWidth: 125 },
  }), [colors]);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [search, setSearch] = useState(''), [clients, setClients] = useState<MedicationPlanClient[]>([]);
  const [selected, setSelected] = useState<MedicationPlanClient | null>(null), [exact, setExact] = useState(false);
  const [reason, setReason] = useState('');
  const [drafts, setDrafts] = useState<StoredMedicationPlanListItem[] | null>(null);
  const [stored, setStored] = useState<StoredMedicationPlan | null>(null), [page, setPage] = useState(0);
  const owner = `${scope.tenantId}:${scope.actorId}`;
  const live = useRef({ owner, isCurrent: scope.isCurrent });
  const alive = useRef(false), pending = useRef<AbortController | null>(null);
  const latestDraft = useRef({ stored, clientId: selected?.id, open });
  const transferUntil = useRef(0);
  live.current = { owner, isCurrent: scope.isCurrent };
  latestDraft.current = { stored, clientId: selected?.id, open };
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); pending.current = null; }; }, []);
  const current = () => alive.current && live.current.owner === owner && live.current.isCurrent();
  const currentScope = { tenantId: scope.tenantId, actorId: scope.actorId, isCurrent: current };
  const busy = phase !== null;

  async function run(label: string, work: (signal: AbortSignal) => Promise<void>) {
    if (!current() || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setPhase(label); setError(null);
    try { await work(controller.signal); }
    catch (cause) { if (current() && !controller.signal.aborted) setError(errorMessage(cause)); }
    finally {
      if (pending.current === controller) pending.current = null;
      if (current()) setPhase(null);
    }
  }
  async function pick() {
    await run('Original wird auf diesem Gerät gelesen…', async signal => {
      const file = await importMedicationPlanFile(signal);
      if (!current() || !file) return;
      const plan = parseMedicationPlanPages(file.xmlPages);
      const candidate = { requestId: randomUUID(), file, plan };
      setPrepared(candidate); setSubmitted(null); setSelected(null); setExact(false); setReason('');
      setSearch(''); setClients([]); setDrafts(null); setStored(null); setPage(0);
      if (!plan.patient.birthDate) return;
      const result = await findMedicationPlanClients(currentScope, null, plan.patient);
      if (!current() || signal.aborted) return;
      if (result.exact) {
        setSelected(result.clients[0]); setExact(true);
      }
    });
  }
  async function searchClients() {
    const needle = search.trim();
    if (needle.length < 2 || submitted) return;
    await run('Aktive Pflegeakten werden gesucht…', async () => {
      const result = await findMedicationPlanClients(currentScope, needle, null);
      if (current()) setClients(result.clients);
    });
  }
  function chooseClient(client: MedicationPlanClient) {
    if (!current() || pending.current || submitted || conflictsWithBirthDate(prepared, client)) return;
    setSelected(client); setExact(false); setReason(''); setDrafts(null); setStored(null); setPage(0); setError(null);
  }
  async function save() {
    if (!prepared || !selected || conflictsWithBirthDate(prepared, selected)) return;
    const entry: Submitted = submitted ?? { prepared, client: selected, assignment: { clientId: selected.id, assignment: exact ? 'exact' : 'manual', reason: exact ? '' : reason.trim() } };
    if (entry.assignment.assignment === 'manual' && entry.assignment.reason.length < 10) return;
    await run('Original und Positionen werden als Prüfentwurf abgelegt…', async () => {
      setSubmitted(entry);
      const draft = await saveMedicationPlanImport(currentScope, entry.prepared.requestId, entry.assignment, entry.prepared.file, entry.prepared.plan);
      if (!current()) return;
      setStored(draft); setPrepared(null); setSubmitted(null); setDrafts(null); setPage(0);
    });
  }
  async function loadList() {
    if (!selected || prepared) return;
    const clientId = selected.id;
    await run('Vorhandene Prüfentwürfe werden geladen…', async () => {
      const result = await listMedicationPlanImports(currentScope, clientId);
      if (current()) setDrafts(result);
    });
  }
  async function loadDraft(item: StoredMedicationPlanListItem) {
    if (selected?.id !== item.clientId || prepared) return;
    await run('Prüfentwurf wird gelesen…', async () => {
      const result = await getMedicationPlanImport(currentScope, item.id, item.clientId);
      if (current()) { setStored(result); setPage(0); }
    });
  }
  async function confirmRow(draft: StoredMedicationPlan, rowIndex: number) {
    if (draft.confirmed.some(row => row.rowIndex === rowIndex)) return;
    await run(`Bestätigung für Position ${rowIndex + 1}…`, async () => {
      const accepted = await confirmAction({ title: `Position ${rowIndex + 1} mit dem Original abgeglichen?`,
        message: 'Bestätigen Sie diese einzelne Position nur, wenn sie dem hochgeladenen Original entspricht. Die Bestätigung ist keine ärztliche Freigabe und aktiviert keine Verordnung.',
        confirmLabel: 'Einzelprüfung bestätigen' });
      if (!accepted || !current()) return;
      const confirmation = await confirmMedicationPlanImportPosition(currentScope, draft.id, rowIndex);
      if (current()) setStored(previous => previous?.id === draft.id && !previous.confirmed.some(row => row.rowIndex === rowIndex)
        ? { ...previous, confirmed: [...previous.confirmed, confirmation] } : previous);
    });
  }
  function openOrder(draft: StoredMedicationPlan, rowIndex: number) {
    const latest = latestDraft.current;
    if (!current() || pending.current || !latest.open || latest.stored !== draft || latest.clientId !== draft.clientId
      || transferUntil.current > Date.now() || !draft.confirmed.some(item => item.rowIndex === rowIndex)) return;
    const prefill = prepareMedicationPlanOrderPrefill(draft.plan.rows[rowIndex]);
    if (!prefill || prefill.scheduleStatus === 'unsupported') return;
    let token: string | undefined;
    transferUntil.current = Date.now() + 800;
    try {
      token = startMedicationPlanOrderHandoff({ tenantId: scope.tenantId, actorId: scope.actorId, clientId: draft.clientId, importId: draft.id, rowIndex });
      router.push({ pathname: '/pflege/medikation/new', params: { bmp: token } });
    } catch (cause) {
      if (token) discardMedicationPlanOrderHandoff(token);
      transferUntil.current = 0;
      if (current()) setError(errorMessage(cause));
    }
  }
  async function downloadOriginal(draft: StoredMedicationPlan) {
    if (Platform.OS !== 'web') return;
    await run('Privates Original wird geprüft…', async () => {
      const file = await readMedicationPlanOriginal(currentScope, draft);
      if (!current()) return;
      const url = URL.createObjectURL(new Blob([Uint8Array.from(file.bytes)], { type: 'application/octet-stream' }));
      const link = document.createElement('a');
      const ext = ({ 'application/pdf': 'pdf', 'application/xml': 'xml', 'text/xml': 'xml', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.mimeType] ?? 'bin';
      link.href = url; link.download = `Medikationsplan-Original.${ext}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
  async function reset() {
    if (!current() || pending.current) return;
    if (prepared) {
      const accepted = await confirmAction({ title: 'Lokalen Import schließen?', message: submitted
        ? 'Der frühere Speicherversuch kann abgeschlossen sein. Prüfen Sie danach die Entwürfe dieser Akte, bevor Sie erneut importieren.'
        : 'Die bislang nicht abgelegten Angaben werden aus dieser Ansicht entfernt.' });
      if (!accepted || !current() || pending.current) return;
    }
    setPrepared(null); setSubmitted(null); setStored(null); setDrafts(null); setClients([]); setSelected(null); setExact(false); setReason(''); setSearch(''); setPage(0); setError(null); setOpen(false);
  }
  if (!scope.isCurrent()) return null;
  if (!open) return <PremiumButton title="Medikationsplan importieren" variant="secondary" onPress={() => { if (current()) setOpen(true); }} />;
  const visiblePlan = stored?.plan ?? prepared?.plan;
  const pageCount = visiblePlan ? Math.ceil(visiblePlan.rows.length / PAGE_SIZE) : 0;
  const reviewRows = visiblePlan?.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];
  return <SectionPanel title="Medikationsplan übernehmen" subtitle="Original ablegen und Positionen einzeln prüfen">
    <InfoBanner variant="info" title="Prüfentwurf" message={Platform.OS === 'web'
      ? 'Bundeseinheitlichen Medikationsplan (BMP 2.6 bis 2.8) als XML, PDF mit Strukturcode oder Foto mit lesbarem DataMatrix-Code auswählen.'
      : 'In der App BMP 2.6 bis 2.8 als XML auswählen. PDF und Fotos mit lesbarem DataMatrix-Code lassen sich im Web importieren.'} />
    <View style={styles.actions}>
      <PremiumButton title="Originaldatei auswählen" disabled={busy || !!prepared} onPress={() => { void pick(); }} />
      <PremiumButton title="Import schließen" variant="secondary" disabled={busy} onPress={() => { void reset(); }} />
    </View>
    {phase ? <Text accessibilityRole="progressbar" accessibilityLabel={phase} style={styles.hint}>{phase}</Text> : null}
    {error ? <ErrorState message={error} /> : null}
    {visiblePlan ? <View style={styles.summary}>
      <Text style={styles.heading}>{stored?.fileName ?? prepared?.file.fileName}</Text>
      <Text style={styles.body}>Person im Plan: {visiblePlan.patient.firstName} {visiblePlan.patient.lastName} · {visiblePlan.patient.birthDate ?? 'Geburtsdatum unvollständig'}</Text>
      <Text style={styles.hint}>Ausdruck: {visiblePlan.issuer.name} · {visiblePlan.issuer.printedAt} · {visiblePlan.pageCount} Seite(n)</Text>
    </View> : null}
    {!stored && (!exact || !selected) ? <View style={styles.group}>
      {prepared ? <InfoBanner variant="warning" title="Akte manuell prüfen" message="Es gibt keine eindeutige automatische Zuordnung. Gleichen Sie die Identitätsmerkmale mit dem Original ab, bevor Sie die Akte auswählen." /> : null}
      <PremiumInput label="Pflegeakte suchen" placeholder="Vor- oder Nachname" value={search} editable={!busy && !submitted} onChangeText={setSearch} />
      <PremiumButton title="Pflegeakten suchen" variant="secondary" disabled={busy || !!submitted || search.trim().length < 2} onPress={() => { void searchClients(); }} />
      {clients.map(client => {
        const conflict = conflictsWithBirthDate(prepared, client);
        return <PremiumButton key={client.id} title={`${clientLabel(client)}${conflict ? ' · Geburtsdatum weicht ab' : ''}`} variant={client.id === selected?.id ? 'primary' : 'secondary'} disabled={busy || !!submitted || conflict} onPress={() => chooseClient(client)} />;
      })}
      {prepared && selected ? <PremiumInput label="Begründung der Zuordnung" value={reason} editable={!busy && !submitted} onChangeText={setReason} multiline maxLength={500} placeholder="Identitätsmerkmale oder Abweichung begründen (mindestens 10 Zeichen)" /> : null}
    </View> : null}
    {selected ? <Text style={styles.body}>{exact ? 'Eindeutig zugeordnete Akte: ' : 'Ausgewählte Akte: '}{clientLabel(selected)}</Text> : null}
    {prepared ? <PremiumButton title={submitted ? 'Ablage erneut bestätigen' : 'Original in der Akte als Prüfentwurf ablegen'} disabled={busy || !selected || conflictsWithBirthDate(prepared, selected) || (!exact && reason.trim().length < 10)} onPress={() => { void save(); }} /> : null}
    {!prepared && selected ? <PremiumButton title="Prüfentwürfe dieser Akte laden" variant="secondary" disabled={busy} onPress={() => { void loadList(); }} /> : null}
    {drafts ? <View style={styles.group}>
      {!drafts.length ? <Text style={styles.hint}>Für diese Akte sind keine Prüfentwürfe vorhanden.</Text> : null}
      {drafts.map(item => <PremiumButton key={item.id} title={`${item.fileName} · ${item.confirmedCount}/${item.positionCount} geprüft`} variant="secondary" disabled={busy} onPress={() => { void loadDraft(item); }} />)}
    </View> : null}
    {stored ? <View style={styles.group}>
      <Text style={styles.heading}>{stored.confirmed.length} von {stored.plan.rows.length} Positionen bestätigt</Text>
      <Text style={styles.hint}>Nach der Einzelprüfung können Sie geeignete Positionen im Verordnungsformular öffnen. Eine Verordnung entsteht erst beim Speichern im Formular.</Text>
      {Platform.OS === 'web' ? <PremiumButton title="Originaldatei herunterladen" variant="secondary" disabled={busy} onPress={() => { void downloadOriginal(stored); }} /> : null}
    </View> : null}
    {reviewRows.map((row, i) => {
      const rowIndex = page * PAGE_SIZE + i, reviewed = stored?.confirmed.some(item => item.rowIndex === rowIndex);
      const prefill = reviewed ? prepareMedicationPlanOrderPrefill(row) : null;
      return <View key={rowIndex} style={styles.row}>
        <Text style={styles.heading}>{rowIndex + 1}. {medicationPlanPositionTitle(row)}</Text>
        <Text style={styles.hint}>Seite {row.page}{row.section.label ? ` · ${row.section.label}` : row.section.code ? ` · Abschnitt ${row.section.code}` : ''}</Text>
        <View style={styles.fieldGrid}>{medicationPlanOriginalFields(row).map(field => <View key={field.label} style={styles.field}>
          <Text style={styles.hint}>{field.label}</Text><Text style={styles.body}>{field.value || 'Leer im Original'}</Text>
        </View>)}</View>
        {stored ? (reviewed ? <Text style={styles.reviewed}>Einzeln bestätigt</Text> : <PremiumButton title={`Position ${rowIndex + 1} bestätigen`} variant="secondary" disabled={busy} onPress={() => { void confirmRow(stored, rowIndex); }} />) : null}
        {stored && prefill ? (prefill.scheduleStatus === 'unsupported'
          ? <Text style={styles.hint}>{prefill.scheduleMessage}</Text>
          : <PremiumButton title="Im Verordnungsformular öffnen" accessibilityLabel={`Position ${rowIndex + 1} im Verordnungsformular öffnen`} variant="secondary" disabled={busy} onPress={() => openOrder(stored, rowIndex)} />) : null}
      </View>;
    })}
    {pageCount > 1 ? <View style={styles.actions}>
      <PremiumButton title="Vorherige Positionen" variant="secondary" disabled={busy || page === 0} onPress={() => setPage(page - 1)} />
      <Text style={styles.hint}>Gruppe {page + 1} von {pageCount}</Text>
      <PremiumButton title="Weitere Positionen" variant="secondary" disabled={busy || page + 1 >= pageCount} onPress={() => setPage(page + 1)} />
    </View> : null}
  </SectionPanel>;
}
