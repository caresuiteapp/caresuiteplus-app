import type { ComponentProps } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, type DimensionValue, type TextStyle, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ClientBudgetVisualCards } from '@/components/office/ClientBudgetVisualCards';
import { PortalNextAppointmentHero } from '@/components/portal/assist/PortalNextAppointmentHero';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { resolveClientPortalHeroLines } from '@/lib/portal/clientPortalGreeting';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData } from '@/types/portal/assist';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type ClientPortalHomeGuide = {
  title: string;
  message: string;
  actionLabel?: string;
  target?: 'messages' | 'proofs' | 'signatures' | 'requests' | 'appointments';
};

type ClientPortalHomeDashboardProps = {
  context: PortalContext;
  data: AssistDashboardData;
  tripsReleased: boolean;
  budgetReleased: boolean;
  proofsReleased: boolean;
  requestsReleased: boolean;
  activitiesReleased: boolean;
  onRequestChange: () => void;
  onRequestExtra: () => void;
  onUpload: () => void;
  onProofs: () => void;
  onOpenRequests: () => void;
  onOpenActivities: () => void;
  onRequestCallback: () => void;
};

type HomeActionCardProps = {
  icon: IoniconName;
  title: string;
  description: string;
  count?: number | null;
  accentColor: string;
  width: DimensionValue;
  onPress: () => void;
};

type QuickTaskProps = {
  icon: IoniconName;
  label: string;
  onPress: () => void;
};

type AttentionItem = {
  key: string;
  icon: IoniconName;
  label: string;
  count: number;
  onPress: () => void;
};

const ink = {
  primary: '#061B35',
  secondary: '#284967',
  muted: '#58718A',
  blue: '#056CE8',
  blueDark: '#084A99',
  white: '#FFFFFF',
} as const;

const premiumShadow = Platform.OS === 'web'
  ? ({ boxShadow: '0 22px 58px rgba(0,24,58,0.25)' } as unknown as ViewStyle)
  : ({ shadowColor: '#001B42', shadowOpacity: 0.2, shadowRadius: 22, shadowOffset: { width: 0, height: 13 }, elevation: 8 } as ViewStyle);

const breakLongWords = Platform.OS === 'web'
  ? ({ overflowWrap: 'anywhere', wordBreak: 'break-word' } as unknown as TextStyle)
  : null;

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

function HomeActionCard({
  icon,
  title,
  description,
  count,
  accentColor,
  width,
  onPress,
}: HomeActionCardProps) {
  const { width: viewportWidth } = useDeviceClass();
  const type = resolveGalaxyTypography(viewportWidth);
  const showCount = typeof count === 'number' && count > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${description}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCardHost,
        { width, flexBasis: width, borderColor: `${accentColor}55` },
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F4F9FF', '#EAF3FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.actionIcon, { backgroundColor: `${accentColor}14`, borderColor: `${accentColor}42` }]}>
        <Ionicons name={icon} color={accentColor} size={23} />
      </View>
      <View style={styles.actionCopy}>
      <Text style={[type.bodyStrong, styles.actionTitle, breakLongWords]}>{title}</Text>
        <Text style={[type.caption, styles.actionDescription]}>{description}</Text>
      </View>
      {showCount ? (
        <View style={[styles.countBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" color={ink.blueDark} size={20} />
    </Pressable>
  );
}

function QuickTask({ icon, label, onPress }: QuickTaskProps) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickTask, pressed && styles.quickTaskPressed]}
    >
      <View style={styles.quickTaskIcon}>
        <Ionicons name={icon} color={ink.white} size={20} />
      </View>
      <Text style={[type.bodyStrong, styles.quickTaskLabel, breakLongWords]}>{label}</Text>
      <Ionicons name="chevron-forward" color="rgba(255,255,255,0.72)" size={18} />
    </Pressable>
  );
}

