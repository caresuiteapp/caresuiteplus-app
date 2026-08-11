import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { ClientAnimalAvatar } from '@/components/clients/ClientAnimalAvatar';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { fetchClientModuleAssignments } from '@/lib/officeModules/moduleAssignmentService';
import type { ClientModuleAssignment } from '@/lib/officeCore/types';
import type { ClientListItem } from '@/types/modules/office';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import type { RoleKey } from '@/types';
import {
  LiquidButton,
  LiquidField,
  LiquidMetric,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace, type LiquidSemanticTone } from '../foundation/tokens';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';

type AssistClientFilter = 'all' | 'attention' | 'planned' | 'unplanned';

type AssistClientContext = {
  assignment: ClientModuleAssignment;
  client: ClientListItem | null;
  visits: VisitDispositionListItem[];
  upcomingVisits: VisitDispositionListItem[];
  needsAttention: boolean;
};

type AssistClientsWorkspaceProps = {
  tenantId: string;
  roleKey: RoleKey | null;
  clients: ClientListItem[];
  visits: VisitDispositionListItem[];
  loading: boolean;
  dataError?: string | null;
  onReload: () => Promise<void>;
};

const TERMINAL_VISIT_STATUSES = new Set(['abgeschlossen', 'storniert', 'cancelled', 'no_show', 'completed']);

