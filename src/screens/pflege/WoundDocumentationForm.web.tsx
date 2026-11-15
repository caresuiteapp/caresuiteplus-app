import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumButton, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useCareRuntimePermissions as usePermissions } from '@/hooks/pflege/useCareRuntimePermissions.web';
import { CarePermissionStatus, type CarePermissionStatusState } from './CarePermissionStatus.web';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useMedicationSubmission } from '@/hooks/useMedicationSubmission.web';
import { MedicationEventTimeInput, currentMedicationEventTime, medicationEventInstant } from '@/components/pflege/MedicationEventTimeInput.web';
import { WoundCatalogPanel } from '@/components/pflege/wounds/WoundCatalogPanel';
import { useWoundEntryStyles } from '@/components/pflege/wounds/woundEntryStyles';
import { WoundBodyMapFrame } from '@/components/clinicalMedia/WoundBodyMapFrame';
import type { WoundBodyMark } from '@/components/clinicalMedia/WoundBodyMapFrame.types';
import { emptyWoundCase, emptyWoundAssessment, validateWoundRequest, type WoundRequest } from '@/lib/pflege/woundDocumentationDomain';
import { fetchWoundClients, fetchAmbulatoryWound, writeAmbulatoryWound } from '@/lib/pflege/ambulatoryWoundService';

type Mode = 'create' | 'assessment';
type FormSubmission = { request: WoundRequest; bodyMark?: WoundBodyMark };
const SIDES = [
  { key: 'left', label: 'Links' }, { key: 'right', label: 'Rechts' },
  { key: 'midline', label: 'Mittig' }, { key: 'bilateral', label: 'Beidseitig' },
  { key: 'not_applicable', label: 'Nicht anwendbar' },
];

export function WoundCreateScreen() { return <WoundFormBoundary mode="create" />; }
export function WoundAssessmentCreateScreen() { return <WoundFormBoundary mode="assessment" />; }

function WoundFormBoundary({ mode }: { mode: Mode }) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tenant = useServiceTenantId(), { profile } = useAuth(), permissions = usePermissions();
  return <WoundForm key={`${tenant}:${profile?.id}:${permissions.roleKey}:${id}:${mode}`} mode={mode}
    woundId={id ?? ''} tenant={tenant ?? ''} role={permissions.roleKey} canView={permissions.can('pflege.wounds.view')}
    canManage={permissions.can('pflege.wounds.manage')} permissionStatus={permissions} />;
}