function WelcomeHero({
  context,
  guide,
  onGuideAction,
}: {
  context: PortalContext;
  guide: ClientPortalHomeGuide;
  onGuideAction?: () => void;
}) {
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const compactHero = isPhone || width < 760;
  const heroLines = resolveClientPortalHeroLines({
    displayName: context.displayName,
    tenantName: context.tenantName,
    moduleLabel: 'Klient:innenportal',
  });

  return (
    <View style={[styles.welcomeHero, compactHero && styles.welcomeHeroPhone]} testID="client-portal-premium-home-hero">
      <LinearGradient
        colors={['#FFFFFF', '#EDF6FF', '#D9ECFF']}
        locations={[0, 0.56, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.welcomeGlow} pointerEvents="none" />
      <View style={[styles.welcomeCopy, compactHero && styles.welcomeCopyPhone]}>
        <View style={styles.portalPill}>
          <Ionicons name="shield-checkmark" color={ink.blue} size={15} />
          <Text style={styles.portalPillText}>MEIN KLIENT:INNENPORTAL</Text>
        </View>
        <Text style={[type.h1, styles.welcomeTitle, breakLongWords]}>
          {heroLines.greetingLine}, {heroLines.nameLine}
        </Text>
        <Text style={[type.body, styles.welcomeProvider]}>{context.tenantName}</Text>
      </View>

      <View style={[styles.guideArea, compactHero && styles.guideAreaPhone]}>
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel="CareSuite Portalbegleiter"
          resizeMode="contain"
          source={require('../../../../assets/auth/access-client.png')}
          style={[styles.guideMascot, compactHero && styles.guideMascotPhone]}
        />
        <View style={[styles.guideBubble, compactHero && styles.guideBubblePhone]}>
          {!compactHero ? <View style={styles.guideBubbleTail} /> : null}
          <Text style={[type.bodyStrong, styles.guideTitle, breakLongWords]}>{guide.title}</Text>
          <Text style={[type.caption, styles.guideMessage]}>{guide.message}</Text>
          {guide.actionLabel && onGuideAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={onGuideAction}
              style={({ pressed }) => [
                styles.guideAction,
                compactHero && styles.guideActionPhone,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.guideActionText}>{guide.actionLabel}</Text>
              <Ionicons name="arrow-forward" color={ink.white} size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function AttentionBar({ items }: { items: AttentionItem[] }) {
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const compact = isPhone || width < 760;
  if (items.length === 0) return null;

  return (
    <View style={[styles.attentionBar, compact && styles.attentionBarPhone]} testID="client-portal-attention-bar">
      <View style={styles.attentionHeading}>
        <View style={styles.attentionIcon}>
          <Ionicons name="sparkles" color="#075DC7" size={21} />
        </View>
        <View style={styles.attentionHeadingCopy}>
          <Text style={[type.bodyStrong, styles.attentionTitle]}>Jetzt wichtig</Text>
          <Text style={[type.caption, styles.attentionSubtitle]}>Diese Punkte benötigen noch Ihre Aufmerksamkeit.</Text>
        </View>
      </View>
      <View style={[styles.attentionItems, compact && styles.attentionItemsPhone]}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            onPress={item.onPress}
            style={({ pressed }) => [styles.attentionItem, pressed && styles.pressed]}
          >
            <Ionicons name={item.icon} color="#075DC7" size={18} />
            <Text style={[type.caption, styles.attentionItemLabel]}>{item.label}</Text>
            <View style={styles.attentionCount}>
              <Text style={styles.attentionCountText}>{item.count}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ClientPortalHomeDashboard({
  context,
  data,
  tripsReleased,
  budgetReleased,
  proofsReleased,
  requestsReleased,
  activitiesReleased,
  onRequestChange,
  onRequestExtra,
  onUpload,
  onProofs,
  onOpenRequests,
  onOpenActivities,
  onRequestCallback,
}: ClientPortalHomeDashboardProps) {
  const router = useRouter();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
  const compact = isPhone || width < 760;
  const stackedMain = isPhone || width < 1120;
  const actionWidth: DimensionValue = compact ? '100%' : width < 1540 ? '48.8%' : '23.8%';
  const guide = resolveClientPortalHomeGuide(data);

  const openGuideTarget = () => {
    if (guide.target === 'messages') {
      router.push('/portal/client/messages' as never);
    } else if (guide.target === 'proofs') {
      onProofs();
    } else if (guide.target === 'signatures') {
      router.push('/portal/client/documents/signatures' as never);
    } else if (guide.target === 'requests') {
      onOpenRequests();
    } else if (guide.target === 'appointments') {
      router.push('/portal/client/appointments' as never);
    }
  };

  const attentionItems: AttentionItem[] = [
    ...(data.kpis.signatures > 0
      ? [{
          key: 'signatures',
          icon: 'create-outline' as IoniconName,
          label: 'Unterschriften',
          count: data.kpis.signatures,
          onPress: () => router.push('/portal/client/documents/signatures' as never),
        }]
      : []),
    ...(data.kpis.messages > 0
      ? [{
          key: 'messages',
          icon: 'chatbubble-ellipses-outline' as IoniconName,
          label: 'Neue Nachrichten',
          count: data.kpis.messages,
          onPress: () => router.push('/portal/client/messages' as never),
        }]
      : []),
    ...(proofsReleased && data.kpis.proofs > 0
      ? [{
          key: 'proofs',
          icon: 'reader-outline' as IoniconName,
          label: 'Offene Nachweise',
          count: data.kpis.proofs,
          onPress: onProofs,
        }]
      : []),
    ...(requestsReleased && data.kpis.openRequests > 0
      ? [{
          key: 'requests',
          icon: 'paper-plane-outline' as IoniconName,
          label: 'Offene Anfragen',
          count: data.kpis.openRequests,
          onPress: onOpenRequests,
        }]
      : []),
  ];

  const moreItems = [
    ...(tripsReleased && data.kpis.begleitungen
      ? [{
          key: 'trips',
          icon: 'car-outline' as IoniconName,
          label: `${data.kpis.begleitungen} Begleitungen geplant`,
          onPress: () => router.push('/portal/client?module=assist&section=begleitungen' as never),
        }]
      : []),
    ...(activitiesReleased && data.kpis.activities > 0
      ? [{
          key: 'activities',
          icon: 'notifications-outline' as IoniconName,
          label: `${data.kpis.activities} neue Aktivitäten`,
          onPress: onOpenActivities,
        }]
      : []),
    ...(budgetReleased && data.budget
      ? [{
          key: 'budget',
          icon: 'wallet-outline' as IoniconName,
          label: `${data.budget.remainingAmount.toLocaleString('de-DE', { style: 'currency', currency: data.budget.currency })} Budget verfügbar`,
          onPress: () => router.push('/portal/client/budget' as never),
        }]
      : []),
  ];

  return (
    <View style={styles.dashboard} testID="client-portal-premium-home">
      <WelcomeHero
        context={context}
        guide={guide}
        onGuideAction={guide.target ? openGuideTarget : undefined}
      />

      <AttentionBar items={attentionItems} />

      <View style={[styles.mainGrid, stackedMain && styles.mainGridStacked]}>
        <View style={styles.appointmentColumn}>
          <PortalNextAppointmentHero
            appointment={data.nextAppointment}
            onRequestChange={onRequestChange}
            onRequestExtra={onRequestExtra}
            emptyActionLabel="Einsatz anfragen"
          />
        </View>

        <View style={[styles.quickPanel, stackedMain && styles.quickPanelStacked]}>
          <LinearGradient
            colors={['#0B5CC9', '#073E8D', '#052B68']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.quickPanelGlow} pointerEvents="none" />
          <Text style={[type.caption, styles.quickEyebrow]}>SCHNELL ERLEDIGT</Text>
          <Text style={[type.cardTitle, styles.quickTitle]}>Was möchten Sie tun?</Text>
          <View style={styles.quickTasks}>
            <QuickTask icon="add-circle-outline" label="Einsatz anfragen" onPress={onRequestExtra} />
            <QuickTask
              icon="chatbubble-ellipses-outline"
              label="Nachricht schreiben"
              onPress={() => router.push('/portal/client/messages?compose=1' as never)}
            />
            <QuickTask icon="cloud-upload-outline" label="Dokument hochladen" onPress={onUpload} />
            <QuickTask icon="call-outline" label="Rückruf anfordern" onPress={onRequestCallback} />
          </View>
        </View>
      </View>

      <View style={styles.budgetExperience} testID="client-portal-budget-visuals">
        <View style={styles.budgetHeading}>
          <View style={styles.budgetHeadingIcon}>
            <Ionicons name="wallet-outline" color={ink.blue} size={22} />
          </View>
          <View style={styles.budgetHeadingCopy}>
            <Text style={[type.cardTitle, styles.sectionTitle]}>Ihre finanziellen Möglichkeiten</Text>
            <Text style={[type.caption, styles.sectionSubtitle]}>
              Entlastungsbetrag und 40-%-Umwandlung bleiben für Sie immer verständlich sichtbar.
            </Text>
          </View>
        </View>
        <ClientBudgetVisualCards models={data.budgetVisuals} />
      </View>

      <View style={styles.sectionHeading}>
        <View>
          <Text style={[type.cardTitle, styles.sectionTitle]}>Ihre Bereiche</Text>
          <Text style={[type.caption, styles.sectionSubtitle]}>Direkt und ohne Umwege zum gewünschten Inhalt.</Text>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <HomeActionCard
          icon="calendar-outline"
          title="Einsätze"
          description={data.kpis.appointments > 0 ? plural(data.kpis.appointments, 'kommender Einsatz', 'kommende Einsätze') : 'Planung und Termine öffnen'}
          count={data.kpis.appointments}
          accentColor="#056CE8"
          width={actionWidth}
          onPress={() => router.push('/portal/client/appointments' as never)}
        />
        <HomeActionCard
          icon="chatbubbles-outline"
          title="Nachrichten"
          description={data.kpis.messages > 0 ? plural(data.kpis.messages, 'neue Nachricht', 'neue Nachrichten') : 'Verwaltung kontaktieren'}
          count={data.kpis.messages}
          accentColor="#6D4AFF"
          width={actionWidth}
          onPress={() => router.push('/portal/client/messages' as never)}
        />
        <HomeActionCard
          icon="folder-open-outline"
          title="Dokumente"
          description={data.kpis.documents > 0 ? plural(data.kpis.documents, 'Dokument verfügbar', 'Dokumente verfügbar') : 'Persönliche Ablage öffnen'}
          count={data.kpis.documents}
          accentColor="#0F9F89"
          width={actionWidth}
          onPress={() => router.push('/portal/client/documents' as never)}
        />
        <HomeActionCard
          icon="create-outline"
          title="Unterschriften"
          description={data.kpis.signatures > 0 ? plural(data.kpis.signatures, 'Unterschrift offen', 'Unterschriften offen') : 'Zurzeit alles erledigt'}
          count={data.kpis.signatures}
          accentColor="#C0448F"
          width={actionWidth}
          onPress={() => router.push('/portal/client/documents/signatures' as never)}
        />
      </View>

      {moreItems.length > 0 ? (
        <View style={styles.moreStrip}>
          <Text style={[type.caption, styles.moreStripTitle]}>WEITERE INFORMATIONEN</Text>
          <View style={styles.moreStripItems}>
            {moreItems.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={item.onPress}
                style={({ pressed }) => [styles.moreChip, pressed && styles.pressed]}
              >
                <Ionicons name={item.icon} color="#9ACBFF" size={18} />
                <Text style={[type.caption, styles.moreChipText]}>{item.label}</Text>
                <Ionicons name="chevron-forward" color="rgba(255,255,255,0.58)" size={16} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: {
    width: '100%',
    maxWidth: 1480,
    alignSelf: 'center',
    gap: careSpacing.lg,
    paddingBottom: careSpacing.xl,
  },
  budgetExperience: {
    width: '100%',
    gap: careSpacing.md,
  },
  budgetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  budgetHeadingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.2)',
    backgroundColor: 'rgba(5,108,232,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetHeadingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  welcomeHero: {
    minHeight: 220,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(154,203,255,0.78)',
    borderRadius: 26,
    padding: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    ...premiumShadow,
  },
  welcomeHeroPhone: {
    minHeight: 0,
    width: '100%',
    alignSelf: 'stretch',
    padding: 16,
    borderRadius: 20,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 14,
  },
  welcomeGlow: {
    position: 'absolute',
    right: -90,
    top: -130,
    width: 360,
    height: 360,
    borderRadius: 999,
    backgroundColor: 'rgba(53,151,255,0.2)',
  },
  welcomeCopy: {
    flex: 1.25,
    minWidth: 0,
    gap: 8,
  },
  welcomeCopyPhone: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
  },
  portalPill: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.22)',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  portalPillText: {
    color: ink.blueDark,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  welcomeTitle: {
    color: ink.primary,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  welcomeProvider: {
    color: ink.secondary,
    fontWeight: '700',
  },
  guideArea: {
    flex: 1,
    minWidth: 330,
    maxWidth: 560,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  guideAreaPhone: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    minWidth: 0,
    maxWidth: '100%',
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  guideMascot: {
    width: 102,
    height: 118,
    flexShrink: 0,
  },
  guideMascotPhone: {
    width: 58,
    height: 68,
    alignSelf: 'center',
  },
  guideBubble: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.22)',
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.84)',
    gap: 5,
  },
  guideBubblePhone: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    width: '100%',
    padding: 14,
  },
  guideBubbleTail: {
    position: 'absolute',
    left: -7,
    bottom: 22,
    width: 14,
    height: 14,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(5,108,232,0.22)',
    backgroundColor: '#F5FAFF',
    transform: [{ rotate: '45deg' }],
  },
  guideTitle: {
    color: ink.primary,
    fontWeight: '800',
  },
  guideMessage: {
    color: ink.secondary,
  },
  guideAction: {
    alignSelf: 'flex-start',
    minHeight: 40,
    marginTop: 4,
    paddingHorizontal: 13,
    borderRadius: 11,
    backgroundColor: ink.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  guideActionPhone: { width: '100%', alignSelf: 'stretch' },
  guideActionText: {
    color: ink.white,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  attentionBar: {
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.52)',
    borderRadius: 18,
    backgroundColor: 'rgba(231,243,255,0.96)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  attentionHeading: {
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  attentionBarPhone: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  attentionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(5,108,232,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionHeadingCopy: {
    flex: 1,
    gap: 2,
  },
  attentionTitle: {
    color: ink.primary,
    fontWeight: '900',
  },
  attentionSubtitle: {
    color: ink.secondary,
  },
  attentionItems: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  attentionItemsPhone: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  attentionItem: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(5,108,232,0.18)',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  attentionItemLabel: {
    color: ink.primary,
    fontWeight: '700',
  },
  attentionCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: '#075DC7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
  },
  mainGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: careSpacing.md,
  },
  mainGridStacked: {
    flexDirection: 'column',
  },
  appointmentColumn: {
    flex: 1.65,
    minWidth: 0,
  },
  quickPanel: {
    flex: 1,
    minWidth: 300,
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.46)',
    borderRadius: 21,
    gap: 6,
    ...premiumShadow,
  },
  quickPanelStacked: {
    width: '100%',
    minWidth: 0,
  },
  quickPanelGlow: {
    position: 'absolute',
    right: -70,
    top: -90,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: 'rgba(53,151,255,0.22)',
  },
  quickEyebrow: {
    color: '#9ACBFF',
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  quickTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  quickTasks: {
    marginTop: 7,
    gap: 7,
  },
  quickTask: {
    minHeight: 48,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickTaskPressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  quickTaskIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTaskLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeading: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 3,
    color: 'rgba(255,255,255,0.7)',
  },
  actionGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCardHost: {
    minHeight: 108,
    flexGrow: 1,
    position: 'relative',
    overflow: 'hidden',
    padding: 15,
    borderWidth: 1,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    ...premiumShadow,
  },
  actionIcon: {
    width: 46,
    height: 46,
    flexShrink: 0,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  actionTitle: {
    color: ink.primary,
    fontWeight: '900',
  },
  actionDescription: {
    color: ink.secondary,
  },
  countBadge: {
    minWidth: 29,
    height: 29,
    paddingHorizontal: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  moreStrip: {
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(112,181,255,0.28)',
    borderRadius: 18,
    backgroundColor: 'rgba(4,26,55,0.68)',
    gap: 10,
  },
  moreStripTitle: {
    color: '#9ACBFF',
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  moreStripItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moreChip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moreChipText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.988 }],
  },
});