function normalizeStatus(value: string | null | undefined): string {
  if (!value) return 'Offen';
  const normalized = value.toLowerCase();
  const labels: Record<string, string> = {
    active: 'Aktiv',
    aktiv: 'Aktiv',
    approved: 'Freigegeben',
    draft: 'Entwurf',
    entwurf: 'Entwurf',
    inactive: 'Inaktiv',
    archived: 'Archiviert',
    geplant: 'Geplant',
    bestaetigt: 'Bestätigt',
    confirmed: 'Bestätigt',
  };
  return labels[normalized] ?? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(value: string | null | undefined): LiquidSemanticTone {
  const normalized = (value ?? '').toLowerCase();
  if (/(gesperrt|inaktiv|archiv|storniert|fehler)/.test(normalized)) return 'danger';
  if (/(entwurf|offen|prüfung|unvollständig)/.test(normalized)) return 'warning';
  if (/(aktiv|freigegeben|approved|bestätigt)/.test(normalized)) return 'success';
  return 'neutral';
}

function resolveClientCareStatus(context: AssistClientContext): {
  label: string;
  tone: LiquidSemanticTone;
} {
  const technicalTone = statusTone(context.assignment.status);
  if (technicalTone === 'danger') {
    return {
      label: normalizeStatus(context.assignment.status),
      tone: technicalTone,
    };
  }
  if (context.needsAttention) return { label: 'Klärungsbedarf', tone: 'warning' };
  if (context.upcomingVisits.length === 0) return { label: 'Planung offen', tone: 'warning' };
  return { label: 'Aktiv', tone: 'success' };
}

function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return 'Nicht hinterlegt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

function isUpcomingVisit(visit: VisitDispositionListItem, now: number): boolean {
  const status = String(visit.assignmentStatus || visit.status).toLowerCase();
  return new Date(visit.scheduledEnd).getTime() >= now && !TERMINAL_VISIT_STATUSES.has(status);
}

function buildClientContexts(
  assignments: ClientModuleAssignment[],
  clients: ClientListItem[],
  visits: VisitDispositionListItem[],
): AssistClientContext[] {
  const now = Date.now();
  const clientMap = new Map(clients.map((client) => [client.id, client]));
  const assignmentsByClient = new Map<string, ClientModuleAssignment>();

  for (const assignment of assignments) {
    const existing = assignmentsByClient.get(assignment.clientId);
    if (
      !existing
      || assignment.updatedAt > existing.updatedAt
      || (statusTone(assignment.status) === 'success' && statusTone(existing.status) !== 'success')
    ) {
      assignmentsByClient.set(assignment.clientId, assignment);
    }
  }

  return [...assignmentsByClient.values()]
    .map((assignment) => {
      const client = clientMap.get(assignment.clientId) ?? null;
      const clientVisits = visits
        .filter((visit) => visit.clientId === assignment.clientId)
        .sort((left, right) => left.scheduledStart.localeCompare(right.scheduledStart));
      const upcomingVisits = clientVisits.filter((visit) => isUpcomingVisit(visit, now));
      const needsAttention = !client
        || !client.careLevel
        || !client.costCarrier
        || !(client.street && client.zip && client.city);

      return { assignment, client, visits: clientVisits, upcomingVisits, needsAttention };
    })
    .sort((left, right) => left.assignment.clientName.localeCompare(right.assignment.clientName, 'de'));
}

function AssistClientDetail({ context }: { context: AssistClientContext | null }) {
  const router = useRouter();

  if (!context) {
    return (
      <LiquidSurface solid contentStyle={styles.detailCard}>
        <LiquidText variant="kicker">VERSORGUNGSKONTEXT</LiquidText>
        <LiquidText variant="section">Klient:in auswählen</LiquidText>
        <LiquidText variant="meta">
          Öffnen Sie eine Person, um Pflegegrad, Kostenträger, zuständige Mitarbeitende,
          kommende Einsätze und die direkten Assist-Aktionen zu sehen.
        </LiquidText>
      </LiquidSurface>
    );
  }

  const { assignment, client, upcomingVisits } = context;
  const careStatus = resolveClientCareStatus(context);
  const clientId = assignment.clientId;
  const nextVisits = upcomingVisits.slice(0, 3);
  const careLevelLabel = formatCareLevel(client?.careLevel) || 'Nicht hinterlegt';

  return (
    <LiquidSurface active contentStyle={styles.detailCard}>
      <View style={styles.detailIdentity}>
        <ClientAnimalAvatar
          clientId={assignment.clientId}
          clientName={assignment.clientName}
          size={58}
        />
        <View style={styles.detailIdentityText}>
          <LiquidText variant="kicker">ASSIST-KLIENT:IN</LiquidText>
          <LiquidText variant="section">{assignment.clientName}</LiquidText>
          <LiquidStatus label={careStatus.label} tone={careStatus.tone} />
        </View>
      </View>

      {context.needsAttention ? (
        <View style={styles.attentionBanner}>
          <Text style={styles.attentionTitle}>Stammdaten prüfen</Text>
          <Text style={styles.attentionText}>
            Pflegegrad, Kostenträger oder vollständige Einsatzadresse fehlen.
          </Text>
        </View>
      ) : null}

      <View style={styles.factGrid}>
        <View style={[styles.factBox, styles.factBoxCompact]}>
          <Text style={styles.factLabel}>Pflegegrad</Text>
          <Text style={styles.factValue}>{careLevelLabel}</Text>
        </View>
        <View style={[styles.factBox, styles.factBoxCompact]}>
          <Text style={styles.factLabel}>Geburtsdatum</Text>
          <Text style={styles.factValue}>{formatDate(client?.dateOfBirth)}</Text>
        </View>
        <View style={[styles.factBox, styles.factBoxWide]}>
          <Text style={styles.factLabel}>Kostenträger</Text>
          <Text style={styles.factValue}>{client?.costCarrier || 'Nicht hinterlegt'}</Text>
        </View>
        <View style={[styles.factBox, styles.factBoxWide]}>
          <Text style={styles.factLabel}>Zuständig</Text>
          <Text style={styles.factValue}>{assignment.primaryEmployeeName || 'Noch nicht festgelegt'}</Text>
        </View>
      </View>

      <View style={styles.contactBlock}>
        <Text style={styles.blockTitle}>Erreichbarkeit & Einsatzort</Text>
        <Text style={styles.contactLine}>{client?.primaryContactPhone || 'Keine Telefonnummer hinterlegt'}</Text>
        <Text style={styles.contactLine}>
          {[client?.street, [client?.zip, client?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
            || 'Keine vollständige Adresse hinterlegt'}
        </Text>
        {client?.insuranceNumber ? (
          <Text style={styles.contactMuted}>Versichertennummer: {client.insuranceNumber}</Text>
        ) : null}
      </View>

      <View style={styles.upcomingBlock}>
        <View style={styles.blockHeadingRow}>
          <Text style={styles.blockTitle}>Kommende Einsätze</Text>
          <Text style={styles.blockCount}>{upcomingVisits.length}</Text>
        </View>
        {nextVisits.length > 0 ? nextVisits.map((visit) => (
          <Pressable
            key={visit.id}
            accessibilityRole="button"
            onPress={() => router.push(`/assist/assignments/${visit.id}` as never)}
            style={({ pressed }) => [styles.visitRow, pressed && styles.pressed]}
          >
            <View style={styles.visitDateBox}>
              <Text style={styles.visitDate}>{formatDate(visit.scheduledStart)}</Text>
              <Text style={styles.visitTime}>
                {new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(new Date(visit.scheduledStart))}
              </Text>
            </View>
            <View style={styles.visitCopy}>
              <Text numberOfLines={2} style={styles.visitTitle}>{visit.serviceName || visit.title}</Text>
              <Text numberOfLines={1} style={styles.visitMeta}>{visit.employeeName || 'Noch nicht zugeordnet'}</Text>
            </View>
          </Pressable>
        )) : (
          <Text style={styles.emptyCopy}>Aktuell ist kein künftiger Einsatz geplant.</Text>
        )}
      </View>

      <View style={styles.detailActions}>
        <LiquidButton
          label="Klientenakte öffnen"
          onPress={() => router.push(`/business/office/clients/${clientId}` as never)}
        />
        <LiquidButton
          label="Einsatz planen"
          icon="+"
          variant="secondary"
          onPress={() => router.push(`/assist/assignments?create=1&clientId=${clientId}` as never)}
        />
        <LiquidButton
          label="Budget öffnen"
          variant="secondary"
          onPress={() => router.push(`/assist/abrechnungsquellen?clientId=${clientId}` as never)}
        />
        <LiquidButton
          label="Portal & Freigaben"
          variant="ghost"
          onPress={() => router.push(`/assist/portale?clientId=${clientId}` as never)}
        />
      </View>
    </LiquidSurface>
  );
}

export function AssistClientsWorkspace({
  tenantId,
  roleKey,
  clients,
  visits,
  loading,
  dataError,
  onReload,
}: AssistClientsWorkspaceProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AssistClientFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const assignmentQuery = useAsyncQuery(
    () => fetchClientModuleAssignments(tenantId, roleKey, 'assist'),
    [tenantId, roleKey],
    { enabled: Boolean(tenantId) },
  );
  const contexts = useMemo(
    () => buildClientContexts(assignmentQuery.data ?? [], clients, visits),
    [assignmentQuery.data, clients, visits],
  );

  useEffect(() => {
    if (selectedId && contexts.some((context) => context.assignment.clientId === selectedId)) return;
    setSelectedId(contexts[0]?.assignment.clientId ?? null);
  }, [contexts, selectedId]);

  const now = Date.now();
  const nextWeek = now + 7 * 24 * 60 * 60 * 1000;
  const upcomingNextWeek = visits.filter((visit) => {
    const start = new Date(visit.scheduledStart).getTime();
    return contexts.some((context) => context.assignment.clientId === visit.clientId)
      && start >= now
      && start <= nextWeek
      && isUpcomingVisit(visit, now);
  }).length;
  const attentionCount = contexts.filter((context) => context.needsAttention).length;
  const unplannedCount = contexts.filter((context) => context.upcomingVisits.length === 0).length;
  const normalizedQuery = query.trim().toLocaleLowerCase('de-DE');
  const filtered = contexts.filter((context) => {
    if (filter === 'attention' && !context.needsAttention) return false;
    if (filter === 'planned' && context.upcomingVisits.length === 0) return false;
    if (filter === 'unplanned' && context.upcomingVisits.length > 0) return false;
    if (!normalizedQuery) return true;
    const client = context.client;
    return [
      context.assignment.clientName,
      context.assignment.primaryEmployeeName,
      formatCareLevel(client?.careLevel),
      client?.costCarrier,
      client?.city,
      client?.primaryContactPhone,
    ].filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(normalizedQuery);
  });
  const selected = contexts.find((context) => context.assignment.clientId === selectedId) ?? null;
  const combinedLoading = loading || assignmentQuery.loading;
  const combinedError = dataError || assignmentQuery.error;

  const content = (
    <View style={styles.workspace}>
      <View style={styles.metricGrid}>
        <LiquidMetric label="Assist-Klient:innen" value={contexts.length} detail="dem Modul zugeordnet" glyph="◎" />
        <LiquidMetric label="Nächste 7 Tage" value={upcomingNextWeek} detail="geplante Einsätze" glyph="◷" tone="live" />
        <LiquidMetric label="Klärungsbedarf" value={attentionCount} detail="Stammdaten prüfen" glyph="!" tone={attentionCount ? 'warning' : 'success'} />
        <LiquidMetric label="Ohne Planung" value={unplannedCount} detail="kein künftiger Einsatz" glyph="▤" tone={unplannedCount ? 'warning' : 'success'} />
      </View>

      <LiquidSurface contentStyle={styles.listCard}>
        <View style={styles.listToolbar}>
          <View style={styles.searchWrap}>
            <LiquidField
              label="Klient:innen durchsuchen"
              placeholder="Name, Pflegegrad, Ort, Kostenträger oder Mitarbeitende"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <LiquidButton compact label="Aktualisieren" icon="↻" variant="secondary" onPress={() => {
            void Promise.all([onReload(), assignmentQuery.refresh()]);
          }} />
        </View>

        <View style={styles.filterRow}>
          {([
            ['all', `Alle (${contexts.length})`],
            ['attention', `Klärungsbedarf (${attentionCount})`],
            ['planned', 'Mit Planung'],
            ['unplanned', `Ohne Planung (${unplannedCount})`],
          ] as [AssistClientFilter, string][]).map(([key, label]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={({ pressed }) => [
                styles.filterChip,
                filter === key && styles.filterChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterLabel, filter === key && styles.filterLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {combinedError && contexts.length === 0 ? (
          <LiquidState kind="error" title="Assist-Klient:innen konnten nicht geladen werden" message={combinedError} actionLabel="Erneut laden" onAction={() => {
            void Promise.all([onReload(), assignmentQuery.refresh()]);
          }} />
        ) : combinedLoading && contexts.length === 0 ? (
          <LiquidState kind="loading" title="Assist-Klient:innen werden geladen" message="Zuordnungen, Versorgungsdaten und Einsatzplanung werden zusammengeführt." />
        ) : filtered.length === 0 ? (
          <LiquidState
            kind="empty"
            title={contexts.length === 0 ? 'Noch keine Assist-Zuordnungen' : 'Keine passenden Klient:innen'}
            message={contexts.length === 0
              ? 'Klient:innen müssen dem Modul Assist zugeordnet sein, bevor sie in der Arbeitsansicht erscheinen.'
              : 'Suchbegriff oder Filter ändern.'}
            actionLabel={contexts.length === 0 ? 'Zuordnungen in Office öffnen' : 'Filter zurücksetzen'}
            onAction={() => contexts.length === 0
              ? router.push('/business/office/modules/clients' as never)
              : (setFilter('all'), setQuery(''))}
          />
        ) : (
          <View style={styles.clientRows}>
            {filtered.map((context) => {
              const { assignment, client, upcomingVisits } = context;
              const nextVisit = upcomingVisits[0] ?? null;
              const careStatus = resolveClientCareStatus(context);
              const selectedRow = selectedId === assignment.clientId;
              const careLevelLabel = formatCareLevel(client?.careLevel) || 'Pflegegrad offen';
              return (
                <Pressable
                  key={assignment.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${assignment.clientName}, ${careLevelLabel}`}
                  accessibilityState={{ selected: selectedRow }}
                  onPress={() => setSelectedId(assignment.clientId)}
                  style={({ pressed }) => [
                    styles.clientRow,
                    selectedRow && styles.clientRowSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <ClientAnimalAvatar
                    clientId={assignment.clientId}
                    clientName={assignment.clientName}
                    size={50}
                    ringColor={context.needsAttention ? liquidColors.warning : liquidColors.blue400}
                  />
                  <View style={styles.clientMain}>
                    <View style={styles.clientTitleRow}>
                      <Text numberOfLines={1} style={styles.clientName}>{assignment.clientName}</Text>
                      <LiquidStatus label={careStatus.label} tone={careStatus.tone} />
                    </View>
                    <Text numberOfLines={1} style={styles.clientMeta}>
                      {careLevelLabel} · {client?.costCarrier || 'Kostenträger offen'}
                    </Text>
                    <Text numberOfLines={1} style={styles.clientAddress}>
                      {[client?.street, client?.zip, client?.city].filter(Boolean).join(' ') || 'Einsatzadresse unvollständig'}
                    </Text>
                  </View>
                  <View style={styles.planningSummary}>
                    <Text style={styles.planningLabel}>{upcomingVisits.length} geplant</Text>
                    <Text numberOfLines={1} style={styles.planningValue}>
                      {nextVisit ? formatDate(nextVisit.scheduledStart, true) : 'Kein nächster Einsatz'}
                    </Text>
                    <Text numberOfLines={1} style={styles.planningEmployee}>
                      {nextVisit?.employeeName || assignment.primaryEmployeeName || 'Mitarbeitende offen'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </LiquidSurface>
    </View>
  );

  return (
    <LiquidCommandShell
      activeModule="assist"
      activeArea="clients"
      title="Assist-Klient:innen"
      subtitle="Versorgung, Zuständigkeit, Einsatzplanung und Budget im direkten Überblick"
      contextLabel="Assist"
      contextDetail="Klient:innenversorgung · Mandant aktiv"
      asideWidth={430}
      primaryActionLabel="Einsatz planen"
      onPrimaryAction={() => router.push('/assist/assignments?create=1' as never)}
      aside={<AssistClientDetail context={selected} />}
    >
      {content}
    </LiquidCommandShell>
  );
}

const styles = StyleSheet.create({
  workspace: { gap: liquidSpace.lg },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.md },
  listCard: { gap: liquidSpace.lg },
  listToolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: liquidSpace.md },
  searchWrap: { flex: 1, minWidth: 280 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.sm },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: liquidRadius.pill, borderWidth: 1, borderColor: liquidColors.white18, backgroundColor: liquidColors.white08 },
  filterChipActive: { borderColor: liquidColors.blue400, backgroundColor: liquidColors.navy700 },
  filterLabel: { color: liquidColors.white64, fontSize: 12, fontWeight: '800' },
  filterLabelActive: { color: liquidColors.white },
  clientRows: { gap: liquidSpace.sm },
  clientRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: liquidSpace.md, padding: liquidSpace.md, borderRadius: liquidRadius.lg, borderWidth: 1, borderColor: liquidColors.white08, backgroundColor: liquidColors.white08 },
  clientRowSelected: { borderColor: liquidColors.blue400, backgroundColor: liquidColors.navy700 },
  clientMain: { flex: 1, minWidth: 180, gap: 3 },
  clientTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: liquidSpace.sm },
  clientName: { color: liquidColors.white, fontSize: 16, lineHeight: 21, fontWeight: '900', flexShrink: 1 },
  clientMeta: { color: liquidColors.white72, fontSize: 13, lineHeight: 18 },
  clientAddress: { color: liquidColors.white56, fontSize: 12, lineHeight: 17 },
  planningSummary: { minWidth: 190, marginLeft: 'auto', alignItems: 'flex-end', gap: 2 },
  planningLabel: { color: liquidColors.blue200, fontSize: 12, fontWeight: '900' },
  planningValue: { color: liquidColors.white, fontSize: 12, fontWeight: '800' },
  planningEmployee: { color: liquidColors.white56, fontSize: 11 },
  detailCard: { gap: 20, padding: 18 },
  detailIdentity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  detailIdentityText: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 6 },
  attentionBanner: { padding: liquidSpace.md, borderRadius: liquidRadius.md, borderWidth: 1, borderColor: liquidColors.warning, backgroundColor: 'rgba(245, 184, 65, 0.10)', gap: 3 },
  attentionTitle: { color: liquidColors.warning, fontSize: 13, fontWeight: '900' },
  attentionText: { color: liquidColors.white72, fontSize: 12, lineHeight: 17 },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  factBox: { minWidth: 0, paddingHorizontal: 14, paddingVertical: 12, borderRadius: liquidRadius.md, backgroundColor: liquidColors.white08, gap: 5 },
  factBoxCompact: { flexGrow: 1, flexBasis: '46%' },
  factBoxWide: { flexGrow: 1, flexBasis: '100%' },
  factLabel: { color: liquidColors.white56, fontSize: 10, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  factValue: { color: liquidColors.white, fontSize: 13, lineHeight: 19, fontWeight: '800' },
  contactBlock: { padding: 14, borderRadius: liquidRadius.md, borderWidth: 1, borderColor: liquidColors.white08, backgroundColor: 'rgba(148,163,184,0.07)', gap: 7 },
  blockHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: liquidSpace.sm },
  blockTitle: { color: liquidColors.white, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  blockCount: { color: liquidColors.blue200, fontSize: 12, fontWeight: '900' },
  contactLine: { color: liquidColors.white72, fontSize: 13, lineHeight: 19 },
  contactMuted: { color: liquidColors.white56, fontSize: 12, lineHeight: 17 },
  upcomingBlock: { gap: 10 },
  visitRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderRadius: liquidRadius.md, backgroundColor: liquidColors.white08 },
  visitDateBox: { width: 96, flexShrink: 0 },
  visitDate: { color: liquidColors.white, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  visitTime: { color: liquidColors.blue200, fontSize: 12, lineHeight: 17, fontWeight: '800', marginTop: 2 },
  visitCopy: { minWidth: 0, flex: 1, gap: 3 },
  visitTitle: { color: liquidColors.white, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  visitMeta: { color: liquidColors.white56, fontSize: 12, lineHeight: 16 },
  emptyCopy: { color: liquidColors.white56, fontSize: 12, lineHeight: 18 },
  detailActions: { gap: liquidSpace.sm },
  pressed: { opacity: 0.78 },
});
