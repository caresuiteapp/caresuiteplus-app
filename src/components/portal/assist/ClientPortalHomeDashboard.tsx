import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useWebFontScaleValue } from '@/design/web/WebFontScaleProvider';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { withCareSuiteTypography } from '@/design/withCareSuiteTypography';
import { ClientSignatureAttentionBanner } from '@/components/portal/ClientSignatureAttentionBanner';
import { PortalInfoButton } from '@/components/portal/PortalInfoButton';
import { PremiumButton } from '@/components/ui';
import { ClientBudgetVisualCards } from '@/components/office/ClientBudgetVisualCards';
import { ClientPortalArtwork } from '@/components/portal/client/ClientPortalArtwork';
import { clientPortalDesign as c, clientPortalLayout } from '@/components/portal/client/clientPortalDesign';
import { useClientPortalMenu } from '@/components/portal/client/ClientPortalMenuContext';
import { PortalNextAppointmentHero } from './PortalNextAppointmentHero';
import { resolveClientPortalHeroLines } from '@/lib/portal/clientPortalGreeting';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData } from '@/types/portal/assist';
import { familyPortalAllows, familyPortalFeatureAllowed } from '@/lib/portal/familyPortalAccessScope';
export type ClientPortalHomeGuide = { title: string; message: string; actionLabel?: string; target?: 'messages' | 'proofs' | 'signatures' | 'requests' | 'appointments' };
type ClientPortalHomeDashboardProps = {
  context: PortalContext;
  data: AssistDashboardData;
  tripsReleased: boolean;
  budgetReleased: boolean;
  proofsReleased: boolean;
  requestsReleased: boolean;
  uploadReleased?: boolean;
  activitiesReleased: boolean;
  onRequestChange: () => void;
  onRequestExtra: () => void;
  onUpload: () => void;
  onProofs: () => void;
  onOpenRequests: () => void;
  onOpenActivities: () => void;
  onRequestCallback: () => void;
};

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function resolveClientPortalHomeGuide(data: AssistDashboardData): ClientPortalHomeGuide {
  if (data.kpis.signatures > 0) {
    return {
      title: 'Ihre Unterschrift wird benötigt',
      message: `${plural(data.kpis.signatures, 'Dokument wartet', 'Dokumente warten')} noch auf Ihre Unterschrift.`,
      actionLabel: 'Jetzt unterschreiben',
      target: 'signatures',
    };
  }
  if (data.kpis.messages > 0) {
    return {
      title: 'Sie haben neue Nachrichten',
      message: `${plural(data.kpis.messages, 'Nachricht ist', 'Nachrichten sind')} für Sie eingegangen.`,
      actionLabel: 'Nachrichten lesen',
      target: 'messages',
    };
  }
  if (data.kpis.proofs > 0) {
    return {
      title: 'Ein Nachweis ist noch offen',
      message: `${plural(data.kpis.proofs, 'Nachweis benötigt', 'Nachweise benötigen')} noch Ihre Aufmerksamkeit.`,
      actionLabel: 'Nachweise öffnen',
      target: 'proofs',
    };
  }
  if (data.kpis.openRequests > 0) {
    return {
      title: 'Ihre Anfrage ist in Bearbeitung',
      message: `${plural(data.kpis.openRequests, 'Anfrage bleibt', 'Anfragen bleiben')} für Sie im Blick.`,
      actionLabel: 'Anfragen ansehen',
      target: 'requests',
    };
  }
  if (data.nextAppointment) {
    return {
      title: 'Alles Wichtige ist vorbereitet',
      message: 'Ihr nächster Einsatz ist geplant. Die Einzelheiten finden Sie direkt unter dieser Begrüßung.',
      actionLabel: 'Zum nächsten Einsatz',
      target: 'appointments',
    };
  }
  return {
    title: 'Schön, dass Sie da sind',
    message: 'Aktuell ist nichts dringend. Sie können jederzeit einen Einsatz anfragen oder uns schreiben.',
  };
}