function WoundForm({ mode, woundId, tenant, role, canView, canManage, permissionStatus }: {
  mode: Mode; woundId: string; tenant: string; role: ReturnType<typeof usePermissions>['roleKey'];
  canView: boolean; canManage: boolean; permissionStatus: CarePermissionStatusState;
}) {
  const { profile } = useAuth(), styles = useWoundEntryStyles(), router = useRouter();
  const catalogScope = { tenantId: tenant, actorId: profile?.id ?? '', role };
  const [clientId, setClientId] = useState(''), [confirmed, setConfirmed] = useState('');
  const selectedClientId = useRef(''), receipt = useRef('');
  const [observed, setObserved] = useState(currentMedicationEventTime), [review, setReview] = useState(currentMedicationEventTime);
  const [draft, setDraft] = useState<Record<string, string>>(() => mode === 'create' ? { ...emptyWoundCase() } : { ...emptyWoundAssessment() });
  const [bodyMark, setBodyMark] = useState<WoundBodyMark | null>(null);
  const [search, setSearch] = useState(''), [timeEdited, setTimeEdited] = useState(false);
  const clients = useAsyncQuery(() => fetchWoundClients(tenant, role), [tenant, role], {
    enabled: !!tenant && canView && mode === 'create', queryKey: `${tenant}:${role}:wound-clients`,
  });
  const wound = useAsyncQuery(() => fetchAmbulatoryWound(tenant, woundId, role), [tenant, woundId, role], {
    enabled: !!tenant && canView && mode === 'assessment', queryKey: `${tenant}:${role}:${woundId}:wound-form`,
  });
  const client = clients.data?.find(person => person.id === clientId);
  const matchingClients = (clients.data ?? []).filter(person =>
    person.name.toLocaleLowerCase('de').includes(search.trim().toLocaleLowerCase('de')));
  const dirty = timeEdited || !!clientId || Object.values(draft).some(Boolean);
  const write = useMedicationSubmission<FormSubmission>(dirty && !confirmed, async (id, { request, bodyMark: location }, replay) => {
    const result = await writeAmbulatoryWound(tenant, id, request, role, replay, location);
    if (result.ok) receipt.current = result.data.id;
    return result;
  }, () => setConfirmed(receipt.current));

  function change(key: string, value: string) {
    if (write.locked) return;
    if (key === 'bodyLocation' && bodyMark && value.trim() !== bodyMark.name) setBodyMark(null);
    setDraft(previous => {
      const next = { ...previous, [key]: value };
      for (const dimension of ['length', 'width', 'depth']) {
        if (key !== dimension + 'State') continue;
        next[dimension + 'Cm'] = '';
        next[dimension + 'Reason'] = '';
      }
      if (key === 'reviewStatus') next.reviewPendingReason = '';
      if (key === 'onsetDate' && value) next.onsetUnknownReason = '';
      if (key === 'painState') {
        next.painScore = '';
        next.painReason = '';
      }
      return next;
    });
  }

  function selectClient(id: string) {
    if (write.locked || clients.refreshError || !clients.data?.some(person => person.id === id)
      || id === selectedClientId.current) return;
    selectedClientId.current = id;
    setClientId(id);
    if (bodyMark) {
      setDraft(previous => ({ ...previous, bodyLocation: '', side: '' }));
      setBodyMark(null);
    }
  }

  const canPickLocation = !!client && !clients.refreshError && !write.locked;
  function applyLocation(mark: WoundBodyMark) {
    if (!canPickLocation || selectedClientId.current !== clientId) return;
    setBodyMark(mark);
    setDraft(previous => ({ ...previous, bodyLocation: mark.name, side: '' }));
  }

  const field = (key: string, label: string, multiline = true) => <PremiumInput key={key} label={label}
    accessibilityLabel={label} value={draft[key] ?? ''} onChangeText={value => change(key, value)}
    editable={!write.locked} maxLength={key === 'onsetDate' ? 10 : 2000} multiline={multiline} />;
  const chips = (key: string, options: { key: string; label: string }[]) =>
    <FilterChipGroup wrap options={options} value={draft[key] ?? ''} onChange={write.locked ? undefined : value => change(key, value)} />;
  const snippets = (kind: 'description' | 'treatment', fieldKey: string) => <WoundCatalogPanel scope={catalogScope}
    kind={kind} embedded edit={canManage} disabled={write.locked} onInsert={item => {
      const next = [draft[fieldKey]?.trim(), item.text].filter(Boolean).join('\n\n');
      if (next.length > 2000) {
        write.setError('Der Baustein passt nicht vollständig in das Feld.');
        return;
      }
      change(fieldKey, next);
    }} />;

  async function save() {
    if (write.uncertain) { await write.retry(); return; }
    if (mode === 'assessment' && (!wound.data || wound.refreshError
      || !['draft', 'active', 'healing', 'deteriorated'].includes(String(wound.data.row.status)))) {
      write.setError('Offenen Wundfall neu laden.');
      return;
    }
    if (mode === 'create' && (!client || clients.refreshError || selectedClientId.current !== clientId)) {
      write.setError('Aktiven Pflegefall ausdrücklich auswählen.');
      return;
    }
    const data = {
      ...draft,
      nextReviewAt: draft.reviewStatus === 'scheduled' ? medicationEventInstant(review) : '',
      ...(mode === 'assessment' ? { observedAt: medicationEventInstant(observed) } : {}),
    };
    const request: WoundRequest = { action: mode, subjectId: mode === 'create' ? clientId : woundId, dataJson: JSON.stringify(data) };
    const error = validateWoundRequest(request);
    if (error) { write.setError(error); return; }
    await write.submit({ request, ...(bodyMark ? { bodyMark } : {}) });
  }

  if (!canView || !canManage) return <ScreenShell title="Wunddokumentation">
    <CarePermissionStatus state={permissionStatus} deniedMessage="Lese- und Schreibberechtigung für Wunddokumentation erforderlich." />
  </ScreenShell>;
  if (confirmed) return <ScreenShell title="Wunddokumentation gespeichert">
    <View style={styles.content}>
      <SuccessState message={mode === 'create'
        ? 'Wundfall als Entwurf gespeichert. In der Wundakte findest du die Körperkarte, Vermessung, Fotos und den Verlauf.'
        : 'Eigenständiges Wundassessment gespeichert. Der bestehende Versorgungsplan und Fallstatus wurden dadurch nicht automatisch freigegeben oder geändert.'} />
      <View style={styles.actions}>
        <PremiumButton title="Wundakte öffnen" disabled={write.busy}
          onPress={() => router.replace(`/pflege/wunden/${mode === 'create' ? confirmed : woundId}` as never)} />
      </View>
    </View>
  </ScreenShell>;

  const control = <SectionPanel title="Nächste Wundkontrolle">
    {chips('reviewStatus', [{ key: 'scheduled', label: 'Termin vereinbart' }, { key: 'pending', label: 'Abstimmung offen' }])}
    {draft.reviewStatus === 'pending' && field('reviewPendingReason', 'Grund oder weiterer Abstimmungsbedarf *')}
    {draft.reviewStatus === 'scheduled' && <MedicationEventTimeInput label="Vereinbarter Kontrolltermin"
      value={review} disabled={write.locked} onChange={value => { setReview(value); setTimeEdited(true); }} />}
  </SectionPanel>;

  return <ScreenShell title={mode === 'create' ? 'Wundfall anlegen' : 'Wundassessment dokumentieren'}
    subtitle={wound.data ? `${wound.data.clientName} · ${String(wound.data.row.body_location)}` : undefined} compactHeader>
    <View style={styles.content}>
      {write.uncertain && <InfoBanner variant="warning" message="Speicherergebnis unklar. Dieselbe unveränderte Anfrage erneut prüfen. Angaben und Schließen bleiben bis zur Klärung gesperrt." />}
      {mode === 'create' ? <>
        <View style={styles.columns}>
          <View style={[styles.panel, styles.mainColumn]}>
            <Text accessibilityRole="header" style={styles.title}>Pflegeakte und Lokalisation</Text>
            <View style={styles.stack}>
              <PremiumInput label="Pflegeklient:innen suchen" value={search} onChangeText={setSearch} editable={!write.locked} />
              {clients.loading && !clients.data ? <LoadingState message="Pflegeakten werden geladen …" />
                : clients.error ? <ErrorState message={clients.error} onRetry={clients.refresh} />
                  : matchingClients.length ? <FilterChipGroup wrap options={matchingClients.map(person => ({ key: person.id, label: person.name }))}
                    value={clientId} onChange={write.locked ? undefined : selectClient} />
                    : <Text style={styles.muted}>{clients.data?.length ? 'Keine Pflegeakte für diese Suche.' : 'Keine aktiven Pflegeakten verfügbar.'}</Text>}
              {clients.refreshError && <ErrorState message={clients.refreshError} onRetry={clients.refresh} />}
              {client && <Text style={styles.muted} accessibilityLiveRegion="polite">Ausgewählte Pflegeakte · {client.name}</Text>}
            </View>
            {field('bodyLocation', 'Genaue Lokalisation *', false)}
            <View style={styles.stack}>
              <Text style={styles.body}>Körperseite *</Text>
              {chips('side', SIDES)}
            </View>
            {bodyMark && <View style={styles.toolbar}>
              <Text style={styles.muted} accessibilityLiveRegion="polite">3D-Markierung übernommen</Text>
              <PremiumButton title="3D-Punkt entfernen" variant="ghost" size="sm" disabled={write.locked} onPress={() => setBodyMark(null)} />
            </View>}
          </View>
          <View style={[styles.panel, styles.mapColumn]}>
            <Text accessibilityRole="header" style={styles.title}>3D-Körperkarte</Text>
            <Text style={styles.muted}>{client
              ? 'Körperstelle auf der Figur wählen und anschließend die Körperseite bestätigen.'
              : 'Wähle eine Pflegeakte aus, um die Körperstelle an der Figur zu markieren.'}</Text>
            <WoundBodyMapFrame key={clientId || 'unassigned'} view="location" figure="adult-man" canWrite={canPickLocation}
              marks={bodyMark ? [{ ...bodyMark, id: 'pending-location' }] : undefined} onMark={applyLocation} />
          </View>
        </View>
        <View style={styles.columns}>
          <View style={styles.formColumn}>
            <SectionPanel title="Wundbefund">
              {field('woundType', 'Wundart oder Klärungsstand *', false)}
              {field('etiology', 'Bekannte Ursache oder Klärungsstand *')}
              {field('acquiredWhere', 'Ort und Umstände der Entstehung oder Kenntnisstand *')}
              {field('onsetDate', 'Entstehungsdatum (JJJJ-MM-TT)', false)}
              {!draft.onsetDate && field('onsetUnknownReason', 'Kenntnisstand bei unbekanntem Entstehungsdatum *')}
              {field('description', 'Beschreibung der Wundsituation *')}
              {snippets('description', 'description')}
            </SectionPanel>
          </View>
          <View style={styles.formColumn}>
            <SectionPanel title="Geplante Versorgung">
              {chips('basisStatus', [
                { key: 'documented', label: 'Ärztliche Grundlage dokumentiert' },
                { key: 'pending', label: 'Klärung offen' },
                { key: 'not_required', label: 'Nicht erforderlich' },
              ])}
              {field('basisReference', 'Anordnungsbezug, Klärungsstand oder Begründung *')}
              {field('physician', draft.basisStatus === 'documented' ? 'Anordnende ärztliche Person *' : 'Anordnende ärztliche Person', false)}
              {field('carePlan', 'Geplante Versorgung')}
              {snippets('treatment', 'carePlan')}
            </SectionPanel>
            {control}
          </View>
        </View>
      </> : <>
        {wound.loading && !wound.data ? <LoadingState message="Wundfall und vorhandener Verlauf werden geladen …" />
          : wound.error ? <ErrorState message={wound.error} onRetry={wound.refresh} /> : null}
        {wound.refreshError && <ErrorState message={wound.refreshError} onRetry={wound.refresh} />}
        <SectionPanel title="Tatsächlich erhobene Wundsituation">
          <MedicationEventTimeInput label="Tatsächlicher Assessmentzeitpunkt" value={observed} disabled={write.locked}
            onChange={value => { setObserved(value); setTimeEdited(true); }} />
          {field('measurementMethod', 'Verwendete Messmethode / Einschränkungen *')}
          {(['length', 'width', 'depth'] as const).map((key, index) => <View key={key} style={styles.stack}>
            <Text style={styles.body}>{['Länge', 'Breite', 'Tiefe'][index]}</Text>
            {chips(key + 'State', [{ key: 'measured', label: 'Tatsächlich gemessen' }, { key: 'not_measurable', label: 'Nicht messbar' }])}
            {draft[key + 'State'] === 'measured' ? field(key + 'Cm', 'Tatsächlich gemessener Wert in cm', false)
              : field(key + 'Reason', 'Falls nicht messbar: tatsächlicher Grund')}
          </View>)}
          {field('woundBed', 'Wundbett / Beurteilbarkeit *')}{snippets('description', 'woundBed')}
          {field('exudate', 'Exsudat / tatsächliche Beurteilung *')}{field('odor', 'Geruch / tatsächliche Beurteilung *')}
          {field('woundEdge', 'Wundrand / Beurteilbarkeit *')}{field('surroundingSkin', 'Wundumgebung / Beurteilbarkeit *')}
          {field('infectionObservation', 'Tatsächliche Infektionsbeobachtungen / Beurteilbarkeit *')}
        </SectionPanel>
        <SectionPanel title="Schmerz und persönliche Situation">
          {chips('painState', [{ key: 'NRS', label: 'NRS 0–10 tatsächlich erhoben' }, { key: 'not_assessable', label: 'Nicht beurteilbar' }])}
          {draft.painState === 'NRS' ? field('painScore', 'Erhobener ganzzahliger NRS-Wert 0–10', false)
            : field('painReason', 'Tatsächlicher Grund für fehlende Schmerzerhebung')}
          {field('personalImpact', 'Wund-/therapiebedingte Auswirkungen auf Alltag und Wohlbefinden *')}
          {field('preferences', 'Wünsche / Entscheidungen der Person bzw. tatsächliche Erhebungsgrenze *')}
          {field('selfManagement', 'Vorhandene Ressourcen und Unterstützungsbedarf *')}
        </SectionPanel>
        <SectionPanel title="Tatsächliche Reaktion und Ergebnis">
          {field('actualAction', 'Tatsächliche Reaktion / ausdrücklich keine Handlung mit Begründung *')}
          {snippets('treatment', 'actualAction')}{field('response', 'Beobachtetes Ergebnis / ausstehende Rückmeldung *')}
          <InfoBanner variant="info" message="Eine Beobachtung ist keine automatische Infektionsdiagnose. Verbandwechsel, Anordnungsänderung, Fallabschluss und Eskalationsabschluss werden nicht aus diesem Assessment abgeleitet." />
        </SectionPanel>
        {control}
      </>}
      {write.error && <ErrorState message={write.error} />}
      <View style={styles.actions}>
        <PremiumButton title={write.busy ? 'Wunddokumentation wird gespeichert …' : write.uncertain ? 'Dieselbe Anfrage erneut prüfen'
          : mode === 'create' ? 'Entwurf speichern' : 'Wundassessment speichern'} disabled={write.busy} onPress={save} />
        <PremiumButton title="Schließen" variant="secondary" disabled={write.locked}
          onPress={async () => { if (await write.confirmLeave()) router.back(); }} />
      </View>
    </View>
  </ScreenShell>;
}
