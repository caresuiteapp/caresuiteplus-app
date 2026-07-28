import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import {
  downloadPortalDocument,
  fetchPortalAppointments,
  fetchPortalDocumentDetail,
  fetchPortalDocuments,
  fetchPortalMessages,
  formatFileSize,
  type PortalAppointmentItem,
} from '@/lib/portal';
import type { RoleKey } from '@/types';
import type { MessageListItem } from '@/types/portal/communication';
import type {
  PortalDocumentDetail,
  PortalDocumentListItem,
} from '@/types/portal/documents';
import {
  LiquidBackdrop,
  LiquidButton,
  LiquidDivider,
  LiquidIconButton,
  LiquidGlyph,
  LiquidLogo,
  LiquidMetric,
  LiquidState,
  LiquidStatus,
  LiquidSurface,
  LiquidText,
} from '../components/LiquidPrimitives';
import { liquidColors, liquidRadius, liquidSpace } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import type { LiquidPortalKey } from '../types';

type PortalSection = {
  id: string;
  label: string;
  glyph: string;
};

type PortalData = {
  appointments: PortalAppointmentItem[];
  documents: PortalDocumentListItem[];
  messages: MessageListItem[];
};

const EMPTY_PORTAL_DATA: PortalData = {
  appointments: [],
  documents: [],
  messages: [],
};

const portalDefinitions: Record<
  Extract<LiquidPortalKey, 'employee' | 'client' | 'family'>,
  {
    title: string;
    eyebrow: string;
    allowedRole: RoleKey;
    sections: PortalSection[];
  }
> = {
  employee: {
    title: 'Mitarbeitenden-App',
    eyebrow: 'MEIN ARBEITSTAG',
    allowedRole: 'employee_portal',
    sections: [
      { id: 'today', label: 'Mein Tag', glyph: '⌂' },
      { id: 'appointments', label: 'Einsätze', glyph: '◇' },
      { id: 'time', label: 'Zeiten', glyph: '◷' },
      { id: 'documents', label: 'Dokumente', glyph: '▤' },
      { id: 'messages', label: 'Nachrichten', glyph: '✉' },
      { id: 'salary', label: 'Gehalt', glyph: '€' },
    ],
  },
  client: {
    title: 'Klient:innenportal',
    eyebrow: 'MEINE VERSORGUNG',
    allowedRole: 'client_portal',
    sections: [
      { id: 'today', label: 'Übersicht', glyph: '⌂' },
      { id: 'appointments', label: 'Termine', glyph: '◷' },
      { id: 'live', label: 'Live-Anfahrt', glyph: '⌖' },
      { id: 'documents', label: 'Dokumente', glyph: '▤' },
      { id: 'messages', label: 'Nachrichten', glyph: '✉' },
      { id: 'invoices', label: 'Rechnungen', glyph: '€' },
    ],
  },
  family: {
    title: 'Angehörigenportal',
    eyebrow: 'FREIGEGEBENE INFORMATIONEN',
    allowedRole: 'family_portal',
    sections: [
      { id: 'today', label: 'Übersicht', glyph: '⌂' },
      { id: 'appointments', label: 'Termine', glyph: '◷' },
      { id: 'notices', label: 'Hinweise', glyph: '!' },
      { id: 'documents', label: 'Dokumente', glyph: '▤' },
      { id: 'messages', label: 'Kommunikation', glyph: '✉' },
    ],
  },
};

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function statusTone(value: string): 'neutral' | 'live' | 'success' | 'warning' | 'danger' {
  const normalized = value.toLowerCase();
  if (/(cancel|storn|block|fehler)/.test(normalized)) return 'danger';
  if (/(offen|entwurf|wart|risk|unvoll)/.test(normalized)) return 'warning';
  if (/(unterwegs|live|aktiv|bearbeitung)/.test(normalized)) return 'live';
  if (/(fertig|abgeschlossen|bezahlt|freigegeben)/.test(normalized)) return 'success';
  return 'neutral';
}

