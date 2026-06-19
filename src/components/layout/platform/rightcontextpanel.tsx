import { useMemo } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { useOfficeDashboard } from '@/hooks/useOfficeDashboard';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { GlowCard } from '@/components/ui/effects';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glassFx, withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';
import { CLIENT_INTAKE_NEW_ROUTE } from '@/lib/navigation/clientRoutes';

type RightContextPanelProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

const OFFICE_QUICK_ACTIONS = [
  { label: 'Klient:in anlegen', icon: '➕', href: CLIENT_INTAKE_NEW_ROUTE },
  { label: 'Rechnung erstellen', icon: '🧾', href: '/office/invoices/create' },
  { label: 'Termin planen', icon: '📅', href: '/office/appointments/create' },
  { label: 'Dokument hochladen', icon: '📁', href: '/office/documents/upload' },
];

const MODULE_STATUS: Record<MainModuleKey, { label: string; status: string }[]> = {
  zentrale: [
    { label: 'Module aktiv', status: '3/6' },
    { label: 'Nachrichten', status: '2 neu' },
  ],
  office: [
    { label: 'Klient:innen', status: 'Aktiv' },
    { label: 'Rechnungen', status: '3 offen' },
  ],
  assist: [
    { label: 'Einsätze heute', status: '5' },
    { label: 'Nachweise', status: '2 offen' },
  ],
  pflege: [
    { label: 'Pflegepläne', status: 'Aktuell' },
    { label: 'Vitalwerte', status: '1 Warnung' },
  ],
  stationaer: [
    { label: 'Belegung', status: '92%' },
    { label: 'Übergaben', status: '1 offen' },
  ],
  beratung: [
    { label: 'Offene Fälle', status: '4' },
    { label: 'Wiedervorlagen', status: '2 heute' },
  ],
  akademie: [
    { label: 'Kurse aktiv', status: '6' },
    { label: 'Pflichtschulungen', status: '3 fällig' },
  ],
  admin: [
    { label: 'Benutzer', status: '12 aktiv' },
    { label: 'Integrationen', status: '2 verbunden' },
  ],
};

/** Context panel — tenant status, module chips, tasks, quick actions, support (NOT navigation). */
export function RightContextPanel({ mainModule, accentColor }: RightContextPanelProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const tenantName = useTenantDisplayName();
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const { data: officeData } = useOfficeDashboard();
  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);

  if (width < 1280) {
    return null;
  }

  const statusChips = MODULE_STATUS[mainModule];
  const quickActions = mainModule === 'office' ? OFFICE_QUICK_ACTIONS : OFFICE_QUICK_ACTIONS.slice(0, 2);
  const openTasks =
    mainModule === 'office' && officeData
      ? officeData.statusCards.slice(0, 3).map((card) => ({
          title: card.title,
          count: card.count,
        }))
      : [
          { title: 'Offene Aufgaben', count: 2 },
          { title: 'Zu prüfen', count: 1 },
        ];

  return (
    <View style={styles.root}>
      <GlowCard glowColor={accent} style={styles.tenantCard}>
        <Text style={styles.cardHeading}>Mandant</Text>
        <Text style={styles.tenantName} numberOfLines={2}>
          {tenantName}
        </Text>
        <View style={[styles.liveChip, { borderColor: withAlpha(accent, 0.45) }]}>
          <Text style={[styles.liveChipText, { color: accent }]}>● Live</Text>
        </View>
      </GlowCard>

      <Text style={styles.sectionHeading}>Modulstatus</Text>
      <View style={styles.chipRow}>
        {statusChips.map((chip) => (
          <View key={chip.label} style={[styles.statusChip, { borderColor: withAlpha(accent, 0.35) }]}>
            <Text style={styles.chipLabel}>{chip.label}</Text>
            <Text style={[styles.chipValue, { color: accent }]}>{chip.status}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionHeading}>Heute</Text>
      <ScrollView style={styles.taskList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {openTasks.map((task) => (
          <View key={task.title} style={styles.taskItem}>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {task.title}
            </Text>
            <View style={[styles.taskBadge, { backgroundColor: withAlpha(accent, 0.2) }]}>
              <Text style={[styles.taskBadgeText, { color: accent }]}>{task.count}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Text style={styles.sectionHeading}>Schnellaktionen</Text>
      <View style={styles.actionList}>
        {quickActions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.href as never)}
            style={[styles.actionBtn, webCursor]}
            accessibilityRole="button"
          >
            <Text style={styles.actionIcon}>{action.icon}</Text>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.support}>
        <Text style={styles.sectionHeading}>Support</Text>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>❓ Hilfe & Dokumentation</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>🔒 Datenschutz</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings/data-request' as never)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>📋 Betroffenenrechte</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} style={styles.supportLink}>
          <Text style={styles.supportLinkText}>ℹ️ Impressum</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  accent: string,
) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;

  return StyleSheet.create({
    root: {
      width: 280,
      backgroundColor: isDark ? 'rgba(18,22,43,0.28)' : colors.bgSurface,
      borderLeftWidth: 1,
      borderLeftColor: glassBorder,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    tenantCard: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    cardHeading: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    tenantName: {
      ...typography.bodyStrong,
      color: colors.textPrimary,
      fontWeight: '700',
    },
    liveChip: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.capsule,
      borderWidth: 1,
      marginTop: spacing.xs,
    },
    liveChipText: { fontSize: 11, fontWeight: '700' },
    sectionHeading: {
      ...typography.caption,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    chipRow: { gap: spacing.xs },
    statusChip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    },
    chipLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
    chipValue: { ...typography.caption, fontWeight: '700' },
    taskList: { maxHeight: 120 },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    taskTitle: { ...typography.body, color: colors.textSecondary, flex: 1, fontWeight: '600' },
    taskBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.capsule,
      minWidth: 24,
      alignItems: 'center',
    },
    taskBadgeText: { fontSize: 11, fontWeight: '700' },
    actionList: { gap: spacing.xs },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    },
    actionIcon: { fontSize: 16 },
    actionLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
    support: { marginTop: 'auto', gap: spacing.xs },
    supportLink: { paddingVertical: spacing.xs },
    supportLinkText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  });
}
