import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  useCurrentSystemAdapter,
  type LiquidCurrentData,
} from '../adapters/currentSystemAdapter';
import {
  LiquidButton,
  LiquidBackdrop,
  LiquidField,
  LiquidGlyph,
  LiquidMetric,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
  type LiquidStateKind,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace, type LiquidSemanticTone } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import { getLiquidModule, liquidWorkAreas } from '../navigation/moduleCatalog';
import {
  getLiquidPrimaryWorkflowRoute,
  getLiquidRecordRoute,
} from '../navigation/workflowRoutes';
import { LiquidCommandShell } from '../shell/LiquidCommandShell';
import type { LiquidModuleKey, LiquidPageType, LiquidWorkArea } from '../types';

type WorkspaceItem = {
  id: string;
  title: string;
  meta: string;
  detail: string;
  status: string;
  tone: LiquidSemanticTone;
  timestamp?: string | null;
  amount?: string;
};

function normalizeStatus(value: string | null | undefined): string {
  if (!value) return 'Status offen';
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneForStatus(value: string | null | undefined): LiquidSemanticTone {
  const normalized = (value ?? '').toLowerCase();
  if (/(fehler|storniert|kritisch|gesperrt|abgelaufen)/.test(normalized)) return 'danger';
  if (/(offen|prüfung|entwurf|unvollständig|wartend|pausiert)/.test(normalized)) return 'warning';
  if (/(aktiv|gestartet|unterwegs|angekommen|live)/.test(normalized)) return 'live';
  if (/(abgeschlossen|bezahlt|freigegeben|erledigt|gültig)/.test(normalized)) return 'success';
  return 'neutral';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'ohne Zeitangabe';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatCurrency(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(cents / 100);
}

function useWorkspaceItems(
  moduleKey: LiquidModuleKey,
  areaId: string,
  data: LiquidCurrentData,
): WorkspaceItem[] {
  return useMemo(() => {
    if (moduleKey === 'office') {
      if (areaId === 'people') {
        return data.employees.map((employee) => ({
          id: employee.id,
          title: `${employee.firstName} ${employee.lastName}`.trim(),
          meta: employee.jobTitle || employee.department || 'Mitarbeitende Person',
          detail: employee.email || employee.phone || 'Keine Kontaktdaten hinterlegt',
          status: normalizeStatus(employee.status),
          tone: toneForStatus(employee.status),
          timestamp: employee.updatedAt,
        }));
      }
      if (areaId === 'billing') {
        return data.invoices.map((invoice) => ({
          id: invoice.id,
          title: invoice.invoiceNumber,
          meta: invoice.clientName,
          detail: `Fällig ${formatDateTime(invoice.dueDate)}`,
          status: normalizeStatus(invoice.status),
          tone: toneForStatus(invoice.status),
          timestamp: invoice.updatedAt,
          amount: formatCurrency(invoice.amountCents, invoice.currency),
        }));
      }
      if (areaId === 'documents') {
        return data.documents.map((document) => ({
          id: document.id,
          title: document.title,
          meta: document.displayFileName || document.fileName,
          detail: `${normalizeStatus(document.category)} · ${document.sizeLabel || document.mimeType}`,
          status: normalizeStatus(document.status),
          tone: toneForStatus(document.status),
          timestamp: document.updatedAt,
        }));
      }
      return data.clients.map((client) => ({
        id: client.id,
        title: `${client.firstName} ${client.lastName}`.trim(),
        meta: `${client.careLevel || 'Ohne Pflegegrad'} · ${client.costCarrier || 'Kostenträger offen'}`,
        detail: [client.zip, client.city].filter(Boolean).join(' ') || 'Adresse unvollständig',
        status: normalizeStatus(client.status),
        tone: toneForStatus(client.status),
        timestamp: client.updatedAt,
      }));
    }

    if (moduleKey === 'assist') {
      if (areaId === 'clients' || areaId === 'budgets' || areaId === 'portals') {
        return data.clients.map((client) => ({
          id: client.id,
          title: `${client.firstName} ${client.lastName}`.trim(),
          meta: `${client.careLevel || 'Ohne Pflegegrad'} · ${client.costCarrier || 'Kostenträger offen'}`,
          detail: [client.zip, client.city].filter(Boolean).join(' ') || 'Adresse unvollständig',
          status: normalizeStatus(client.status),
          tone: toneForStatus(client.status),
          timestamp: client.updatedAt,
        }));
      }
      return data.visits.map((visit) => ({
        id: visit.id,
        title: visit.clientName,
        meta: `${formatDateTime(visit.scheduledStart)} · ${visit.employeeName}`,
        detail: `${visit.serviceName || visit.title} · ${visit.location}`,
        status: normalizeStatus(visit.assignmentStatus || visit.status),
        tone: toneForStatus(visit.assignmentStatus || visit.status),
        timestamp: visit.updatedAt,
      }));
    }

    if (moduleKey === 'pflege' || moduleKey === 'stationaer' || moduleKey === 'beratung') {
      return data.clients.map((client) => ({
        id: client.id,
        title: `${client.firstName} ${client.lastName}`.trim(),
        meta: `${client.careLevel || 'Ohne Pflegegrad'} · ${client.costCarrier || 'Kostenträger offen'}`,
        detail:
          moduleKey === 'pflege'
            ? `Versorgungsakte · ${areaId.toUpperCase()}`
            : moduleKey === 'stationaer'
              ? `Bewohner:innenkontext · ${areaId}`
              : `Beratungskontext · ${areaId}`,
        status: normalizeStatus(client.status),
        tone: toneForStatus(client.status),
        timestamp: client.updatedAt,
      }));
    }

    if (moduleKey === 'akademie') {
      return data.employees.map((employee) => ({
        id: employee.id,
        title: `${employee.firstName} ${employee.lastName}`.trim(),
        meta: employee.jobTitle || 'Teilnehmende Person',
        detail: `Lernkontext · ${areaId}`,
        status: normalizeStatus(employee.status),
        tone: toneForStatus(employee.status),
        timestamp: employee.updatedAt,
      }));
    }

    if (moduleKey === 'settings' || moduleKey === 'platform' || moduleKey === 'robotics') {
      return liquidWorkAreas[moduleKey].map((area) => ({
        id: area.id,
        title: area.label,
        meta: normalizeStatus(area.pageType),
        detail: area.description,
        status: 'Konfigurierbar',
        tone: 'neutral',
      }));
    }

    return [];
  }, [areaId, data.clients, data.documents, data.employees, data.invoices, data.visits, moduleKey]);
}

function PatternHeader({
  area,
  count,
  attention,
  loading,
}: {
  area: LiquidWorkArea;
  count: number;
  attention: number;
  loading: boolean;
}) {
  return (
    <View style={styles.metricGrid}>
      <LiquidMetric label="Datensätze" value={count} detail={area.label} glyph="▣" />
      <LiquidMetric
        label="Aufmerksamkeit"
        value={attention}
        detail={attention ? 'bitte prüfen' : 'keine Abweichung'}
        glyph="!"
        tone={attention ? 'warning' : 'success'}
      />
      <LiquidMetric
        label="Datenstatus"
        value={loading ? 'Sync' : 'Aktuell'}
        detail={loading ? 'wird geladen' : 'Kontext geladen'}
        glyph="⌁"
        tone={loading ? 'live' : 'success'}
      />
    </View>
  );
}

function WorkspaceList({
  items,
  selectedId,
  onSelect,
  query,
  onQuery,
  emptyTitle,
}: {
  items: WorkspaceItem[];
  selectedId: string | null;
  onSelect: (item: WorkspaceItem) => void;
  query: string;
  onQuery: (value: string) => void;
  emptyTitle: string;
}) {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) =>
        `${item.title} ${item.meta} ${item.detail} ${item.status}`.toLowerCase().includes(normalized),
      )
    : items;

  return (
    <LiquidSurface contentStyle={styles.listCard}>
      <LiquidField
        label="Arbeitsliste durchsuchen"
        value={query}
        onChangeText={onQuery}
        placeholder="Name, Status oder Inhalt"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderTitle}>{filtered.length} Ergebnis(se)</Text>
        <LiquidButton
          compact
          label={query ? 'Filter lösen' : 'Alle sichtbar'}
          icon="≡"
          variant="secondary"
          disabled={!query}
          onPress={() => onQuery('')}
        />
      </View>
      {filtered.length ? (
        <View style={styles.listRows}>
          {filtered.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.meta}. ${item.status}`}
              accessibilityState={{ selected: item.id === selectedId }}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.listRow,
                item.id === selectedId && styles.listRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.listMarker, { backgroundColor: toneMarker(item.tone) }]} />
              <View style={styles.listMain}>
                <Text numberOfLines={1} style={styles.listTitle}>{item.title}</Text>
                <Text numberOfLines={1} style={styles.listMeta}>{item.meta}</Text>
                <Text numberOfLines={2} style={styles.listDetail}>{item.detail}</Text>
              </View>
              <View style={styles.listEnd}>
                {item.amount ? <Text style={styles.listAmount}>{item.amount}</Text> : null}
                <LiquidStatus label={item.status} tone={item.tone} />
                {item.timestamp ? <Text style={styles.listTimestamp}>{formatDateTime(item.timestamp)}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <LiquidState
          kind="empty"
          title={emptyTitle}
          message={
            normalized
              ? 'Die aktuelle Suche liefert keine Treffer. Filter lösen oder Suchbegriff ändern.'
              : 'In diesem Mandantenkontext sind noch keine Datensätze vorhanden.'
          }
          actionLabel={normalized ? 'Suche zurücksetzen' : undefined}
          onAction={normalized ? () => onQuery('') : undefined}
        />
      )}
    </LiquidSurface>
  );
}

function toneMarker(tone: LiquidSemanticTone): string {
  if (tone === 'danger') return liquidColors.danger;
  if (tone === 'warning') return liquidColors.warning;
  if (tone === 'success') return liquidColors.success;
  if (tone === 'live') return liquidColors.blue400;
  return liquidColors.white32;
}

function SelectedRecord({
  item,
  area,
  onClose,
  onCreateTask,
  onOpen,
}: {
  item: WorkspaceItem | null;
  area: LiquidWorkArea;
  onClose: () => void;
  onCreateTask: (item: WorkspaceItem) => void;
  onOpen: (item: WorkspaceItem) => void;
}) {
  const [note, setNote] = useState('');
  if (!item) {
    return (
      <LiquidSurface solid contentStyle={styles.detailCard}>
        <LiquidText variant="kicker">KONTEXT</LiquidText>
        <LiquidText variant="section">Datensatz auswählen</LiquidText>
        <LiquidText variant="meta">
          Wählen Sie einen Eintrag. Der Arbeitskontext bleibt beim Wechsel zwischen Liste,
          Detail und Aktion erhalten.
        </LiquidText>
      </LiquidSurface>
    );
  }

  return (
    <LiquidSurface active contentStyle={styles.detailCard}>
      <View style={styles.detailHeader}>
        <LiquidStatus label={item.status} tone={item.tone} />
        <LiquidButton compact label="Schließen" variant="ghost" onPress={onClose} />
      </View>
      <View style={styles.detailCopy}>
        <LiquidText variant="kicker">{area.label.toUpperCase()}</LiquidText>
        <LiquidText variant="title" accessibilityRole="header">{item.title}</LiquidText>
        <LiquidText variant="body">{item.meta}</LiquidText>
        <LiquidText variant="meta">{item.detail}</LiquidText>
      </View>
      <View style={styles.detailFacts}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Datensatz-ID</Text>
          <Text selectable style={styles.factValue}>{item.id}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Aktualisiert</Text>
          <Text style={styles.factValue}>{formatDateTime(item.timestamp)}</Text>
        </View>
      </View>
      <LiquidField
        label="Arbeitsnotiz"
        value={note}
        onChangeText={setNote}
        placeholder="Strukturierte Aktion oder Rückfrage festhalten"
        multiline
        hint="Diese lokale Eingabe wird erst durch eine freigegebene Fachaktion gespeichert."
      />
      <View style={styles.detailActions}>
        <LiquidButton label="Fachakte öffnen" onPress={() => onOpen(item)} />
        <LiquidButton
          label="Aufgabe anlegen"
          variant="secondary"
          onPress={() => onCreateTask(item)}
        />
      </View>
    </LiquidSurface>
  );
}

function PlanningPattern({
  items,
  onSelect,
}: {
  items: WorkspaceItem[];
  onSelect: (item: WorkspaceItem) => void;
}) {
  return (
    <LiquidSurface contentStyle={styles.planningCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">PLANUNG</LiquidText>
          <LiquidText variant="section">Ressourcen und Zeitfenster</LiquidText>
        </View>
        <LiquidStatus label="Konfliktprüfung aktiv" tone="live" />
      </View>
      <View style={styles.timeScale}>
        {['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00'].map((time) => (
          <Text key={time} style={styles.timeLabel}>{time}</Text>
        ))}
      </View>
      {items.length ? items.slice(0, 12).map((item, index) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => onSelect(item)}
          style={({ pressed }) => [
            styles.planRow,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.planIdentity}>
            <Text numberOfLines={1} style={styles.listTitle}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.listMeta}>{item.meta}</Text>
          </View>
          <View style={styles.planTrack}>
            <View
              style={[
                styles.planBar,
                {
                  marginLeft: `${(index % 5) * 9}%`,
                  width: `${30 + (index % 3) * 10}%`,
                  backgroundColor: toneMarker(item.tone),
                },
              ]}
            />
          </View>
          <LiquidStatus label={item.status} tone={item.tone} />
        </Pressable>
      )) : (
        <LiquidState
          kind="empty"
          title="Keine Planungseinträge"
          message="Ressourcen, Termine oder Einsätze können über die Hauptaktion angelegt werden."
        />
      )}
    </LiquidSurface>
  );
}

function EditorPattern({ area, selected }: { area: LiquidWorkArea; selected: WorkspaceItem | null }) {
  const [assessment, setAssessment] = useState('');
  const [measure, setMeasure] = useState('');
  const [draftState, setDraftState] = useState<'idle' | 'saved' | 'versions'>('idle');
  return (
    <LiquidSurface contentStyle={styles.editorCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">STRUKTURIERTE EINGABE</LiquidText>
          <LiquidText variant="section">{area.label}</LiquidText>
        </View>
        <LiquidStatus label="Autosave bereit" tone="success" />
      </View>
      {selected ? (
        <LiquidStatus label={selected.title} detail={selected.meta} tone="live" />
      ) : (
        <LiquidState
          kind="locked"
          title="Versorgungskontext auswählen"
          message="Für die Dokumentation muss zuerst ein verantwortbarer Datensatz ausgewählt werden."
        />
      )}
      <View style={styles.editorGrid}>
        <LiquidField
          label="Beobachtung / Befund"
          value={assessment}
          onChangeText={setAssessment}
          multiline
          placeholder="Fachlich relevante Beobachtung strukturiert erfassen"
          required
        />
        <LiquidField
          label="Maßnahme / nächster Schritt"
          value={measure}
          onChangeText={setMeasure}
          multiline
          placeholder="Maßnahme, Verantwortung und Frist"
          required
        />
      </View>
      <View style={styles.detailActions}>
        <LiquidButton
          label="Entwurf sichern"
          disabled={!selected || !assessment.trim() || !measure.trim()}
          onPress={() => setDraftState('saved')}
        />
        <LiquidButton
          label="Versionen"
          variant="secondary"
          onPress={() => setDraftState('versions')}
        />
      </View>
      {draftState !== 'idle' ? (
        <LiquidStatus
          label={draftState === 'saved' ? 'Entwurf lokal vorbereitet' : 'Noch keine gespeicherte Version'}
          tone={draftState === 'saved' ? 'success' : 'neutral'}
          detail="Die fachliche Persistierung erfolgt erst über einen freigegebenen Fachdienst."
        />
      ) : null}
    </LiquidSurface>
  );
}

function ReviewPattern({
  items,
  selected,
  onSelect,
}: {
  items: WorkspaceItem[];
  selected: WorkspaceItem | null;
  onSelect: (item: WorkspaceItem) => void;
}) {
  const queue = items.filter((item) => item.tone === 'warning' || item.tone === 'danger');
  const visible = queue.length ? queue : items;
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  return (
    <LiquidSurface contentStyle={styles.reviewCard}>
      <View style={styles.sectionHeader}>
        <View>
          <LiquidText variant="kicker">REVIEW</LiquidText>
          <LiquidText variant="section">Soll / Ist und Entscheidung</LiquidText>
        </View>
        <LiquidStatus label={`${queue.length} offen`} tone={queue.length ? 'warning' : 'success'} />
      </View>
      <View style={styles.reviewColumns}>
        <View style={styles.reviewQueue}>
          {visible.slice(0, 10).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selected?.id === item.id }}
              onPress={() => onSelect(item)}
              style={[
                styles.reviewRow,
                selected?.id === item.id && styles.listRowSelected,
              ]}
            >
              <View style={[styles.listMarker, { backgroundColor: toneMarker(item.tone) }]} />
              <View style={styles.listMain}>
                <Text style={styles.listTitle}>{item.title}</Text>
                <Text numberOfLines={2} style={styles.listMeta}>{item.detail}</Text>
              </View>
            </Pressable>
          ))}
          {!visible.length ? (
            <LiquidState kind="empty" title="Keine Prüfungen" message="Die Prüfqueue ist für diesen Kontext leer." />
          ) : null}
        </View>
        <View style={styles.reviewDecision}>
          {selected ? (
            <>
              <LiquidText variant="section">{selected.title}</LiquidText>
              <LiquidText variant="meta">{selected.meta}</LiquidText>
              <LiquidStatus label={selected.status} tone={selected.tone} />
              <LiquidField
                label="Entscheidungsbegründung"
                value={reason}
                onChangeText={setReason}
                placeholder="Nur bei Abweichung verpflichtend"
                multiline
              />
              <LiquidButton label="Freigabe vorbereiten" onPress={() => setDecision('approve')} />
              <LiquidButton
                label="Zurückweisung vorbereiten"
                variant="danger"
                disabled={!reason.trim()}
                onPress={() => setDecision('reject')}
              />
              {decision ? (
                <LiquidStatus
                  label={decision === 'approve' ? 'Freigabe vorbereitet' : 'Zurückweisung vorbereitet'}
                  tone={decision === 'approve' ? 'success' : 'warning'}
                  detail="Noch nicht revisionssicher gespeichert"
                />
              ) : null}
            </>
          ) : (
            <LiquidState
              kind="empty"
              title="Prüfung auswählen"
              message="Soll-/Ist-Daten und revisionssichere Entscheidung erscheinen hier."
            />
          )}
        </View>
      </View>
    </LiquidSurface>
  );
}

function AnalyticsPattern({ items, area }: { items: WorkspaceItem[]; area: LiquidWorkArea }) {
  const active = items.filter((item) => item.tone === 'live' || item.tone === 'success').length;
  const attention = items.filter((item) => item.tone === 'warning' || item.tone === 'danger').length;
  const [exportPrepared, setExportPrepared] = useState(false);
  return (
    <View style={styles.analytics}>
      <View style={styles.metricGrid}>
        <LiquidMetric label={area.label} value={items.length} detail="Gesamt" />
        <LiquidMetric label="Aktiv / erledigt" value={active} detail="positiver Status" tone="success" />
        <LiquidMetric label="Abweichungen" value={attention} detail="Drill-down verfügbar" tone={attention ? 'warning' : 'success'} />
      </View>
      <LiquidSurface contentStyle={styles.chartCard}>
        <View style={styles.sectionHeader}>
          <View>
            <LiquidText variant="kicker">ANALYSE</LiquidText>
            <LiquidText variant="section">Verteilung nach Status</LiquidText>
          </View>
          <LiquidButton
            compact
            label="Export vorbereiten"
            variant="secondary"
            onPress={() => setExportPrepared(true)}
          />
        </View>
        {exportPrepared ? (
          <LiquidStatus
            label="Export vorbereitet"
            tone="success"
            detail={`${items.length} Datensätze · Freigabe und Dateiformat noch wählen`}
          />
        ) : null}
        <View style={styles.chart}>
          {[0.42, 0.68, 0.33, 0.81, 0.56, 0.73, 0.47, 0.62].map((height, index) => (
            <View key={`${height}-${index}`} style={styles.chartColumn}>
              <View style={[styles.chartBar, { height: `${height * 100}%` }]} />
              <Text style={styles.chartLabel}>{index + 1}</Text>
            </View>
          ))}
        </View>
      </LiquidSurface>
    </View>
  );
}

function SettingsPattern({ moduleKey }: { moduleKey: LiquidModuleKey }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const areas = liquidWorkAreas[moduleKey];
  const normalized = query.toLowerCase().trim();
  const filtered = normalized
    ? areas.filter((area) => `${area.label} ${area.description}`.toLowerCase().includes(normalized))
    : areas;
  return (
    <LiquidSurface contentStyle={styles.settingsCard}>
      <LiquidField
        label="Einstellungen durchsuchen"
        value={query}
        onChangeText={setQuery}
        placeholder="Rolle, Integration, Datenschutz oder Vorlage"
      />
      <View style={styles.settingsRows}>
        {filtered.map((area) => (
          <Pressable
            key={area.id}
            accessibilityRole="button"
            onPress={() => router.push(area.route as never)}
            style={styles.settingsRow}
          >
            <View style={styles.settingsGlyph}>
              <LiquidGlyph glyph="⚙" size={20} />
            </View>
            <View style={styles.listMain}>
              <Text style={styles.listTitle}>{area.label}</Text>
              <Text style={styles.listDetail}>{area.description}</Text>
            </View>
            <LiquidGlyph glyph="›" size={18} />
          </Pressable>
        ))}
      </View>
    </LiquidSurface>
  );
}

function patternStateKind(pageType: LiquidPageType): LiquidStateKind {
  if (pageType === 'settings') return 'locked';
  if (pageType === 'review') return 'empty';
  return 'empty';
}

export function ModuleWorkspaceScreen({ moduleKey }: { moduleKey: LiquidModuleKey }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string; record?: string }>();
  const module = getLiquidModule(moduleKey);
  const areas = liquidWorkAreas[moduleKey];
  const activeArea =
    areas.find((area) => area.id === params.area) ??
    areas[0] ??
    ({ id: 'overview', label: module.label, description: module.description, pageType: 'command-center', route: module.route } satisfies LiquidWorkArea);
  const state = useCurrentSystemAdapter();
  const auth = useAuth();
  const layout = useLiquidLayout();
  const items = useWorkspaceItems(moduleKey, activeArea.id, state.data);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<WorkspaceItem | null>(
    items.find((item) => item.id === params.record) ?? null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftPrepared, setDraftPrepared] = useState(false);
  const attention = items.filter((item) => item.tone === 'warning' || item.tone === 'danger').length;
  const dataError = state.errors[
    moduleKey === 'assist'
      ? 'visits'
      : moduleKey === 'akademie'
        ? 'employees'
        : 'clients'
  ];

  if (!auth.authReady) {
    return (
      <LiquidBackdrop>
        <LiquidState
          kind="loading"
          title="Berechtigung wird geprüft"
          message="Rolle, Mandant und Modulumfang werden geladen."
        />
      </LiquidBackdrop>
    );
  }

  if (
    !auth.isAuthenticated ||
    auth.portalSession ||
    auth.profile?.roleKey === 'employee_portal' ||
    auth.profile?.roleKey === 'client_portal' ||
    auth.profile?.roleKey === 'family_portal'
  ) {
    return (
      <LiquidBackdrop>
        <LiquidState
          kind="locked"
          title="Unternehmenszugang erforderlich"
          message="Dieser Modulbereich ist nur im freigegebenen Unternehmenskontext verfügbar."
        />
      </LiquidBackdrop>
    );
  }

  const list = (
    <WorkspaceList
      items={items}
      selectedId={selected?.id ?? null}
      onSelect={setSelected}
      query={query}
      onQuery={setQuery}
      emptyTitle={`Keine Einträge in ${activeArea.label}`}
    />
  );

  let pattern = list;
  if (activeArea.pageType === 'planning') {
    pattern = <PlanningPattern items={items} onSelect={setSelected} />;
  } else if (activeArea.pageType === 'editor') {
    pattern = (
      <View style={styles.patternStack}>
        {list}
        <EditorPattern area={activeArea} selected={selected} />
      </View>
    );
  } else if (activeArea.pageType === 'review') {
    pattern = <ReviewPattern items={items} selected={selected} onSelect={setSelected} />;
  } else if (activeArea.pageType === 'analytics') {
    pattern = <AnalyticsPattern items={items} area={activeArea} />;
  } else if (activeArea.pageType === 'settings') {
    pattern = <SettingsPattern moduleKey={moduleKey} />;
  }

  const openCreate = (item?: WorkspaceItem) => {
    if (!item) {
      const route = getLiquidPrimaryWorkflowRoute(moduleKey, activeArea.id);
      if (route) {
        router.push(route as never);
        return;
      }
    }
    setDraftTitle(item ? `Aufgabe zu ${item.title}` : '');
    setDraftOwner('');
    setDraftPrepared(false);
    setCreateOpen(true);
  };

  const aside = (
    <SelectedRecord
      item={selected}
      area={activeArea}
      onClose={() => setSelected(null)}
      onCreateTask={openCreate}
      onOpen={(item) => {
        const route = getLiquidRecordRoute(moduleKey, activeArea.id, item.id);
        if (route) {
          router.push(route as never);
          return;
        }
        setSelected(item);
      }}
    />
  );

  return (
    <LiquidCommandShell
      activeModule={moduleKey}
      activeArea={activeArea.id}
      title={activeArea.label}
      subtitle={activeArea.description}
      contextLabel={module.label}
      contextDetail={`${activeArea.label} · ${state.tenantId ? 'Mandant aktiv' : 'kein Mandantenkontext'}`}
      primaryActionLabel={module.primaryAction}
      onPrimaryAction={() => openCreate()}
      aside={layout.isPhone || activeArea.pageType === 'planning' ? undefined : aside}
    >
      <PatternHeader
        area={activeArea}
        count={items.length}
        attention={attention}
        loading={state.loading}
      />

      {dataError ? (
        <LiquidState
          kind="error"
          title={`${activeArea.label} nicht vollständig verfügbar`}
          message={`${dataError} Andere geladene Bereiche bleiben bedienbar.`}
          actionLabel="Erneut laden"
          onAction={() => void state.reload()}
        />
      ) : null}

      {createOpen ? (
        <LiquidSurface active contentStyle={styles.createPanel}>
          <View style={styles.sectionHeader}>
            <View>
              <LiquidText variant="kicker">NEUE AKTION</LiquidText>
              <LiquidText variant="section">{module.primaryAction}</LiquidText>
            </View>
            <LiquidButton compact label="Schließen" variant="ghost" onPress={() => setCreateOpen(false)} />
          </View>
          <LiquidText variant="meta">
            Der neue Vorgang wird im aktiven Mandanten-, Rollen- und Arbeitskontext angelegt.
          </LiquidText>
          <View style={styles.createFields}>
            <LiquidField label="Bezeichnung" value={draftTitle} onChangeText={setDraftTitle} required />
            <LiquidField
              label="Verantwortung / Zuordnung"
              value={draftOwner}
              onChangeText={setDraftOwner}
              required
            />
          </View>
          <LiquidButton
            label="Vorgang vorbereiten"
            disabled={!draftTitle.trim() || !draftOwner.trim()}
            onPress={() => setDraftPrepared(true)}
          />
          {draftPrepared ? (
            <LiquidStatus
              label="Vorgang vorbereitet"
              tone="success"
              detail="Noch nicht fachlich gespeichert"
            />
          ) : null}
        </LiquidSurface>
      ) : null}

      {state.loading && !state.initialized ? (
        <LiquidState
          kind="loading"
          title={`${activeArea.label} wird geladen`}
          message="Produktive Daten und Berechtigungen werden geprüft."
        />
      ) : pattern}

      {(layout.isPhone || activeArea.pageType === 'planning') && selected ? aside : null}

      {!items.length && !state.loading && activeArea.pageType !== 'settings' && !dataError ? (
        <LiquidState
          kind={patternStateKind(activeArea.pageType)}
          title="Arbeitsbereich ist leer"
          message="Der Leerzustand ist vollständig bedienbar. Über die Hauptaktion kann der erste Vorgang angelegt werden."
          actionLabel={module.primaryAction}
          onAction={() => openCreate()}
        />
      ) : null}
    </LiquidCommandShell>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listCard: {
    padding: liquidSpace[4],
    gap: 14,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listHeaderTitle: {
    color: liquidColors.white72,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  listRows: {
    gap: 7,
  },
  listRow: {
    minHeight: 78,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  listRowSelected: {
    borderColor: liquidColors.blue500,
    backgroundColor: 'rgba(20,120,255,0.14)',
  },
  listMarker: {
    width: 5,
    height: 40,
    borderRadius: 3,
  },
  listMain: {
    minWidth: 0,
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  listMeta: {
    color: liquidColors.white72,
    fontSize: 13,
    lineHeight: 18,
  },
  listDetail: {
    color: liquidColors.white56,
    fontSize: 12,
    lineHeight: 17,
  },
  listEnd: {
    maxWidth: 220,
    alignItems: 'flex-end',
    gap: 5,
  },
  listAmount: {
    color: liquidColors.white,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  listTimestamp: {
    color: liquidColors.white32,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  detailCard: {
    padding: 18,
    gap: 16,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  detailCopy: {
    gap: 5,
  },
  detailFacts: {
    gap: 8,
  },
  fact: {
    padding: 10,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.white08,
    gap: 3,
  },
  factLabel: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  factValue: {
    color: liquidColors.white88,
    fontSize: 12,
    lineHeight: 17,
  },
  detailActions: {
    gap: 8,
  },
  planningCard: {
    padding: liquidSpace[4],
    gap: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timeScale: {
    paddingLeft: 168,
    paddingRight: 100,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeLabel: {
    color: liquidColors.white32,
    fontSize: 10,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  planRow: {
    minHeight: 58,
    paddingHorizontal: 10,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIdentity: {
    width: 145,
  },
  planTrack: {
    minWidth: 120,
    height: 16,
    flex: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  planBar: {
    height: '100%',
    borderRadius: 8,
  },
  editorCard: {
    padding: liquidSpace[4],
    gap: 16,
  },
  editorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  reviewCard: {
    padding: liquidSpace[4],
    gap: 16,
  },
  reviewColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  reviewQueue: {
    minWidth: 260,
    flex: 1,
    gap: 7,
  },
  reviewRow: {
    minHeight: 64,
    padding: 10,
    borderRadius: liquidRadius.control,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    gap: 10,
  },
  reviewDecision: {
    width: 330,
    padding: 16,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: 'rgba(6,21,43,0.48)',
    gap: 12,
  },
  analytics: {
    gap: 16,
  },
  chartCard: {
    minHeight: 360,
    padding: liquidSpace[5],
    gap: 20,
  },
  chart: {
    height: 240,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 8,
  },
  chartColumn: {
    height: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chartBar: {
    width: '60%',
    maxWidth: 52,
    minHeight: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: liquidColors.blue500,
    shadowColor: liquidColors.blue500,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  chartLabel: {
    color: liquidColors.white56,
    fontSize: 11,
    lineHeight: 15,
  },
  settingsCard: {
    padding: liquidSpace[4],
    gap: 16,
  },
  settingsRows: {
    gap: 8,
  },
  settingsRow: {
    minHeight: 70,
    padding: 12,
    borderRadius: liquidRadius.small,
    borderWidth: 1,
    borderColor: liquidColors.white12,
    backgroundColor: liquidColors.white08,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsGlyph: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(20,120,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPanel: {
    padding: liquidSpace[4],
    gap: 14,
  },
  createFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  patternStack: {
    gap: 20,
  },
  pressed: {
    opacity: 0.8,
  },
  focused: {
    borderWidth: 2,
    borderColor: liquidColors.blue200,
  },
});