function usePortalData() {
  const { authReady, isAuthenticated, portalSession, profile, user } = useAuth();
  const [data, setData] = useState<PortalData>(EMPTY_PORTAL_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const profileId = profile?.id ?? user?.id ?? portalSession?.accountId ?? '';
  const roleKey = profile?.roleKey ?? portalSession?.roleKey ?? null;
  const context = useMemo(
    () => ({
      tenantId: profile?.tenantId ?? portalSession?.tenantId ?? null,
      clientId: portalSession?.clientId ?? null,
      employeeId: profile?.employeeId ?? portalSession?.employeeId ?? null,
    }),
    [
      portalSession?.clientId,
      portalSession?.employeeId,
      portalSession?.tenantId,
      profile?.employeeId,
      profile?.tenantId,
    ],
  );

  const reload = useCallback(async () => {
    if (!authReady) return;
    if (!isAuthenticated || !profileId || !roleKey) {
      setData(EMPTY_PORTAL_DATA);
      setErrors(['Für Portal-Daten ist eine gültige Sitzung erforderlich.']);
      return;
    }

    setLoading(true);
    const [appointments, documents, messages] = await Promise.all([
      fetchPortalAppointments(profileId, roleKey, context),
      fetchPortalDocuments(profileId, roleKey, context),
      fetchPortalMessages(profileId, roleKey),
    ]);

    setData({
      appointments: appointments.ok ? appointments.data : [],
      documents: documents.ok ? documents.data : [],
      messages: messages.ok ? messages.data : [],
    });
    setErrors(
      [appointments, documents, messages]
        .filter((result) => !result.ok)
        .map((result) => ('error' in result ? result.error : 'Daten konnten nicht geladen werden.')),
    );
    setLoading(false);
  }, [authReady, context, isAuthenticated, profileId, roleKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { context, data, errors, loading, profileId, reload, roleKey };
}

function PortalNavigation({
  active,
  horizontal,
  onSelect,
  sections,
}: {
  active: string;
  horizontal?: boolean;
  onSelect: (section: string) => void;
  sections: PortalSection[];
}) {
  return (
    <ScrollView
      horizontal={horizontal}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={horizontal ? styles.horizontalNavigation : styles.sideNavigation}
      contentContainerStyle={horizontal ? styles.horizontalNavigationContent : styles.sideNavigationContent}
    >
      {sections.map((section) => (
        <Pressable
          key={section.id}
          accessibilityRole="tab"
          accessibilityLabel={section.label}
          accessibilityState={{ selected: section.id === active }}
          onPress={() => onSelect(section.id)}
          style={({ pressed }) => [
            horizontal ? styles.navigationChip : styles.navigationRow,
            section.id === active && styles.navigationActive,
            pressed && styles.pressed,
          ]}
        >
          <LiquidGlyph
            active={section.id === active}
            glyph={section.glyph}
            size={19}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.navigationLabel,
              section.id === active && styles.navigationLabelActive,
            ]}
          >
            {section.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function AppointmentRows({
  appointments,
  liveOnly = false,
}: {
  appointments: PortalAppointmentItem[];
  liveOnly?: boolean;
}) {
  const visible = liveOnly
    ? appointments.filter((item) => statusTone(item.assignmentStatus ?? item.status) === 'live')
    : appointments;
  if (!visible.length) {
    return (
      <LiquidState
        kind="empty"
        title={liveOnly ? 'Keine aktive Anfahrt' : 'Keine Termine'}
        message={
          liveOnly
            ? 'Sobald eine freigegebene Anfahrt beginnt, erscheint hier ein reduzierter Live-Status.'
            : 'Für diesen Portalzugang sind aktuell keine Termine freigegeben.'
        }
      />
    );
  }
  return (
    <View style={styles.rows}>
      {visible.map((appointment) => {
        const status = appointment.assignmentStatus ?? appointment.status;
        return (
          <LiquidSurface key={appointment.id} contentStyle={styles.row}>
            <View style={styles.rowGlyph}><LiquidGlyph glyph="◷" size={19} /></View>
            <View style={styles.rowCopy}>
              <LiquidText variant="section">{appointment.title}</LiquidText>
              <LiquidText variant="meta">
                {formatDateTime(appointment.startsAt)} · {appointment.location || 'Ort folgt'}
              </LiquidText>
              {appointment.clientName ? (
                <LiquidText variant="meta">{appointment.clientName}</LiquidText>
              ) : null}
            </View>
            <LiquidStatus label={String(status).replaceAll('_', ' ')} tone={statusTone(status)} />
          </LiquidSurface>
        );
      })}
    </View>
  );
}

function DocumentRows({
  context,
  documents,
  profileId,
  roleKey,
}: {
  context: { tenantId: string | null; clientId: string | null };
  documents: PortalDocumentListItem[];
  profileId: string;
  roleKey: RoleKey | null;
}) {
  const [selected, setSelected] = useState<PortalDocumentDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const preview = async (documentId: string) => {
    setBusyId(documentId);
    setFeedback(null);
    const result = await fetchPortalDocumentDetail(documentId, profileId, roleKey, context);
    if (result.ok) setSelected(result.data);
    else setFeedback(result.error);
    setBusyId(null);
  };

  const download = async (documentId: string) => {
    setBusyId(documentId);
    setFeedback(null);
    const result = await downloadPortalDocument(documentId, profileId, roleKey, context);
    if (!result.ok) {
      setFeedback(result.error);
    } else if (result.data.downloadUrl) {
      const supported = await Linking.canOpenURL(result.data.downloadUrl);
      if (supported) await Linking.openURL(result.data.downloadUrl);
      else setFeedback('Der sichere Download-Link konnte auf diesem Gerät nicht geöffnet werden.');
    } else {
      setFeedback(`${result.data.fileName} ist im lokalen Dienstmodus zum Download freigegeben.`);
    }
    setBusyId(null);
  };

  if (!documents.length) {
    return (
      <LiquidState
        kind="empty"
        title="Keine Dokumente"
        message="Es sind aktuell keine Dokumente für diesen Portalzugang freigegeben."
      />
    );
  }

  return (
    <View style={styles.split}>
      <View style={styles.splitList}>
        {feedback ? (
          <LiquidStatus
            label={feedback}
            tone={feedback.includes('freigegeben') ? 'success' : 'warning'}
          />
        ) : null}
        {documents.map((document) => (
          <LiquidSurface key={document.id} contentStyle={styles.documentRow}>
            <View style={styles.rowGlyph}><LiquidGlyph glyph="▤" size={19} /></View>
            <View style={styles.rowCopy}>
              <LiquidText variant="section">{document.title}</LiquidText>
              <LiquidText variant="meta">
                {document.displayFileName || document.fileName} · {formatFileSize(document.fileSizeBytes)}
              </LiquidText>
            </View>
            <View style={styles.rowActions}>
              <LiquidButton
                compact
                label="Vorschau"
                loading={busyId === document.id}
                onPress={() => void preview(document.id)}
                variant="secondary"
              />
              <LiquidButton
                compact
                label="Download"
                disabled={busyId !== null}
                onPress={() => void download(document.id)}
              />
            </View>
          </LiquidSurface>
        ))}
      </View>
      {selected ? (
        <LiquidSurface active style={styles.preview} contentStyle={styles.previewContent}>
          <LiquidText variant="kicker">DOKUMENTVORSCHAU</LiquidText>
          <LiquidText variant="title">{selected.title}</LiquidText>
          <LiquidText variant="body">
            {selected.description || 'Für dieses Dokument ist keine zusätzliche Beschreibung hinterlegt.'}
          </LiquidText>
          <LiquidDivider />
          <LiquidStatus
            label={selected.viewReady ? 'Freigegeben' : 'Gesperrt'}
            tone={selected.viewReady ? 'success' : 'danger'}
            detail={selected.mimeType}
          />
          <LiquidButton
            label="Vorschau schließen"
            onPress={() => setSelected(null)}
            variant="ghost"
          />
        </LiquidSurface>
      ) : null}
    </View>
  );
}

function MessageRows({ messages }: { messages: MessageListItem[] }) {
  if (!messages.length) {
    return (
      <LiquidState
        kind="empty"
        title="Keine Nachrichten"
        message="Im freigegebenen Kommunikationsbereich liegen keine Nachrichten vor."
      />
    );
  }
  return (
    <View style={styles.rows}>
      {messages.map((message) => (
        <LiquidSurface key={message.id} contentStyle={styles.row}>
          <View style={styles.rowGlyph}><LiquidGlyph glyph="✉" size={19} /></View>
          <View style={styles.rowCopy}>
            <LiquidText variant="section">{message.subject}</LiquidText>
            <LiquidText variant="meta">
              {message.senderName} · {formatDateTime(message.updatedAt)}
            </LiquidText>
            <LiquidText numberOfLines={2}>{message.body}</LiquidText>
          </View>
          <LiquidStatus
            label={message.readAt ? 'Gelesen' : 'Neu'}
            tone={message.readAt ? 'neutral' : 'live'}
          />
        </LiquidSurface>
      ))}
    </View>
  );
}

function Overview({
  appointments,
  documents,
  messages,
  portal,
  onNavigate,
}: PortalData & {
  portal: 'employee' | 'client' | 'family';
  onNavigate: (section: string) => void;
}) {
  const layout = useLiquidLayout();
  const nextAppointment = appointments[0];
  const unread = messages.filter((message) => !message.readAt).length;
  const quickItems =
    portal === 'employee'
      ? [
          { id: 'appointments', label: 'Einsätze', glyph: '□' },
          { id: 'documents', label: 'Dokumente', glyph: '▤' },
          { id: 'appointments', label: 'Anfahrt', glyph: '➤' },
        ]
      : portal === 'client'
        ? [
            { id: 'appointments', label: 'Termine', glyph: '□' },
            { id: 'documents', label: 'Dokumente', glyph: '▤' },
            { id: 'live', label: 'Anfahrt', glyph: '➤' },
          ]
        : [
            { id: 'appointments', label: 'Termine', glyph: '□' },
            { id: 'documents', label: 'Dokumente', glyph: '▤' },
            { id: 'messages', label: 'Nachrichten', glyph: '✉' },
          ];
  return (
    <View style={styles.sectionGap}>
      {!layout.isPhone ? (
        <View style={styles.quickGrid}>
          {quickItems.map((item, index) => (
            <Pressable
              key={`${item.id}-${index}`}
              accessibilityRole="button"
              onPress={() => onNavigate(item.id)}
              style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
            >
              <LiquidGlyph glyph={item.glyph} size={23} />
              <Text style={styles.quickLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.portalDashboardGrid}>
        <LiquidSurface active style={styles.nextCard} contentStyle={styles.heroCard}>
          <View style={styles.heroCopy}>
            <LiquidText variant="kicker">HEUTE</LiquidText>
            <LiquidText variant="title">
              {nextAppointment ? nextAppointment.title : 'Alles im Plan'}
            </LiquidText>
            <LiquidText variant="body">
              {nextAppointment
                ? `${formatDateTime(nextAppointment.startsAt)} · ${nextAppointment.location || 'Ort folgt'}`
                : portal === 'employee'
                  ? 'Für Ihren Arbeitskontext ist aktuell kein weiterer Einsatz freigegeben.'
                  : 'Für Ihren Versorgungskontext ist aktuell kein weiterer Termin freigegeben.'}
            </LiquidText>
            <LiquidStatus
              label={nextAppointment ? String(nextAppointment.assignmentStatus ?? nextAppointment.status) : 'Aktuell'}
              tone={nextAppointment ? statusTone(nextAppointment.assignmentStatus ?? nextAppointment.status) : 'success'}
            />
            <LiquidButton
              compact
              label={portal === 'employee' ? 'Einsatz öffnen' : 'Termin öffnen'}
              icon="›"
              onPress={() => onNavigate('appointments')}
            />
          </View>
        </LiquidSurface>
        <LiquidSurface style={styles.routeCard} contentStyle={styles.routeCardContent}>
          <View>
            <LiquidText variant="kicker">LIVE ANKUNFT</LiquidText>
            <LiquidText variant="section">Anfahrt im Blick</LiquidText>
          </View>
          <View style={styles.routeStage}>
            <View style={[styles.routeLine, styles.routeLineOne]} />
            <View style={[styles.routeLine, styles.routeLineTwo]} />
            <View style={styles.routePin}><View style={styles.routePinCore} /></View>
          </View>
          <View style={styles.portalFacts}>
            <LiquidMetric label="Termine" value={appointments.length} detail="freigegeben" />
            <LiquidMetric label="Nachrichten" value={unread} detail={unread ? 'neu' : 'gelesen'} />
            <LiquidMetric label="Dokumente" value={documents.length} detail="sichtbar" />
          </View>
          <LiquidButton
            compact
            label="Anfahrt öffnen"
            icon="➤"
            onPress={() => onNavigate(portal === 'employee' ? 'appointments' : 'live')}
          />
        </LiquidSurface>
      </View>
    </View>
  );
}

function InformationalPanel({
  section,
  portal,
}: {
  section: string;
  portal: 'employee' | 'client' | 'family';
}) {
  const content: Record<string, { title: string; message: string; status: string }> = {
    time: {
      title: 'Zeitkonto',
      message: 'Arbeits- und Einsatzzeiten werden aus den freigegebenen produktiven Zeiterfassungen übernommen.',
      status: 'Synchronisiert',
    },
    salary: {
      title: 'Gehaltsunterlagen',
      message: 'Sensible Gehaltsdokumente erscheinen ausschließlich nach individueller Freigabe.',
      status: 'Geschützt',
    },
    invoices: {
      title: 'Rechnungen',
      message: 'Abgerechnete und freigegebene Leistungszeiträume werden hier mandantensicher bereitgestellt.',
      status: 'Freigabegesteuert',
    },
    notices: {
      title: 'Hinweise',
      message: 'Für Angehörige sind ausschließlich explizit freigegebene Informationen sichtbar.',
      status: 'Minimalprinzip',
    },
  };
  const item = content[section] ?? {
    title: portal === 'employee' ? 'Mitarbeitendenbereich' : 'Portalbereich',
    message: 'Dieser Bereich verwendet die rollenbasierte Freigabe des aktuellen Systems.',
    status: 'Berechtigt',
  };
  return (
    <LiquidSurface active contentStyle={styles.infoPanel}>
      <View style={styles.infoGlyph}><LiquidGlyph glyph="⌑" size={24} /></View>
      <LiquidText variant="kicker">{item.status.toUpperCase()}</LiquidText>
      <LiquidText variant="title">{item.title}</LiquidText>
      <LiquidText variant="body">{item.message}</LiquidText>
      <LiquidStatus label={item.status} tone="neutral" />
    </LiquidSurface>
  );
}

function PortalContent({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <View accessibilityLabel={`Portalbereich ${active}`} style={styles.content}>
      {children}
    </View>
  );
}

export function PortalHomeScreen({
  portal,
}: {
  portal: 'employee' | 'client' | 'family';
}) {
  const router = useRouter();
  const auth = useAuth();
  const layout = useLiquidLayout();
  const definition = portalDefinitions[portal];
  const [active, setActive] = useState('today');
  const { context, data, errors, loading, profileId, reload, roleKey } = usePortalData();
  const displayName =
    auth.profile?.displayName || auth.portalSession?.displayName || auth.user?.displayName || 'Portal';
  const compactSections = definition.sections.filter((section) =>
    ['today', 'appointments', 'documents', 'messages', 'salary'].includes(section.id),
  );

  const signOut = async () => {
    await auth.signOut();
    router.replace('/auth' as never);
  };

  if (auth.authReady && (!auth.isAuthenticated || roleKey !== definition.allowedRole)) {
    return (
      <LiquidBackdrop>
        <View style={styles.guard}>
          <LiquidState
            kind="locked"
            title="Portalzugang erforderlich"
            message={`Dieser Bereich ist ausschließlich für ${definition.title} freigegeben.`}
            actionLabel="Zum passenden Zugang"
            onAction={() => router.replace('/auth' as never)}
          />
        </View>
      </LiquidBackdrop>
    );
  }

  const renderContent = () => {
    if (loading && !data.appointments.length && !data.documents.length && !data.messages.length) {
      return (
        <LiquidState
          kind="loading"
          title="Portal wird vorbereitet"
          message="Freigegebene Termine, Dokumente und Nachrichten werden geladen."
        />
      );
    }
    if (errors.length && !data.appointments.length && !data.documents.length && !data.messages.length) {
      return (
        <LiquidState
          kind="error"
          title="Portal-Daten nicht verfügbar"
          message={errors.join(' ')}
          actionLabel="Erneut laden"
          onAction={() => void reload()}
        />
      );
    }
    if (active === 'today') return <Overview {...data} portal={portal} onNavigate={setActive} />;
    if (active === 'appointments') return <AppointmentRows appointments={data.appointments} />;
    if (active === 'live') return <AppointmentRows appointments={data.appointments} liveOnly />;
    if (active === 'documents') {
      return (
        <DocumentRows
          context={context}
          documents={data.documents}
          profileId={profileId}
          roleKey={roleKey}
        />
      );
    }
    if (active === 'messages') return <MessageRows messages={data.messages} />;
    return <InformationalPanel portal={portal} section={active} />;
  };

  return (
    <LiquidBackdrop>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <LiquidLogo compact />
          {layout.isDesktop ? (
            <View style={styles.topContext}>
              <Text style={styles.topEyebrow}>{definition.eyebrow}</Text>
              <Text style={styles.topTitle}>{definition.title}</Text>
            </View>
          ) : <View style={styles.topContext} />}
          <View style={styles.topActions}>
            {layout.isDesktop ? (
              <>
                <LiquidStatus label={displayName} tone="success" detail="angemeldet" />
                <LiquidButton compact label="Abmelden" variant="ghost" onPress={() => void signOut()} />
              </>
            ) : (
              <>
                <LiquidIconButton
                  label="Benachrichtigungen"
                  glyph="♧"
                  onPress={() => setActive('messages')}
                />
                <LiquidIconButton
                  label={portal === 'family' ? 'Abmelden' : 'Profil'}
                  glyph="♙"
                  onPress={() => portal === 'family'
                    ? void signOut()
                    : router.push(`/portal/${portal}/profile` as never)}
                />
              </>
            )}
          </View>
        </View>
        {layout.isDesktop ? (
          <View style={styles.portalGrid}>
            <LiquidSurface solid style={styles.sidePanel} contentStyle={styles.sidePanelContent}>
              <LiquidText variant="kicker">PORTALNAVIGATION</LiquidText>
              <PortalNavigation
                active={active}
                onSelect={setActive}
                sections={definition.sections}
              />
              <View style={styles.sideFooter}>
                <LiquidDivider />
                <LiquidText variant="meta">
                  Sie sehen nur Inhalte, die für Ihren Zugang freigegeben sind.
                </LiquidText>
              </View>
            </LiquidSurface>
            <ScrollView
              style={styles.workspace}
              contentContainerStyle={styles.workspaceContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.pageHeading}>
                <LiquidText variant="kicker">{definition.eyebrow}</LiquidText>
                <LiquidText variant="display" accessibilityRole="header">
                  {definition.sections.find((section) => section.id === active)?.label}
                </LiquidText>
                <LiquidText variant="body">Guten Tag, {displayName}.</LiquidText>
              </View>
              {errors.length ? <LiquidStatus label={errors[0]} tone="warning" /> : null}
              <PortalContent active={active}>{renderContent()}</PortalContent>
            </ScrollView>
          </View>
        ) : (
          <View style={styles.mobileBody}>
            <ScrollView
              style={styles.workspace}
              contentContainerStyle={styles.mobileWorkspaceContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.pageHeading, active === 'today' && styles.pageHeadingToday]}>
                <LiquidText variant="kicker">{definition.eyebrow}</LiquidText>
                <LiquidText variant={layout.isPhone ? 'title' : 'display'} accessibilityRole="header">
                  {definition.sections.find((section) => section.id === active)?.label}
                </LiquidText>
                <LiquidText variant="body">Guten Tag, {displayName}.</LiquidText>
              </View>
              {errors.length ? <LiquidStatus label={errors[0]} tone="warning" /> : null}
              <PortalContent active={active}>{renderContent()}</PortalContent>
            </ScrollView>
            <View style={styles.portalBottomNav}>
              <PortalNavigation
                active={active}
                horizontal
                onSelect={setActive}
                sections={compactSections}
              />
            </View>
          </View>
        )}
      </View>
    </LiquidBackdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: '100%' },
  topBar: {
    minHeight: 68,
    paddingHorizontal: liquidSpace.xl,
    paddingVertical: liquidSpace.md,
    borderBottomWidth: 1,
    borderBottomColor: liquidColors.white12,
    backgroundColor: liquidColors.navy900,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.lg,
  },
  topContext: { flex: 1 },
  topEyebrow: {
    color: liquidColors.blue300,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  topTitle: { color: liquidColors.white, fontSize: 16, fontWeight: '700' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: liquidSpace.sm },
  portalGrid: { flex: 1, flexDirection: 'row' },
  sidePanel: { width: 260, borderRadius: 0, borderTopWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  sidePanelContent: { flex: 1, borderRadius: 0, padding: liquidSpace.lg },
  sideNavigation: { flex: 1, marginTop: liquidSpace.lg },
  sideNavigationContent: { gap: liquidSpace.xs },
  navigationRow: {
    minHeight: 50,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.sm,
  },
  navigationChip: {
    minHeight: 44,
    paddingHorizontal: liquidSpace.md,
    borderRadius: liquidRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.xs,
    borderWidth: 1,
    borderColor: liquidColors.white12,
  },
  navigationActive: {
    backgroundColor: liquidColors.blue500,
    borderColor: liquidColors.blue300,
  },
  navigationGlyph: { color: liquidColors.white, fontSize: 17 },
  navigationLabel: { color: liquidColors.white64, fontSize: 14, fontWeight: '600' },
  navigationLabelActive: { color: liquidColors.white },
  sideFooter: { gap: liquidSpace.md },
  workspace: { flex: 1 },
  workspaceContent: { padding: liquidSpace.xxl, gap: liquidSpace.xl },
  mobileBody: { flex: 1 },
  horizontalNavigation: { flexGrow: 0 },
  horizontalNavigationContent: { paddingHorizontal: liquidSpace.sm, paddingVertical: liquidSpace.sm, gap: liquidSpace.sm },
  mobileWorkspaceContent: { padding: liquidSpace.lg, paddingBottom: 100, gap: liquidSpace.lg },
  portalBottomNav: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    minHeight: 72,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(3,17,39,0.96)',
  },
  pageHeading: { gap: liquidSpace.xs },
  pageHeadingToday: {
    paddingBottom: liquidSpace.xs,
  },
  content: { gap: liquidSpace.lg },
  sectionGap: { gap: liquidSpace.lg },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.md,
  },
  quickCard: {
    minHeight: 126,
    minWidth: 116,
    flex: 1,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(7,30,61,0.76)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: liquidSpace.sm,
  },
  quickGlyph: {
    color: liquidColors.blue400,
    fontSize: 34,
    lineHeight: 39,
    textShadowColor: liquidColors.blue500,
    textShadowRadius: 12,
  },
  quickLabel: {
    color: liquidColors.blue200,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  portalDashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.lg,
  },
  nextCard: {
    minWidth: 280,
    flex: 1,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.md },
  heroCard: {
    padding: liquidSpace.xl,
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: liquidSpace.lg,
  },
  heroCopy: { flex: 1, gap: liquidSpace.xs },
  routeCard: {
    minWidth: 320,
    flex: 1.3,
  },
  routeCardContent: {
    padding: liquidSpace.lg,
    gap: liquidSpace.md,
  },
  routeStage: {
    position: 'relative',
    minHeight: 130,
    overflow: 'hidden',
    borderRadius: liquidRadius.small,
    backgroundColor: 'rgba(2,14,32,0.72)',
  },
  routeLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: liquidColors.blue400,
    shadowColor: liquidColors.blue500,
    shadowOpacity: 1,
    shadowRadius: 9,
  },
  routeLineOne: {
    top: '52%',
    left: '12%',
    width: '72%',
    transform: [{ rotate: '-16deg' }],
  },
  routeLineTwo: {
    top: '48%',
    left: '38%',
    width: '48%',
    transform: [{ rotate: '23deg' }],
  },
  routePin: {
    position: 'absolute',
    top: '44%',
    left: '48%',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: liquidColors.blue200,
    backgroundColor: 'rgba(22,131,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routePinCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: liquidColors.blue400,
  },
  portalFacts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.sm,
  },
  rows: { gap: liquidSpace.sm },
  row: {
    minHeight: 82,
    padding: liquidSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.md,
  },
  rowGlyph: {
    width: 42,
    height: 42,
    borderRadius: liquidRadius.md,
    backgroundColor: liquidColors.blue500Alpha16,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowGlyphText: { color: liquidColors.blue300, fontSize: 19 },
  rowCopy: { flex: 1, gap: liquidSpace.xs },
  documentRow: {
    padding: liquidSpace.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.md,
  },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.sm },
  split: { flexDirection: 'row', flexWrap: 'wrap', gap: liquidSpace.lg },
  splitList: { flex: 2, minWidth: 300, gap: liquidSpace.sm },
  preview: { flex: 1, minWidth: 260 },
  previewContent: { padding: liquidSpace.xl, gap: liquidSpace.md },
  infoPanel: {
    maxWidth: 680,
    padding: liquidSpace.xxl,
    alignItems: 'flex-start',
    gap: liquidSpace.md,
  },
  infoGlyph: {
    width: 64,
    height: 64,
    borderRadius: liquidRadius.lg,
    backgroundColor: liquidColors.blue500Alpha16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoGlyphText: { color: liquidColors.blue300, fontSize: 28 },
  guard: {
    flex: 1,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    justifyContent: 'center',
    padding: liquidSpace.xl,
  },
  pressed: { opacity: 0.78 },
  focused: { borderColor: liquidColors.blue300, borderWidth: 2 },
});
