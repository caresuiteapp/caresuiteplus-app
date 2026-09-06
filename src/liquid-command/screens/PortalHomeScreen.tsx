import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
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
  formatFileSize,
  type PortalAppointmentItem,
} from '@/lib/portal';
import { usePortalOfficeMessages } from '@/hooks/useportalofficemessages';
import type { RoleKey } from '@/types';
import type { OfficeMessageThread } from '@/types/office/messaging';
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
  LiquidVisualModeProvider,
} from '../components/LiquidPrimitives';
import { liquidClassicColors as liquidColors, liquidRadius, liquidSpace } from '../foundation/tokens';
import { useLiquidLayout } from '../foundation/useLiquidLayout';
import {
  liquidPortalLoginRoutes,
  liquidPortalNavigation,
} from '../navigation/portalCatalog';
import type { LiquidPortalKey } from '../types';
import {
  employeePortalHomeAppointmentTitle,
  selectPortalHomeAppointment,
} from '@/lib/portal/portalHomeAppointment';
import {
  resolveEmployeePortalAssignmentNavigationRoute,
  resolveEmployeePortalAssignmentPendingFlags,
} from '@/lib/portal/employeePortalAssignmentCompletion';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { usePortalActor } from '@/hooks/usePortalActor';
import { EmployeeLogbookWidget } from '../components/EmployeeLogbookWidget';

type PortalSection = {
  id: string;
  label: string;
  glyph: string;
  route: string;
};

type PortalData = {
  appointments: PortalAppointmentItem[];
  documents: PortalDocumentListItem[];
};

const EMPTY_PORTAL_DATA: PortalData = {
  appointments: [],
  documents: [],
};

function PortalAmbientPulse() {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let animation: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      animation = Animated.loop(
        Animated.timing(progress, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      );
      animation.start();
    });
    return () => {
      mounted = false;
      animation?.stop();
    };
  }, [progress]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.routePulse,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0.52, 0.3, 0] }),
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.55] }) }],
        },
      ]}
    />
  );
}

function PortalGuide({ message }: { message: string }) {
  return (
    <View style={styles.guide} accessibilityLabel={`CareSuite Hinweis: ${message}`}>
      <View style={styles.guideCharacterFrame}>
        <View style={styles.guideCharacterGlow} />
        <Image
          resizeMode="contain"
          source={require('../../../assets/auth/access-employee.png')}
          style={styles.guideCharacter}
        />
      </View>
      <View style={styles.guideBubble}>
        <View style={styles.guideBubbleTail} />
        <Text style={styles.guideBubbleText}>{message}</Text>
      </View>
    </View>
  );
}