type AreaItem = { id: string; label: string; route: string; count?: number };
function AreaGroup({ title, items, columns }: { title: string; items: AreaItem[]; columns: number }) {
  const router = useRouter();
  if (!items.length) return null;
  return <View style={[styles.areaPanel, { flexBasis: columns === 3 ? '31.8%' : columns === 2 ? '48.5%' : '100%' }]}>
    <Text accessibilityRole="header" style={styles.areaTitle}>{title}</Text>
    {items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label}
      onPress={() => router.push(item.route as never)} style={({ pressed }) => [styles.areaRow, pressed && styles.pressed]}>
      <ClientPortalArtwork id={item.id} label={item.label} size={58} /><Text style={styles.areaLabel}>{item.label}</Text>
      {item.count && item.count > 0 ? <Text style={styles.count}>{item.count}</Text> : null}
      <Ionicons name="chevron-forward" size={19} color={c.accent.blue} />
    </Pressable>)}
  </View>;
}
export function ClientPortalHomeDashboard({ context, data, tripsReleased, budgetReleased: budgetFeatureReleased,
  proofsReleased: proofFeatureReleased, requestsReleased: requestFeatureReleased, uploadReleased: uploadFeatureReleased = false,
  activitiesReleased: activityFeatureReleased, onRequestChange, onRequestExtra, onUpload, onProofs,
  onOpenRequests, onOpenActivities, onRequestCallback }: ClientPortalHomeDashboardProps) {
  const router = useRouter();
  const openMenu = useClientPortalMenu();
  const { width, isPhone } = useDeviceClass();
  const { fontScale } = useWindowDimensions();
  const textScale = Math.max(fontScale ?? 1, useWebFontScaleValue());
  const layout = clientPortalLayout(width, textScale);
  const phone = isPhone || layout.phone;
  const stacked = layout.contentWidth / textScale < 1000;
  const family = context.roleKey === 'family_portal';
  const appointmentsAllowed = familyPortalFeatureAllowed(context, 'appointments');
  const messagesAllowed = familyPortalFeatureAllowed(context, 'messages');
  const documentsAllowed = familyPortalFeatureAllowed(context, 'documents');
  const signaturesAllowed = documentsAllowed && (!family || familyPortalAllows(context.familyAccess, 'sign_records'));
  const canComposeMessage = messagesAllowed && (!family || familyPortalAllows(context.familyAccess, 'send_messages'));
  const proofsReleased = proofFeatureReleased && familyPortalFeatureAllowed(context, 'nachweise');
  const budgetReleased = budgetFeatureReleased && !family;
  const requestsReleased = requestFeatureReleased && !family;
  const uploadReleased = uploadFeatureReleased && !family;
  const activitiesReleased = activityFeatureReleased && !family;
  const guide = resolveClientPortalHomeGuide(data);
  const heroLines = resolveClientPortalHeroLines({ displayName: context.displayName, tenantName: context.tenantName, moduleLabel: 'Klientenportal' });
  const quickActions = [
    ...(requestsReleased ? [{ icon: 'add-circle-outline' as const, label: 'Einsatz anfragen', action: onRequestExtra }] : []),
    ...(canComposeMessage ? [{ icon: 'chatbubble-ellipses-outline' as const, label: 'Nachricht schreiben', action: () => router.push('/portal/client/messages?compose=1' as never) }] : []),
    ...(uploadReleased ? [{ icon: 'cloud-upload-outline' as const, label: 'Dokument hochladen', action: onUpload }] : []),
    ...(requestsReleased ? [{ icon: 'call-outline' as const, label: 'Rückruf anfordern', action: onRequestCallback }] : []),
  ];
  const care: AreaItem[] = [
    ...(appointmentsAllowed ? [{ id: 'appointments', label: 'Einsätze', route: '/portal/client/appointments' }, { id: 'live', label: 'Live-Anfahrt', route: '/portal/client/live' }] : []),
    ...(budgetReleased ? [{ id: 'budget', label: 'Budget', route: '/portal/client/budget' }] : []),
  ];
  const files: AreaItem[] = [
    ...(documentsAllowed ? [{ id: 'documents', label: 'Dokumente', route: '/portal/client/documents' }] : []),
    ...(signaturesAllowed ? [{ id: 'signatures', label: 'Unterschriften', route: '/portal/client/documents/signatures', count: data.kpis.signatures }] : []),
    ...(proofsReleased ? [{ id: 'proofs', label: 'Nachweise', route: '/portal/client/proofs' }] : []),
  ];
  const exchange: AreaItem[] = [
    ...(messagesAllowed ? [{ id: 'messages', label: 'Nachrichten', route: '/portal/client/messages', count: data.kpis.messages }] : []),
    ...(!family ? [{ id: 'announcements', label: 'Mitteilungen', route: '/portal/client/announcements' }, { id: 'academy', label: 'Meine Akademie', route: '/portal/client/akademie' }] : []),
  ];
  const guideAction = guide.target === 'signatures' && signaturesAllowed ? () => router.push('/portal/client/documents/signatures' as never)
    : guide.target === 'messages' && messagesAllowed ? () => router.push('/portal/client/messages' as never)
      : guide.target === 'proofs' && proofsReleased ? onProofs
        : guide.target === 'requests' && requestsReleased ? onOpenRequests
          : guide.target === 'appointments' && appointmentsAllowed ? () => router.push('/portal/client/appointments' as never) : undefined;
  const attention = guideAction && (data.kpis.signatures > 0 || data.kpis.messages > 0 || data.kpis.proofs > 0 || data.kpis.openRequests > 0)
    ? <View style={[styles.panel, styles.attention]} testID="client-portal-attention-bar"><Ionicons name="information-circle-outline" size={27} color={c.accent.blue} />
      <View style={styles.attentionCopy}><Text style={styles.sectionTitle}>{guide.title}</Text><Text style={styles.body}>{guide.message}</Text></View>
      <PremiumButton title={guide.actionLabel ?? 'Ansehen'} onPress={guideAction} />
    </View> : null;
  const appointment = appointmentsAllowed ? <PortalNextAppointmentHero appointment={data.nextAppointment}
    onRequestChange={requestsReleased ? onRequestChange : undefined} onRequestExtra={requestsReleased ? onRequestExtra : undefined} emptyActionLabel="Einsatz anfragen" /> : null;
  const quick = quickActions.length ? <View style={[styles.panel, styles.quick]}><Text style={styles.eyebrow}>SCHNELL ERLEDIGT</Text><Text style={styles.sectionTitle}>Was möchten Sie tun?</Text>
    <View style={styles.quickGrid}>{quickActions.map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.action}
      style={({ pressed }) => [styles.quickAction, { flexBasis: textScale > 1.2 ? '100%' : '47%' }, pressed && styles.pressed]}>
      <Ionicons name={item.icon} size={25} color={c.accent.blue} /><Text style={styles.quickLabel}>{item.label}</Text>
    </Pressable>)}</View>
  </View> : null;
  return <View style={styles.dashboard} testID="client-portal-premium-home">
    <ClientSignatureAttentionBanner />
    <View style={[styles.panel, styles.welcome, phone && styles.welcomePhone]} testID="client-portal-premium-home-hero">
      <View style={styles.welcomeCopy}><Text style={styles.eyebrow}>MEINE VERSORGUNG</Text>
        <Text accessibilityRole="header" style={[styles.greeting, phone && styles.greetingPhone]}>{heroLines.greetingLine}, {heroLines.nameLine}</Text>
        <Text style={styles.body}>{context.tenantName}</Text>{!phone ? <View style={styles.welcomeNote}><Ionicons name="heart-outline" size={19} color={c.accent.blue} /><Text style={styles.body}>Schön, dass Sie da sind. Ihre Versorgung im Blick.</Text></View> : null}
      </View>
      {!phone ? <ClientPortalArtwork id="home" label="Meine Versorgung" size={128} /> : null}
      <View style={phone ? styles.phoneInfo : undefined}><PortalInfoButton compact={phone} title={guide.title} message={guide.message} actionLabel={guideAction ? guide.actionLabel : undefined} onAction={guideAction} /></View>
    </View>
    {!phone ? attention : null}
    {phone ? <>{appointment}{attention}{quick}</> : <View style={[styles.mainGrid, stacked && styles.stacked]}>
      {appointment ? <View style={styles.appointmentColumn}>{appointment}</View> : null}{quick ? <View style={styles.quickColumn}>{quick}</View> : null}
    </View>}
    <View style={styles.sectionsHeading}><View style={styles.sectionCopy}>
      <Text accessibilityRole="header" testID="client-portal-sections-heading" style={styles.sectionTitle}>Meine Bereiche</Text>
      <Text testID="client-portal-sections-explanation" style={styles.body}>Direkt und ohne Umwege zum gewünschten Inhalt.</Text>
    </View>{openMenu ? <PremiumButton title="Alle Bereiche" variant="secondary" onPress={openMenu} size="sm" /> : null}</View>
    <View style={styles.areas}><AreaGroup title="Meine Versorgung" items={care} columns={layout.contentColumns} /><AreaGroup title="Meine Unterlagen" items={files} columns={layout.contentColumns} /><AreaGroup title="In Verbindung" items={exchange} columns={layout.contentColumns} /></View>
    {family && !appointmentsAllowed && !messagesAllowed && !documentsAllowed ? <Text style={styles.body}>Für diesen Angehörigenzugang sind noch keine Bereiche freigegeben. Bitte wenden Sie sich bei Fragen an Ihr Pflegebüro.</Text> : null}
    {budgetReleased ? <View style={styles.budget}><Text accessibilityRole="header" testID="client-portal-budget-heading" style={styles.sectionTitle}>Ihre finanziellen Möglichkeiten</Text>
      <Text testID="client-portal-budget-explanation" style={styles.body}>Ihre freigegebenen Budgetdaten und bereits genutzten Leistungen.</Text><ClientBudgetVisualCards models={data.budgetVisuals} /></View> : null}
    {requestsReleased && data.kpis.openRequests > 0 || activitiesReleased && data.kpis.activities > 0 ? <View style={styles.moreActions}>
      {requestsReleased && data.kpis.openRequests > 0 ? <PremiumButton title={`Meine Anfragen (${data.kpis.openRequests})`} variant="secondary" onPress={onOpenRequests} /> : null}
      {activitiesReleased && data.kpis.activities > 0 ? <PremiumButton title={`Aktivitäten (${data.kpis.activities})`} variant="secondary" onPress={onOpenActivities} /> : null}
    </View> : null}
    {tripsReleased && appointmentsAllowed && data.kpis.begleitungen ? <PremiumButton title="Geplante Begleitungen" variant="secondary" onPress={() => router.push('/portal/client?module=assist&section=begleitungen' as never)} /> : null}
    <View style={styles.footer}><Ionicons name="shield-checkmark-outline" size={17} color={c.text.secondary} /><Text style={styles.footerText}>Ihr persönlicher Bereich bei {context.tenantName}</Text></View>
  </View>;
}
const styles = StyleSheet.create(withCareSuiteTypography({
  dashboard: { width: '100%', minWidth: 0, gap: 20 }, panel: { minWidth: 0, borderWidth: 1, borderColor: c.border, borderRadius: 22, backgroundColor: c.surface },
  welcome: { minHeight: 170, padding: 25, flexDirection: 'row', alignItems: 'center', gap: 20 }, welcomeCopy: { flex: 1, minWidth: 0, gap: 9 },
  welcomePhone: { minHeight: 0, padding: 18, paddingBottom: 56 }, phoneInfo: { position: 'absolute', right: 14, bottom: 10 },
  greeting: { color: c.text.primary, fontSize: font(38), lineHeight: font(47), fontWeight: '700', letterSpacing: -1.1, flexShrink: 1 }, greetingPhone: { fontSize: font(29), lineHeight: font(37) },
  eyebrow: { color: c.accent.blue, fontSize: font(13), lineHeight: font(19), fontWeight: '700', letterSpacing: 0.6 }, body: { color: c.text.secondary, fontSize: font(16), lineHeight: font(24), flexShrink: 1 },
  welcomeNote: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: c.control, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mainGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 20, minWidth: 0 }, stacked: { flexDirection: 'column' }, appointmentColumn: { flex: 1.4, minWidth: 0 }, quickColumn: { flex: 1, minWidth: 0 },
  quick: { padding: 22, gap: 12, flex: 1 }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, quickAction: { minHeight: 92, minWidth: 0, flexGrow: 1, gap: 10, borderWidth: 1, borderColor: c.border, backgroundColor: 'rgba(188,238,255,0.035)', borderRadius: 13, padding: 13, justifyContent: 'center' },
  quickLabel: { color: c.text.primary, fontSize: font(16), lineHeight: font(23), flexShrink: 1 }, attention: { padding: 19, gap: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }, attentionCopy: { flex: 1, flexBasis: 200, minWidth: 0, gap: 4 },
  sectionTitle: { color: c.text.primary, fontSize: font(22), lineHeight: font(29), fontWeight: '700', flexShrink: 1 }, sectionsHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionCopy: { flex: 1, minWidth: 0, flexBasis: 220, gap: 5 },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, areaPanel: { flexGrow: 1, minWidth: 0, paddingHorizontal: 19, paddingTop: 18, paddingBottom: 5, borderWidth: 1, borderColor: c.border, borderRadius: 21, backgroundColor: c.surface },
  areaTitle: { color: c.text.primary, fontSize: font(20), lineHeight: font(27), fontWeight: '700', marginBottom: 11 }, areaRow: { minHeight: 78, minWidth: 0, gap: 11, flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderColor: c.borderSoft, paddingVertical: 10 },
  areaLabel: { flex: 1, minWidth: 0, color: c.text.primary, fontSize: font(16), lineHeight: font(23) }, count: { color: c.accent.blue, fontSize: font(14), lineHeight: font(21), paddingHorizontal: 6, borderRadius: 5, backgroundColor: c.control },
  budget: { gap: 12, minWidth: 0 }, moreActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, footer: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }, footerText: { color: c.text.secondary, fontSize: font(13), lineHeight: font(20), flexShrink: 1 }, pressed: { opacity: 0.75 },
}));
