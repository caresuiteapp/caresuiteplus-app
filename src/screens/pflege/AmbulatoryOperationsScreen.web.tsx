import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useLocalMinute } from '@/hooks/useLocalMinute';
import { useCareRuntimePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { advanceCareAdmission, createCareTariff, fetchCareOperationsQueue, saveCareAdmission, saveCareTask } from '@/lib/pflege/ambulatoryOperationsService';
import { admissionBlockers, admissionLabels, basisLabels, isCalendarDate, parseEuroCents, type CareAdmission, type CareTariff, type CareTask, type FundingBasis } from '@/lib/pflege/ambulatoryOperationsDomain';
import { admissionFilters, dueText, filterAdmissions, filterCareTasks, matchesOperationSearch, operationRoutes, operationsCaseScope, operationsQueueRoute, taskFilters, validateOperationAction, validOperationsId, type AdmissionFilter, type OperationsArea, type OperationAction, type TaskFilter } from '@/lib/pflege/ambulatoryOperationsQueue';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { fetchCareTourResources } from '@/lib/pflege/careTourPlanningService';
import { canShowDesktopCatalogRoute } from '@/liquid-command/navigation/appsWidgetsCatalogModel.shared';
import { radius, spacing, typography } from '@/theme';
import { CarePermissionStatus } from './CarePermissionStatus.web';

const titles = { admissions: 'Aufnahme & Versorgung', tariffs: 'Leistungen & Vergütung', tasks: 'Aufgaben & Wiedervorlagen' };
const subtitles = { admissions: 'Entwürfe prüfen, Versorgung freigeben und Änderungen dokumentieren', tariffs: 'Leistungscodes und gültige Vergütungsvereinbarungen', tasks: 'Fälligkeiten, Zuständigkeiten und dokumentierte Ergebnisse' };
const newTitles = { admissions: 'Aufnahme anlegen', tariffs: 'Tarif anlegen', tasks: 'Aufgabe anlegen' };
const blankAdmission = (clientId = '') => ({ clientId, clientName: '', startsOn: berlinCalendarDate(), endsOn: '', basis: 'sgb_xi' as FundingBasis, payerName: '', payerIk: '', contractReference: '', costInformationReference: '', consentReference: '', emergencyContact: '', accessNotes: '', notes: '' });
const blankTariff = () => ({ code: '', label: '', basis: 'sgb_xi' as FundingBasis, unit: 'visit' as CareTariff['unit'], validFrom: berlinCalendarDate(), validUntil: '', payerIk: '', agreementReference: '' });
const blankTask = (clientId = '') => ({ clientId, title: '', description: '', dueOn: berlinCalendarDate(), priority: 'normal' as CareTask['priority'], assignedEmployeeId: '' });
const pageSize = 24;
type Permissions = ReturnType<typeof useCareRuntimePermissions>;
type PickerOption = { id: string; label: string };
type Editor = { kind: 'admission'; original?: CareAdmission } | { kind: 'task' } | { kind: 'tariff' };
const taskStatusLabels = { open: 'Offen', done: 'Erledigt', cancelled: 'Abgesagt' };
const tariffUnits = { visit: 'Besuch', minute: 'Minute', hour: 'Stunde', unit: 'Einheit' };
const denied = { ok: false as const, error: 'Der aktuelle Zugriff auf diesen Pflegevorgang ist nicht bestätigt.' };
const saveGrant = (area: OperationsArea) => area === 'tariffs' ? 'pflege.invoices.manage' : 'pflege.plans.manage';
const canReadArea = (area: OperationsArea, p: Permissions) => canShowDesktopCatalogRoute(operationRoutes[area], p)
  && p.can('pflege.plans.view') && (area !== 'tariffs' || p.can('pflege.proofs.view'));

export function AmbulatoryOperationsScreen({ area = 'admissions' }: { area?: OperationsArea }) {
  const auth = useAuth();
  const p = useCareRuntimePermissions();
  const params = useLocalSearchParams<{ clientId?: string }>();
  const router = useRouter();
  const scope = operationsCaseScope(params.clientId, area);
  const clientId = scope.state === 'case' ? scope.clientId : null;
  const tenant = p.tenantId;
  const { profile, user, session } = auth;
  const token = session?.accessToken;
  const expires = session?.expiresAt;
  const authorized = () => !!tenant && !!profile?.id && !!user?.id && !!token && session?.user.id === user.id
    && auth.authReady && auth.isAuthenticated && !auth.isLoading && !auth.profileBootstrapError && !auth.portalSession
    && profile.tenantId === tenant && profile.roleKey === p.roleKey
    && (expires === null || (typeof expires === 'number' && expires > Date.now())) && canReadArea(area, p);
  const readAllowed = authorized();
  const key = JSON.stringify([tenant, user?.id, profile?.id, p.roleKey, expires, [...p.permissions].sort(), area, scope.state, clientId]);
  const context = useRef({ key, token, readAllowed, revision: 0 });
  if (context.current.key !== key || context.current.token !== token || context.current.readAllowed !== readAllowed) {
    context.current = { key, token, readAllowed, revision: context.current.revision + 1 };
  }
  const generation = context.current;
  const latest = useRef(authorized);
  latest.current = authorized;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && context.current === generation && latest.current();
  if (!tenant || !readAllowed) return <ScreenShell title={titles[area]}>
    <CarePermissionStatus state={p} deniedMessage="Für diesen Pflegebereich fehlt die aktuelle Leseberechtigung." />
  </ScreenShell>;
  if (scope.state === 'invalid') return <ScreenShell title={titles[area]}>
    <ErrorState presentation="inline" message="Dieser Pflegefalllink ist ungültig." />
    <PremiumButton title="Übersicht öffnen" variant="secondary" onPress={() => { if (current()) router.replace(operationRoutes[area] as never); }} />
  </ScreenShell>;
  return <OperationsQueue key={generation.revision} area={area} tenant={tenant} clientId={clientId} permissions={p} current={current} />;
}

function OperationsQueue({ area, tenant, clientId, permissions, current }: { area: OperationsArea; tenant: string; clientId: string | null; permissions: Permissions; current(): boolean }) {
  const router = useRouter();
  const minute = useLocalMinute();
  const today = berlinCalendarDate(minute ?? undefined);
  const canWrite = () => current() && permissions.can(saveGrant(area));
  const [search, setSearch] = useState('');
  const [admissionFilter, setAdmissionFilter] = useState<AdmissionFilter>('all');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('open');
  const [limit, setLimit] = useState(pageSize);
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [action, setAction] = useState<OperationAction | null>(null);
  const [reason, setReason] = useState('');
  const [admission, setAdmission] = useState(() => blankAdmission(clientId ?? ''));
  const [tariff, setTariff] = useState(blankTariff);
  const [price, setPrice] = useState('');
  const [task, setTask] = useState(() => blankTask(clientId ?? ''));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const clients = useAsyncQuery(async () => {
    if (!current()) return denied;
    const result = await fetchEligibleCareClients(tenant, permissions.roleKey);
    return current() && result.ok && !result.usedDemoFallback && !result.tableMissing ? result
      : { ok: false as const, error: 'Die Liste der aktiven Pflegefälle ist derzeit nicht verfügbar.' };
  }, [tenant, area], { enabled: area !== 'tariffs', retryCount: 0 });
  const caseKnown = !clientId || (!clients.refreshError && clients.data?.some(row => row.id === clientId) === true);
  const liveScope = useRef(caseKnown); liveScope.current = caseKnown;
  const queueCurrent = () => current() && liveScope.current;
  const queue = useAsyncQuery(() => queueCurrent() ? fetchCareOperationsQueue(tenant, permissions.roleKey, area, clientId, queueCurrent) : Promise.resolve(denied),
    [tenant, area, clientId, caseKnown], { enabled: caseKnown, queryKey: `ops:${area}:${clientId ?? 'all'}:${caseKnown}`, retryCount: 0 });
  const staff = useAsyncQuery(async () => {
    if (!canWrite()) return denied;
    const result = await fetchCareTourResources(tenant, permissions.roleKey);
    return canWrite() ? result : denied;
  }, [tenant, area], { enabled: area === 'tasks' && canWrite(), retryCount: 0 });
  const { c } = useCareLightPalette();
  const clientNames = useMemo(() => new Map((clients.data ?? []).map(person => [person.id, [person.firstName, person.lastName].filter(Boolean).join(' ')])), [clients.data]);
  const employeeNames = useMemo(() => new Map((staff.data?.employees ?? []).map(person => [person.id, person.name])), [staff.data]);
  const clientOptions = [...clientNames].filter(([id]) => validOperationsId(id)).map(([id, label]) => ({ id, label }));
  const staffOptions = [...employeeNames].filter(([id]) => validOperationsId(id)).map(([id, label]) => ({ id, label }));
  const caseName = (id: string) => clientNames.get(id) || 'Pflegefall (Name nicht verfügbar)';
  const employeeName = (id: string) => employeeNames.get(id) || 'Zugewiesen';
  const data = queue.data;
  const admissions = filterAdmissions(data?.admissions ?? [], { filter: admissionFilter, search, caseId: clientId, name: caseName });
  const tasks = filterCareTasks(data?.tasks ?? [], { filter: taskFilter, search, caseId: clientId, today, name: caseName, employeeName });
  const tariffs = (data?.tariffs ?? []).filter(row => matchesOperationSearch(search, `${row.code} ${row.label} ${row.payerIk}`));
  const total = area === 'admissions' ? admissions.length : area === 'tasks' ? tasks.length : tariffs.length;
  const hasLoaded = !!data && !queue.refreshError && caseKnown;
  const writesEnabled = hasLoaded && canWrite();
  const refresh = async () => {
    if (!current() || busy) return;
    const names = area === 'tariffs' ? Promise.resolve() : clients.refresh();
    const people = area === 'tasks' && canWrite() ? staff.refresh() : Promise.resolve();
    await Promise.all([names, people, ...(caseKnown ? [queue.refresh()] : [])]);
  };
  const open = (target: OperationsArea, preserveCase = true) => {
    if (!busy && current() && canReadArea(target, permissions)) {
      router.push(operationsQueueRoute(target, preserveCase ? clientId : null) as never);
    }
  };
  const openClient = (id: string) => {
    if (!busy && current() && validOperationsId(id) && canShowDesktopCatalogRoute('/pflege/klienten', permissions)) {
      router.push(`/pflege/klienten/${encodeURIComponent(id)}` as never);
    }
  };
  function resetFilters() {
    setSearch(''); setAdmissionFilter('all'); setTaskFilter('all'); setLimit(pageSize); setSelected(null); setAction(null);
  }
  function startEditor(original?: CareAdmission) {
    if (lock.current || !writesEnabled) return;
    setFeedback(null); setAction(null); setReason('');
    if (area === 'admissions') { setAdmission(original ?? blankAdmission(clientId ?? '')); setEditor({ kind: 'admission', original }); }
    if (area === 'tasks') { setTask(blankTask(clientId ?? '')); setEditor({ kind: 'task' }); }
    if (area === 'tariffs') { setTariff(blankTariff()); setPrice(''); setEditor({ kind: 'tariff' }); }
  }
  function startAction(next: OperationAction) {
    if (lock.current || !writesEnabled) return;
    setFeedback(null); setEditor(null); setAction(next); setReason('');
  }
  const fail = (text: string) => setFeedback({ error: true, text });
  async function run(write: () => Promise<{ ok: boolean; error?: string }>, text: string, after: () => void) {
    if (lock.current || !writesEnabled || !canWrite() || !queueCurrent()) return;
    lock.current = true; setBusy(true); setFeedback(null);
    try {
      const result = await write();
      if (!queueCurrent() || !canWrite()) return;
      if (!result.ok) { fail(result.error ?? 'Speichern fehlgeschlagen.'); return; }
      after();
      const fresh = await queue.refreshWithResult();
      if (queueCurrent() && canWrite()) {
        setFeedback(fresh ? { error: false, text } : { error: false, text: `${text} Die Übersicht konnte noch nicht neu geladen werden.` });
      }
    } catch {
      if (queueCurrent() && canWrite()) fail('Der Speicherstand ist unklar. Bitte aktualisieren und prüfen, bevor Sie den Vorgang wiederholen.');
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }
  const clientSelectable = (id: string) => !!clients.data && !clients.error && !clients.refreshError && validOperationsId(id)
    && (!clientId || clientId === id) && clientNames.has(id);
  function save() {
    if (!editor || !writesEnabled || lock.current) return;
    const role = permissions.roleKey;
    if (editor.kind === 'admission') {
      const original = editor.original;
      if (original && (!admissionsSource(original.id, original.updatedAt) || original.clientId !== admission.clientId)) return fail('Der Entwurf wurde geändert. Bitte neu laden und erneut auswählen.');
      if (!clientSelectable(admission.clientId) || !isCalendarDate(admission.startsOn) || (admission.endsOn && (!isCalendarDate(admission.endsOn) || admission.endsOn < admission.startsOn))) return fail('Bitte einen aktiven Pflegefall und einen gültigen Versorgungszeitraum angeben.');
      if (!original && data?.admissions.some(row => row.clientId === admission.clientId && row.status !== 'closed')) return fail('Für diesen Pflegefall gibt es schon einen offenen Aufnahmevorgang.');
      void run(() => saveCareAdmission(tenant, role, admission, original), 'Aufnahmeentwurf gespeichert.', () => { setEditor(null); setAdmissionFilter('all'); setSearch(''); setLimit(pageSize); });
    } else if (editor.kind === 'task') {
      if (!task.title.trim() || !isCalendarDate(task.dueOn)) return fail('Bitte einen Aufgabentitel und ein gültiges Fälligkeitsdatum angeben.');
      if ((clientId || task.clientId) && !clientSelectable(task.clientId)) return fail('Bitte einen aktiven Pflegefall auswählen.');
      if (task.assignedEmployeeId && (staff.refreshError || !employeeNames.has(task.assignedEmployeeId))) return fail('Die Zuständigkeit konnte nicht bestätigt werden. Bitte erneut auswählen.');
      void run(() => saveCareTask(tenant, role, task), 'Aufgabe gespeichert.', () => { setEditor(null); setTaskFilter('open'); setSearch(''); setLimit(pageSize); });
    } else {
      const cents = parseEuroCents(price);
      if (!cents || !tariff.code.trim() || !tariff.label.trim() || !tariff.agreementReference.trim() || !isCalendarDate(tariff.validFrom) || (tariff.validUntil && (!isCalendarDate(tariff.validUntil) || tariff.validUntil < tariff.validFrom))) return fail('Bitte Leistungscode, Bezeichnung, Preis, Zeitraum und Preisgrundlage vollständig angeben.');
      void run(() => createCareTariff(tenant, role, { ...tariff, unitPriceCents: cents }), 'Tarifversion gespeichert.', () => setEditor(null));
    }
  }
  function admissionsSource(id: string, version: string) {
    return data?.admissions.find(row => row.id === id && row.updatedAt === version && row.status === 'draft' && (!clientId || row.clientId === clientId));
  }
  function confirm() {
    if (!action || !data || !writesEnabled || lock.current) return;
    const error = validateOperationAction(action, data, clientId, reason);
    if (error) return fail(error);
    const role = permissions.roleKey;
    const after = () => { setAction(null); setReason(''); };
    if (action.kind === 'admission') {
      const original = data.admissions.find(row => row.id === action.id);
      if (!original) return;
      const status = action.status;
      const text = status === 'paused' ? 'Versorgung pausiert.' : status === 'closed' ? 'Versorgung beendet.' : original.status === 'paused' ? 'Versorgung fortgesetzt.' : 'Versorgung freigegeben.';
      void run(() => advanceCareAdmission(tenant, role, original, status, status === 'active' ? '' : reason.trim()), text, after);
    } else {
      const original = data.tasks.find(row => row.id === action.id);
      if (!original) return;
      const status = action.status;
      void run(() => saveCareTask(tenant, role, { status, resolution: reason.trim() }, original),
        status === 'done' ? 'Aufgabe als erledigt gespeichert.' : 'Aufgabe abgesagt.', after);
    }
  }
  function choose(rowId: string) {
    if (busy || !current()) return;
    setSelected(selected === rowId ? null : rowId); setAction(null); setReason('');
  }
  const clearCase = () => {
    if (current() && !busy) router.replace(operationRoutes[area] as never);
  };
  const header = <View style={styles.actions}>
    {(['admissions', 'tasks', 'tariffs'] as const).filter(key => key !== area && canReadArea(key, permissions)).map(key =>
      <PremiumButton key={key} title={titles[key]} variant="secondary" size="sm" disabled={busy || !!editor} onPress={() => open(key)} />)}
    {clientId ? <PremiumButton title="Alle Pflegefälle anzeigen" variant="secondary" size="sm" disabled={busy || !!editor} onPress={clearCase} /> : null}
  </View>;

  if (!caseKnown) return <ScreenShell title={titles[area]} subtitle={subtitles[area]}><View style={styles.stack}>
    {clients.loading || clients.refreshing ? <LoadingState presentation="inline" message="Pflegefall wird geprüft…" /> : <>
      <ErrorState presentation="inline" message={clients.error || clients.refreshError ? 'Der verknüpfte Pflegefall konnte nicht geprüft werden.' : 'Der verknüpfte Pflegefall ist in der aktuellen Liste nicht verfügbar.'} onRetry={clients.refresh} />
      <PremiumButton title="Übersicht öffnen" variant="secondary" onPress={clearCase} />
    </>}
  </View></ScreenShell>;
  if (!data) return <ScreenShell title={titles[area]} subtitle={subtitles[area]}><View style={styles.stack}>
    {header}
    {queue.loading || queue.refreshing ? <LoadingState presentation="inline" message="Vorgänge werden geladen…" /> : <ErrorState presentation="inline" message={queue.error ?? 'Vorgänge konnten nicht geladen werden.'} onRetry={refresh} />}
  </View></ScreenShell>;

  const banner = feedback ? <InfoBanner presentation="inline" variant={feedback.error ? 'error' : 'success'} message={feedback.text} /> : null;
  const showCase = canShowDesktopCatalogRoute('/pflege/klienten', permissions);
  const shouldHideCreate = area === 'admissions' && !!clientId && data.admissions.some(row => row.status !== 'closed');
  const chooseFilter = () => { setLimit(pageSize); setSelected(null); setAction(null); };
  const actionPanel = action && action.id === selected && !editor ? <SectionPanel title={operationActionTitle(action, data.admissions)} subtitle="Bitte prüfen Sie die Angaben für diesen Vorgang.">
    {action.kind === 'task' || action.status !== 'active' ? <PremiumInput label={action.kind === 'admission' ? 'Begründung *' : action.status === 'done' ? 'Ergebnis *' : 'Absagegrund *'}
      value={reason} onChangeText={setReason} editable={!busy} multiline /> : null}
    {feedback?.error ? banner : null}
    <View style={styles.actions}>
      <PremiumButton title={operationActionTitle(action, data.admissions)} loading={busy} disabled={!writesEnabled || busy || (action.kind === 'task' || action.status !== 'active') && !reason.trim()} onPress={confirm} />
      <PremiumButton title="Zurück" variant="secondary" disabled={busy} onPress={() => { setAction(null); setFeedback(null); }} />
    </View>
  </SectionPanel> : null;

  return <ScreenShell title={titles[area]} subtitle={subtitles[area]}
    rightSlot={<PremiumButton title="Aktualisieren" size="sm" variant="secondary" loading={queue.refreshing} disabled={busy} onPress={refresh} />}>
    <View style={styles.stack}>
      {header}
      {clientId ? <InfoBanner presentation="inline" variant="info" title="Auf einen Pflegefall gefiltert" message={caseName(clientId)} /> : null}
      {queue.refreshError ? <InfoBanner presentation="inline" variant="warning" title="Aktualisierung fehlgeschlagen" message="Sie sehen den zuletzt geladenen Stand. Änderungen sind bis zur nächsten erfolgreichen Aktualisierung gesperrt." /> : null}
      {area !== 'tariffs' && (clients.error || clients.refreshError || (clients.data?.length ?? 0) >= 1000) ? <InfoBanner presentation="inline" variant="warning" title="Pflegefallnamen teilweise nicht verfügbar"
        message="Die Vorgangsliste kann trotzdem angezeigt werden. Bei einer Zuordnung sind nur aktuell geladene Pflegefälle auswählbar." /> : null}
      {!editor && !action ? banner : null}
      <SectionPanel title={area === 'admissions' ? 'Aufnahmevorgänge' : area === 'tasks' ? 'Aufgabenbestand' : 'Leistungskatalog'} subtitle={`${total} passende Einträge`}>
        <View style={styles.fields}>
          <View style={styles.column}><PremiumInput label={area === 'admissions' ? 'Pflegefall oder Kostenträger suchen' : area === 'tasks' ? 'Aufgabe, Pflegefall oder Zuständigkeit suchen' : 'Leistungscode oder Bezeichnung suchen'}
            value={search} onChangeText={value => { setSearch(value); chooseFilter(); }} editable={!busy && !editor} /></View>
          {canWrite() && !editor && !shouldHideCreate ? <PremiumButton title={newTitles[area]} disabled={!writesEnabled || busy} onPress={() => startEditor()} /> : null}
        </View>
        {area === 'admissions' ? <FilterChipGroup<AdmissionFilter> wrap options={[...admissionFilters]} value={admissionFilter}
          onChange={busy || editor ? undefined : value => { setAdmissionFilter(value); chooseFilter(); }} /> : null}
        {area === 'tasks' ? <FilterChipGroup<TaskFilter> wrap options={[...taskFilters]} value={taskFilter}
          onChange={busy || editor ? undefined : value => { setTaskFilter(value); chooseFilter(); }} /> : null}
      </SectionPanel>
      {editor ? <SectionPanel title={editor.kind === 'admission' && editor.original ? 'Aufnahmeentwurf bearbeiten' : newTitles[area]}>
        {editor.kind !== 'tariff' ? clientId || editor.kind === 'admission' && editor.original ? <Copy>{`Pflegefall: ${caseName(editor.kind === 'admission' ? admission.clientId : task.clientId)}`}</Copy>
          : <CareClientPicker label="Pflegefall" noSelectionLabel="Betriebsorganisation (ohne Pflegefall)" options={clientOptions} value={editor.kind === 'admission' ? admission.clientId : task.clientId}
            onChange={id => editor.kind === 'admission' ? setAdmission(value => ({ ...value, clientId: id })) : setTask(value => ({ ...value, clientId: id }))}
            disabled={busy || clients.loading || !!clients.error || !!clients.refreshError} optional={editor.kind === 'task'} /> : null}
        {editor.kind === 'admission' ? <AdmissionFields value={admission} onChange={setAdmission} disabled={busy} /> : null}
        {editor.kind === 'tariff' ? <TariffFields value={tariff} onChange={setTariff} price={price} onPrice={setPrice} disabled={busy} /> : null}
        {editor.kind === 'task' ? <>
          <PremiumInput label="Aufgabentitel *" value={task.title} onChangeText={title => setTask(value => ({ ...value, title }))} editable={!busy} />
          <PremiumInput label="Beschreibung" value={task.description} onChangeText={description => setTask(value => ({ ...value, description }))} editable={!busy} multiline />
          <View style={styles.fields}>
            <View style={styles.column}><PremiumInput label="Fällig am (JJJJ-MM-TT) *" value={task.dueOn} onChangeText={dueOn => setTask(value => ({ ...value, dueOn }))} editable={!busy} /></View>
            <View style={styles.column}><Copy>Priorität</Copy><FilterChipGroup wrap value={task.priority} options={[{ key: 'normal', label: 'Normal' }, { key: 'urgent', label: 'Dringend' }]}
              onChange={busy ? undefined : (priority: CareTask['priority']) => setTask(value => ({ ...value, priority }))} /></View>
          </View>
          {staff.loading ? <LoadingState presentation="inline" message="Zuständigkeiten werden geladen…" /> : null}
          {staff.error || staff.refreshError ? <InfoBanner presentation="inline" variant="warning" message="Aktive Pflegekräfte sind derzeit nicht verfügbar. Aufgaben können ohne Zuständigkeit gespeichert werden." /> : null}
          <CareClientPicker label="Verantwortliche Pflegekraft" noSelectionLabel="Ohne Zuständigkeit" options={staffOptions} value={task.assignedEmployeeId}
            onChange={assignedEmployeeId => setTask(value => ({ ...value, assignedEmployeeId }))} disabled={busy} optional />
        </> : null}
        {banner}
        <View style={styles.actions}><PremiumButton title={editor.kind === 'admission' ? 'Entwurf speichern' : editor.kind === 'task' ? 'Aufgabe speichern' : 'Tarifversion speichern'} loading={busy} disabled={!writesEnabled || busy} onPress={save} />
          <PremiumButton title="Formular schließen" variant="secondary" disabled={busy} onPress={() => { setEditor(null); setFeedback(null); }} /></View>
      </SectionPanel> : null}
      {!total ? <EmptyState title={data.admissions.length || data.tasks.length || data.tariffs.length ? 'Keine passenden Einträge' : 'Noch keine Vorgänge'}
        message={clientId && !data.admissions.length && !data.tasks.length ? 'Für diesen Pflegefall sind in diesem Bereich noch keine Vorgänge vorhanden.' : 'Mit einem anderen Filter oder Suchbegriff finden Sie weitere Einträge.'}
        actionLabel={search || taskFilter !== 'all' && area === 'tasks' || admissionFilter !== 'all' && area === 'admissions' ? 'Suche und Filter zurücksetzen' : undefined} onAction={resetFilters} /> : null}
      {area === 'admissions' ? admissions.slice(0, limit).map(row => {
        const expanded = selected === row.id && !editor;
        const blockers = row.status === 'draft' || row.status === 'paused' ? admissionBlockers(row) : [];
        const stateLabel = row.status === 'draft' ? blockers.length ? 'Entwurf · Angaben fehlen' : 'Entwurf · freigabebereit' : admissionLabels[row.status];
        return <QueueRecord key={row.id} title={caseName(row.clientId)} summary={`${stateLabel} · ${basisLabels[row.basis]} · ab ${dueText(row.startsOn)}`}
          expanded={expanded} toggle={() => choose(row.id)} disabled={busy || !!editor}>
          <View style={styles.fields}>
            <View style={styles.column}><Copy strong>Kostenträger und Zeitraum</Copy><Copy>{row.payerName || 'Kein Kostenträger hinterlegt'}{row.payerIk ? ` · IK ${row.payerIk}` : ''}</Copy><Copy>{dueText(row.startsOn)}{row.endsOn ? ` bis ${dueText(row.endsOn)}` : ' · ohne Enddatum'}</Copy></View>
            <View style={styles.column}><Copy strong>Vertrag und Kosteninformation</Copy><Copy>Pflegevertrag: {row.contractReference || 'fehlt'}</Copy><Copy>Kosteninformation: {row.costInformationReference || 'fehlt'}</Copy></View>
          </View>
          {row.emergencyContact ? <Copy>Notfallkontakt: {row.emergencyContact}</Copy> : null}
          {row.accessNotes ? <Copy>Zugangshinweis: {row.accessNotes}</Copy> : null}
          {row.notes ? <Copy>Aufnahmehinweise: {row.notes}</Copy> : null}
          {blockers.length ? <InfoBanner presentation="inline" variant="warning" title="Vor Freigabe erforderlich" message={blockers.join('\n')} /> : null}
          <View style={styles.actions}>
            {showCase ? <PremiumButton title="Pflegeakte öffnen" variant="secondary" size="sm" disabled={busy} onPress={() => openClient(row.clientId)} /> : null}
            {writesEnabled && row.status === 'draft' ? <PremiumButton title="Entwurf bearbeiten" size="sm" disabled={busy} onPress={() => startEditor(row)} /> : null}
            {writesEnabled && (row.status === 'draft' || row.status === 'paused') && !blockers.length ? <PremiumButton title={row.status === 'paused' ? 'Versorgung fortsetzen' : 'Versorgung freigeben'}
              size="sm" disabled={busy} onPress={() => startAction({ kind: 'admission', id: row.id, status: 'active', version: row.updatedAt })} /> : null}
            {writesEnabled && row.status === 'active' ? <PremiumButton title="Versorgung pausieren" variant="secondary" size="sm" disabled={busy}
              onPress={() => startAction({ kind: 'admission', id: row.id, status: 'paused', version: row.updatedAt })} /> : null}
            {writesEnabled && row.status !== 'closed' ? <PremiumButton title="Versorgung beenden" variant="secondary" size="sm" disabled={busy}
              onPress={() => startAction({ kind: 'admission', id: row.id, status: 'closed', version: row.updatedAt })} /> : null}
          </View>
          {actionPanel}
        </QueueRecord>;
      }) : area === 'tasks' ? tasks.slice(0, limit).map(row => {
        const timing = row.status === 'open' && isCalendarDate(row.dueOn) ? row.dueOn < today ? 'Überfällig' : row.dueOn === today ? 'Heute fällig' : '' : '';
        const caseLabel = row.clientId ? caseName(row.clientId) : 'Betriebsorganisation';
        return <QueueRecord key={row.id} title={row.title} summary={`${[taskStatusLabels[row.status], dueText(row.dueOn), timing, row.priority === 'urgent' ? 'Dringend' : ''].filter(Boolean).join(' · ')}\n${caseLabel} · ${row.assignedEmployeeId ? employeeName(row.assignedEmployeeId) : 'Ohne Zuständigkeit'}`}
          expanded={selected === row.id && !editor} toggle={() => choose(row.id)} disabled={busy || !!editor}>
          {row.description ? <Copy>{row.description}</Copy> : <Copy>Keine Beschreibung hinterlegt.</Copy>}
          {row.resolution ? <Copy>{row.status === 'cancelled' ? 'Absagegrund: ' : 'Ergebnis: '}{row.resolution}</Copy> : null}
          <View style={styles.actions}>
            {showCase && row.clientId ? <PremiumButton title="Pflegeakte öffnen" variant="secondary" size="sm" disabled={busy} onPress={() => openClient(row.clientId)} /> : null}
            {writesEnabled && row.status === 'open' ? <><PremiumButton title="Ergebnis dokumentieren" size="sm" disabled={busy}
              onPress={() => startAction({ kind: 'task', id: row.id, status: 'done', version: row.updatedAt })} />
              <PremiumButton title="Absage dokumentieren" variant="secondary" size="sm" disabled={busy}
                onPress={() => startAction({ kind: 'task', id: row.id, status: 'cancelled', version: row.updatedAt })} /></> : null}
          </View>
          {actionPanel}
        </QueueRecord>;
      }) : tariffs.slice(0, limit).map(row => <SectionPanel key={row.id} title={`${row.code} · ${row.label}`} subtitle={`${basisLabels[row.basis]} · ${(row.unitPriceCents / 100).toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})} je ${tariffUnits[row.unit]}`}>
        <Copy>{dueText(row.validFrom)}{row.validUntil ? ` bis ${dueText(row.validUntil)}` : ' · ohne Enddatum'} · {row.payerIk ? `IK ${row.payerIk}` : 'Alle Kostenträger'}</Copy>
        <Copy>Preisgrundlage: {row.agreementReference}</Copy>
      </SectionPanel>)}
      {total > limit ? <PremiumButton title={`Weitere Einträge anzeigen (${total - limit})`} variant="secondary" onPress={() => setLimit(value => value + pageSize)} /> : null}
    </View>
  </ScreenShell>;
}

function operationActionTitle(action: OperationAction, admissions: CareAdmission[]) {
  if (action.kind === 'task') return action.status === 'done' ? 'Aufgabe als erledigt speichern' : 'Aufgabe absagen';
  if (action.status === 'paused') return 'Versorgung pausieren';
  if (action.status === 'closed') return 'Versorgung beenden';
  return admissions.find(row => row.id === action.id)?.status === 'paused' ? 'Versorgung fortsetzen' : 'Versorgung freigeben';
}

function Copy({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  const { c } = useCareLightPalette();
  return <Text style={[strong ? typography.bodyStrong : typography.body, { color: strong ? c.text : c.muted }]}>{children}</Text>;
}

function QueueRecord({ title, summary, expanded, disabled, toggle, children }: { title: string; summary: string; expanded: boolean; disabled: boolean; toggle(): void; children: React.ReactNode }) {
  const { c } = useCareLightPalette();
  return <SectionPanel title={title} subtitle={summary}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${expanded ? 'Details schließen' : 'Details öffnen'}: ${title}`}
      accessibilityState={{ expanded, disabled }} aria-expanded={expanded} disabled={disabled} onPress={toggle}
      style={({ pressed }) => [styles.disclosure, { borderColor: c.border, backgroundColor: c.surfaceAlt, opacity: pressed || disabled ? .68 : 1 }]}>
      <Text style={[typography.bodyStrong, { color: c.text }]}>{expanded ? 'Details schließen' : 'Details öffnen'}</Text>
    </Pressable>
    {expanded ? <View style={styles.detail}>{children}</View> : null}
  </SectionPanel>;
}

type AdmissionForm = ReturnType<typeof blankAdmission>;
type TariffForm = ReturnType<typeof blankTariff>;
function AdmissionFields({ value, onChange, disabled }: { value: AdmissionForm; onChange(value: AdmissionForm): void; disabled: boolean }) {
  const set = (key: Exclude<keyof AdmissionForm, 'basis'>, text: string) => onChange({ ...value, [key]: text });
  const input = (key: Exclude<keyof AdmissionForm, 'basis'>, label: string, multiline = false) =>
    <PremiumInput key={key} label={label} value={value[key]} onChangeText={text => set(key, text)} editable={!disabled} multiline={multiline} />;
  return <>
    <Copy strong>Versorgungszeitraum und Finanzierung</Copy>
    <View style={styles.fields}><View style={styles.column}>{input('startsOn', 'Versorgungsbeginn (JJJJ-MM-TT) *')}</View>
      <View style={styles.column}>{input('endsOn', 'Versorgungsende (optional)')}</View></View>
    <BasisPicker value={value.basis} onChange={basis => onChange({ ...value, basis })} disabled={disabled} />
    <View style={styles.fields}><View style={styles.column}>{input('payerName', 'Kostenträger')}</View>
      <View style={styles.column}>{input('payerIk', 'Kostenträger-IK (9 Ziffern)')}</View></View>
    <Copy strong>Unterlagen zur Freigabe</Copy>
    {input('contractReference', 'Pflegevertrag / Dokumentreferenz')}
    {input('costInformationReference', 'Kosteninformation / Dokumentreferenz')}
    {input('consentReference', 'Datenschutzinformation / ggf. Einwilligungsnachweis')}
    <Copy>Geben Sie vorhandene Dokumente an. Für den Entwurf dürfen Unterlagen noch fehlen.</Copy>
    <Copy strong>Kontakt und Aufnahmehinweise</Copy>
    {input('emergencyContact', 'Notfallkontakt')}{input('accessNotes', 'Zugang zur Wohnung / Schlüsselhinweis', true)}{input('notes', 'Aufnahmehinweise', true)}
  </>;
}

function TariffFields({ value, onChange, price, onPrice, disabled }: { value: TariffForm; onChange(value: TariffForm): void; price: string; onPrice: (text: string) => void; disabled: boolean }) {
  const input = (key: Exclude<keyof TariffForm, 'basis' | 'unit'>, label: string) =>
    <PremiumInput key={key} label={label} value={value[key]} onChangeText={text => onChange({ ...value, [key]: text })} editable={!disabled} />;
  return <>
    {input('code', 'Leistungscode *')}{input('label', 'Leistungsbezeichnung *')}
    <BasisPicker value={value.basis} onChange={basis => onChange({ ...value, basis })} disabled={disabled} />
    <FilterChipGroup<CareTariff['unit']> wrap value={value.unit} options={(Object.keys(tariffUnits) as CareTariff['unit'][]).map(key => ({ key, label: tariffUnits[key] }))}
      onChange={disabled ? undefined : unit => onChange({ ...value, unit })} />
    <PremiumInput label="Preis je Einheit in Euro *" value={price} onChangeText={onPrice} keyboardType="decimal-pad" editable={!disabled} />
    <View style={styles.fields}><View style={styles.column}>{input('validFrom', 'Gültig ab (JJJJ-MM-TT) *')}</View><View style={styles.column}>{input('validUntil', 'Gültig bis (optional)')}</View></View>
    {input('payerIk', 'Kostenträger-IK (leer = alle)')}{input('agreementReference', 'Vergütungsvereinbarung / Preisgrundlage *')}
    <Copy>Tarife werden als unveränderliche Versionen angelegt.</Copy>
  </>;
}
function BasisPicker({ value, onChange, disabled }: { value: FundingBasis; onChange: (v: FundingBasis) => void; disabled: boolean }) {
  return <FilterChipGroup<FundingBasis> wrap value={value} options={(Object.keys(basisLabels) as FundingBasis[]).map(key => ({ key, label: basisLabels[key] }))}
    onChange={disabled ? undefined : onChange} />;
}

export function CareClientPicker({ options, value, onChange, disabled, optional, label = 'Klient:in', noSelectionLabel = 'Ohne Zuordnung' }: {
  options: PickerOption[]; value: string; onChange: (id: string) => void; disabled?: boolean; optional?: boolean; label?: string; noSelectionLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(12);
  const selected = options.find(option => option.id === value);
  const filtered = options.filter(option => matchesOperationSearch(search, option.label));
  return <View style={styles.detail}>
    <Copy strong>{selected ? `Ausgewählt: ${selected.label}` : `${label} auswählen`}</Copy>
    <PremiumInput label={`${label} suchen`} value={search} onChangeText={text => { setSearch(text); setLimit(12); }} editable={!disabled} />
    <View style={styles.actions}>
      {optional ? <PremiumButton title={noSelectionLabel} variant={!value ? 'primary' : 'secondary'} disabled={disabled} size="sm" onPress={() => onChange('')} /> : null}
      {filtered.slice(0, limit).map(option => <PremiumButton key={option.id} title={option.label} variant={option.id === value ? 'primary' : 'secondary'} disabled={disabled} size="sm" onPress={() => onChange(option.id)} />)}
    </View>
    {search.trim() && !filtered.length ? <Copy>Keine Treffer für diese Suche.</Copy> : null}
    {filtered.length > limit ? <PremiumButton title="Weitere Treffer anzeigen" variant="secondary" disabled={disabled} size="sm" onPress={() => setLimit(amount => amount + 12)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, paddingBottom: spacing.xl },
  detail: { gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  fields: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.md },
  column: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0, gap: spacing.xs },
  disclosure: { alignSelf: 'flex-start', minHeight: 40, borderWidth: 1, borderRadius: radius.md, justifyContent: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