function portalSections(kind: 'employee' | 'client'): PortalSection[] {
  return liquidPortalNavigation[kind].map((item) => ({
    id: item.id === 'home' ? 'today' : item.id,
    label: item.label,
    glyph: item.glyph,
    route: item.route,
  }));
}

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
    sections: portalSections('employee'),
  },
  client: {
    title: 'Klientenportal',
    eyebrow: 'MEINE VERSORGUNG',
    allowedRole: 'client_portal',
    sections: portalSections('client'),
  },
  family: {
    title: 'Angehörigenportal',
    eyebrow: 'FREIGEGEBENE INFORMATIONEN',
    allowedRole: 'family_portal',
    sections: portalSections('client'),
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

function usePortalData(portal: 'employee' | 'client' | 'family') {
  const { authReady, isAuthenticated } = useAuth();
  const { tenantId, clientId, employeeId, actorId, roleKey } = usePortalActor();
  const [data, setData] = useState<PortalData>(EMPTY_PORTAL_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const profileId = actorId ?? '';
  const roleMatchesPortal =
    (portal === 'employee' && roleKey === 'employee_portal') ||
    (portal === 'client' && roleKey === 'client_portal') ||
    (portal === 'family' && roleKey === 'family_portal');
  const context = useMemo(
    () => ({
      tenantId,
      clientId: portal !== 'employee' && roleMatchesPortal ? clientId : null,
      employeeId: portal === 'employee' && roleMatchesPortal ? employeeId : null,
    }),
    [clientId, employeeId, portal, roleMatchesPortal, tenantId],
  );

  const reload = useCallback(async () => {
    if (!authReady) return;
    if (!isAuthenticated || !profileId || !roleKey || !roleMatchesPortal) {
      setData(EMPTY_PORTAL_DATA);
      setErrors([
        roleKey && !roleMatchesPortal
          ? 'Diese Sitzung gehört zu einem anderen Portal.'
          : 'Für Portal-Daten ist eine gültige Sitzung erforderlich.',
      ]);
      return;
    }

    setLoading(true);
    const [appointments, documents] = await Promise.all([
      fetchPortalAppointments(profileId, roleKey, context),
      fetchPortalDocuments(profileId, roleKey, context),
    ]);

    setData({
      appointments: appointments.ok ? appointments.data : [],
      documents: documents.ok ? documents.data : [],
    });
    setErrors(
      [appointments, documents].flatMap((result) =>
        result.ok ? [] : [result.error],
      ),
    );
    setLoading(false);
  }, [authReady, context, isAuthenticated, profileId, roleKey, roleMatchesPortal]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { context, data, errors, loading, profileId, reload, roleKey };
}

function PortalNavigation({
  active,
  horizontal,
  onSelect,
  onSignOut,
  sections,
}: {
  active: string;
  horizontal?: boolean;
  onSelect: (section: string) => void;
  onSignOut: () => void;
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sicher abmelden"
        onPress={onSignOut}
        style={({ pressed }) => [
          horizontal ? styles.navigationChip : styles.navigationRow,
          styles.navigationLogout,
          pressed && styles.pressed,
        ]}
      >
        <LiquidGlyph glyph="↪" size={19} />
        <Text numberOfLines={1} style={styles.navigationLabel}>Abmelden</Text>
      </Pressable>
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

function MessageRows({
  onOpen,
  threads,
}: {
  onOpen: (threadId: string) => void;
  threads: OfficeMessageThread[];
}) {
  if (!threads.length) {
    return (
      <LiquidState
        kind="empty"
        title="Keine aktiven Chats"
        message="Im freigegebenen Kommunikationsbereich ist aktuell kein Chat geöffnet."
      />
    );
  }
  return (
    <View style={styles.rows}>
      {threads.map((thread) => (
        <Pressable
          key={thread.id}
          accessibilityRole="button"
          accessibilityLabel={`Chat ${thread.subject} öffnen`}
          onPress={() => onOpen(thread.id)}
        >
          <LiquidSurface contentStyle={styles.row}>
            <View style={styles.rowGlyph}><LiquidGlyph glyph="▱" size={19} /></View>
            <View style={styles.rowCopy}>
              <LiquidText variant="section">{thread.subject}</LiquidText>
              <LiquidText variant="meta">
                {thread.categoryLabel || 'Kommunikation'} · {formatDateTime(thread.lastMessageAt ?? thread.updatedAt)}
              </LiquidText>
              <LiquidText numberOfLines={2}>{thread.lastMessagePreview || 'Noch keine Nachricht'}</LiquidText>
            </View>
            <LiquidStatus
              label={thread.unreadCount ? `${thread.unreadCount} neu` : 'Aktiv'}
              tone={thread.unreadCount ? 'live' : 'neutral'}
            />
          </LiquidSurface>
        </Pressable>
      ))}
    </View>
  );
}

function Overview({
  appointments,
  documents,
  threads,
  portal,
  onNavigate,
  onOpenAppointment,
}: PortalData & {
  threads: OfficeMessageThread[];
  portal: 'employee' | 'client' | 'family';
  onNavigate: (section: string) => void;
  onOpenAppointment: (appointment: PortalAppointmentItem) => void;
}) {
  const layout = useLiquidLayout();
  const nextAppointment = selectPortalHomeAppointment(appointments);
  const nextAppointmentTitle =
    nextAppointment && portal === 'employee'
      ? employeePortalHomeAppointmentTitle(nextAppointment)
      : nextAppointment?.title;
  const unread = threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const activeChats = threads.length;
  const quickItems =
    portal === 'employee'
      ? [
          { id: 'assignments', label: 'Einsätze', glyph: '□' },
          { id: 'logbook', label: 'Fahrtenbuch', glyph: '⌖' },
          { id: 'documents', label: 'Dokumente', glyph: '▤' },
          { id: 'messages', label: 'Nachrichten', glyph: '▱' },
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
      {portal === 'employee' ? (
        <PortalGuide
          message={
            nextAppointment
              ? `Dein nächster Einsatz beginnt ${formatDateTime(nextAppointment.startsAt)}. Alles Wichtige findest du direkt in der Einsatzkarte.`
              : 'Für heute steht aktuell kein weiterer Einsatz an. Neue Einsätze und Nachrichten erscheinen hier automatisch.'
          }
        />
      ) : null}
      {portal === 'employee' ? <EmployeeLogbookWidget /> : null}
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
      <View
        style={[
          styles.portalDashboardGrid,
          layout.isPhone && styles.portalDashboardGridPhone,
        ]}
      >
        <LiquidSurface
          active
          style={[styles.nextCard, layout.isPhone && styles.dashboardCardPhone]}
          contentStyle={styles.heroCard}
        >
          <View style={styles.heroCopy}>
            <LiquidText variant="kicker">HEUTE</LiquidText>
            <LiquidText variant="title">
              {nextAppointmentTitle ?? 'Alles im Plan'}
            </LiquidText>
            <LiquidText variant="body">
              {nextAppointment
                ? `${formatDateTime(nextAppointment.startsAt)} · ${nextAppointment.location || 'Ort folgt'}`
                : portal === 'employee'
                  ? 'Für heute steht aktuell kein weiterer Einsatz an.'
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
              onPress={() =>
                nextAppointment
                  ? onOpenAppointment(nextAppointment)
                  : onNavigate(portal === 'employee' ? 'assignments' : 'appointments')}
            />
          </View>
        </LiquidSurface>
        <LiquidSurface
          active
          style={[styles.routeCard, layout.isPhone && styles.dashboardCardPhone]}
          contentStyle={styles.routeCardContent}
        >
          <View style={styles.routeHeader}>
            <View>
              <LiquidText variant="kicker">ARBEITSCOCKPIT</LiquidText>
              <LiquidText variant="section">Heute auf einen Blick</LiquidText>
            </View>
            <LiquidStatus
              label={nextAppointment ? 'Bereit' : 'Kein Einsatz'}
              tone={nextAppointment ? 'live' : 'neutral'}
            />
          </View>
          <View style={styles.routeStage}>
            <PortalAmbientPulse />
            <View style={styles.routeOrbitOuter} />
            <View style={styles.routeOrbitInner} />
            <View style={styles.routePin}><LiquidGlyph active glyph="➤" size={24} /></View>
            <View style={styles.routeStageCopy}>
              <Text style={styles.routeStageEyebrow}>{nextAppointment ? 'NÄCHSTER START' : 'TAGESSTATUS'}</Text>
              <Text style={styles.routeStageTitle}>
                {nextAppointment ? formatDateTime(nextAppointment.startsAt) : 'Alles erledigt'}
              </Text>
              <Text style={styles.routeStageMeta} numberOfLines={2}>
                {nextAppointment?.location || 'Neue Einsätze erscheinen hier automatisch.'}
              </Text>
            </View>
          </View>
          <View style={styles.portalFacts}>
            <LiquidMetric label="Termine" value={appointments.length} detail="freigegeben" />
            <LiquidMetric
              label="Aktive Chats"
              value={activeChats}
              detail={unread ? `${unread} ungelesen` : 'aktuell'}
            />
            <LiquidMetric label="Dokumente" value={documents.length} detail="sichtbar" />
          </View>
          <LiquidButton
            compact
            label={nextAppointment ? 'Einsatz und Anfahrt öffnen' : 'Einsätze öffnen'}
            icon="➤"
            onPress={() => onNavigate(portal === 'employee' ? 'assignments' : 'live')}
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
  const { context, data, errors, loading, profileId, reload, roleKey } = usePortalData(portal);
  const visibleSections = definition.sections;
  const officeMessages = usePortalOfficeMessages('open');
  const displayName =
    auth.profile?.displayName || auth.portalSession?.displayName || auth.user?.displayName || 'Portal';
  const mobileSections = visibleSections;
  const clientFacingPortal = portal === 'family' ? 'client' : portal;
  const loginRoute = liquidPortalLoginRoutes[clientFacingPortal];

  const navigateToSection = (sectionId: string) => {
    const section = visibleSections.find((item) => item.id === sectionId);
    if (!section || section.id === 'today') {
      setActive('today');
      return;
    }
    router.replace(section.route as never);
  };

  const openAppointment = (appointment: PortalAppointmentItem) => {
    if (portal === 'employee') {
      const status =
        appointment.assignmentStatus ?? remoteStatusToAssignment(appointment.status);
      const pending = resolveEmployeePortalAssignmentPendingFlags({
        status,
        assignmentIncomplete: appointment.assignmentIncomplete,
        documentationPending: appointment.documentationPending,
        signaturePending: appointment.signaturePending,
      });
      router.push(
        resolveEmployeePortalAssignmentNavigationRoute({
          assignmentId: appointment.id,
          status,
          documentationPending: pending.documentationPending,
          signaturePending: pending.signaturePending,
        }) as never,
      );
      return;
    }
    if (portal === 'client') {
      router.push(`/portal/client/appointments/${appointment.id}` as never);
      return;
    }
    navigateToSection('appointments');
  };

  const signOut = async () => {
    await auth.signOut();
    router.replace('/' as never);
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
            onAction={() => router.replace(loginRoute as never)}
          />
        </View>
      </LiquidBackdrop>
    );
  }

  const renderContent = () => {
    if (loading && !data.appointments.length && !data.documents.length) {
      return (
        <LiquidState
          kind="loading"
          title="Portal wird vorbereitet"
          message="Freigegebene Termine, Dokumente und Nachrichten werden geladen."
        />
      );
    }
    if (errors.length && !data.appointments.length && !data.documents.length) {
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
    if (active === 'today') {
      return (
        <Overview
          {...data}
          onNavigate={navigateToSection}
          onOpenAppointment={openAppointment}
          portal={portal}
          threads={officeMessages.threads}
        />
      );
    }
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
    if (active === 'messages') {
      return (
        <MessageRows
          onOpen={(threadId) => router.push(
            `/portal/${clientFacingPortal}/messages/${threadId}` as never,
          )}
          threads={officeMessages.threads}
        />
      );
    }
    return <InformationalPanel portal={portal} section={active} />;
  };

  return (
    <LiquidVisualModeProvider mode="classic">
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
                  onPress={() => navigateToSection('messages')}
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
                onSelect={navigateToSection}
                onSignOut={() => void signOut()}
                sections={visibleSections}
              />
              <View style={styles.sideFooter}>
                <LiquidDivider />
                <LiquidStatus label="Sicher verbunden" tone="success" />
              </View>
            </LiquidSurface>
            <ScrollView
              style={[styles.workspace, styles.workspaceWeb]}
              contentContainerStyle={styles.workspaceContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.pageHeading}>
                <LiquidText variant="kicker">{definition.eyebrow}</LiquidText>
                <LiquidText variant="display" accessibilityRole="header">
                  {visibleSections.find((section) => section.id === active)?.label}
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
              style={[styles.workspace, styles.workspaceWeb]}
              contentContainerStyle={styles.mobileWorkspaceContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.pageHeading, active === 'today' && styles.pageHeadingToday]}>
                <LiquidText variant="kicker">{definition.eyebrow}</LiquidText>
                <LiquidText variant={layout.isPhone ? 'title' : 'display'} accessibilityRole="header">
                  {visibleSections.find((section) => section.id === active)?.label}
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
                onSelect={navigateToSection}
                onSignOut={() => void signOut()}
                sections={mobileSections}
              />
            </View>
          </View>
        )}
      </View>
      </LiquidBackdrop>
    </LiquidVisualModeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' },
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
  portalGrid: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'row' },
  sidePanel: { width: 228, borderRadius: 0, borderTopWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
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
  navigationLogout: {
    borderColor: liquidColors.blue300Alpha32,
  },
  navigationGlyph: { color: liquidColors.white, fontSize: 17 },
  navigationLabel: { color: liquidColors.white64, fontSize: 14, fontWeight: '600' },
  navigationLabelActive: { color: liquidColors.white },
  sideFooter: { gap: liquidSpace.md },
  workspace: { flex: 1, minWidth: 0, minHeight: 0 },
  workspaceWeb:
    Platform.OS === 'web'
      ? ({ overflowX: 'hidden', touchAction: 'pan-y' } as never)
      : {},
  workspaceContent: {
    width: '100%',
    maxWidth: 1680,
    alignSelf: 'center',
    flexGrow: 1,
    padding: liquidSpace.xxl,
    gap: liquidSpace.xl,
  },
  mobileBody: { flex: 1, minWidth: 0, minHeight: 0 },
  horizontalNavigation: { flexGrow: 0 },
  horizontalNavigationContent: { paddingHorizontal: liquidSpace.sm, paddingVertical: liquidSpace.sm, gap: liquidSpace.sm },
  mobileWorkspaceContent: {
    width: '100%',
    flexGrow: 1,
    padding: liquidSpace.lg,
    paddingBottom: 100,
    gap: liquidSpace.lg,
  },
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
  guide: {
    minHeight: 92,
    paddingHorizontal: liquidSpace.lg,
    paddingVertical: liquidSpace.sm,
    borderRadius: liquidRadius.lg,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(7,30,61,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: liquidSpace.md,
    overflow: 'hidden',
  },
  guideCharacterFrame: { width: 76, height: 76, alignItems: 'center', justifyContent: 'flex-end' },
  guideCharacterGlow: {
    position: 'absolute', width: 62, height: 62, borderRadius: 31,
    backgroundColor: 'rgba(53,151,255,0.22)', shadowColor: liquidColors.blue400,
    shadowOpacity: 0.72, shadowRadius: 18,
  },
  guideCharacter: { width: 72, height: 82 },
  guideBubble: {
    flex: 1, minWidth: 0, paddingHorizontal: liquidSpace.lg, paddingVertical: liquidSpace.md,
    borderRadius: 17, borderWidth: 1, borderColor: liquidColors.white18,
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  guideBubbleTail: {
    position: 'absolute', left: -7, top: 27, width: 14, height: 14,
    backgroundColor: 'rgba(22,45,75,0.98)', borderLeftWidth: 1,
    borderBottomWidth: 1, borderColor: liquidColors.white18,
    transform: [{ rotate: '45deg' }],
  },
  guideBubbleText: { color: liquidColors.white88, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: liquidSpace.md,
  },
  quickCard: {
    minHeight: 112,
    minWidth: 116,
    flex: 1,
    borderRadius: liquidRadius.card,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(7,30,61,0.92)',
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
  portalDashboardGridPhone: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    width: '100%',
    minWidth: 0,
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
  dashboardCardPhone: {
    flex: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
  },
  routeCardContent: {
    padding: liquidSpace.lg,
    gap: liquidSpace.md,
  },
  routeHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: liquidSpace.md },
  routeStage: {
    position: 'relative',
    minHeight: 150,
    overflow: 'hidden',
    borderRadius: liquidRadius.lg,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(2,14,32,0.88)',
    justifyContent: 'center',
    paddingLeft: 146,
    paddingRight: liquidSpace.lg,
  },
  routeOrbitOuter: {
    position: 'absolute',
    left: 24,
    top: 22,
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 1,
    borderColor: liquidColors.blue300Alpha32,
    backgroundColor: 'rgba(22,131,255,0.07)',
    shadowColor: liquidColors.blue500,
    shadowOpacity: 0.7,
    shadowRadius: 18,
  },
  routePulse: {
    position: 'absolute', left: 35, top: 33, width: 84, height: 84,
    borderRadius: 42, borderWidth: 2, borderColor: liquidColors.blue300,
    backgroundColor: 'rgba(53,151,255,0.08)',
  },
  routeOrbitInner: {
    position: 'absolute', left: 42, top: 40, width: 70, height: 70,
    borderRadius: 35, borderWidth: 1, borderColor: liquidColors.blue300,
    backgroundColor: 'rgba(22,131,255,0.10)',
  },
  routePin: {
    position: 'absolute',
    top: 56,
    left: 58,
    width: 38,
    height: 38,
    borderRadius: 19,
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
  routeStageCopy: { gap: 3, minWidth: 0 },
  routeStageEyebrow: { color: liquidColors.blue200, fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.1 },
  routeStageTitle: { color: liquidColors.white, fontSize: 18, lineHeight: 23, fontWeight: '800' },
  routeStageMeta: { color: liquidColors.white64, fontSize: 12, lineHeight: 17, fontWeight: '500' },
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
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  focused: { borderColor: liquidColors.blue300, borderWidth: 2 },
});
