import { Slot, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import {
  isOfficeTimeTrackingOwnCaptureRoute,
  OFFICE_TIME_TRACKING_OWN_HREF,
  OFFICE_TIME_TRACKING_TABS,
  resolveOfficeTimeTrackingTabKey,
} from '@/lib/navigation/officeTimeTrackingNav';
import { typography } from '@/theme';

const SHELL_TEXT = {
  primary: '#0F172A',
  secondary: '#334155',
  muted: '#64748B',
  border: '#CBD5E1',
} as const;

export function OfficeTimeTrackingShell() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const accent = moduleColor('office');
  const compact = width < 760;
  const activeTab = resolveOfficeTimeTrackingTabKey(pathname);
  const ownCaptureActive = isOfficeTimeTrackingOwnCaptureRoute(pathname);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLead}>
          <View style={[styles.iconTile, { backgroundColor: `${accent}18`, borderColor: `${accent}45` }]}> 
            <Text style={styles.icon}>⏱</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: accent }]}>OFFICE · WORKFORCE MANAGEMENT</Text>
            <Text style={styles.title}>Arbeitszeit</Text>
            <Text style={styles.subtitle}>
              Zeiten erfassen, Abweichungen prüfen und Freigaben zentral steuern
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push(OFFICE_TIME_TRACKING_OWN_HREF as never)}
          style={({ pressed }) => [
            styles.ownLink,
            { borderColor: ownCaptureActive ? accent : SHELL_TEXT.border },
            ownCaptureActive && { backgroundColor: `${accent}14` },
            pressed && styles.ownLinkPressed,
          ]}
          accessibilityRole="link"
          accessibilityLabel="Eigene Erfassung öffnen"
        >
          <Text style={[styles.ownLinkIcon, { color: accent }]}>＋</Text>
          {!compact ? <View><Text style={styles.ownLinkKicker}>PERSÖNLICH</Text><Text style={[styles.ownLinkText, { color: ownCaptureActive ? accent : SHELL_TEXT.primary }]}>Eigene Erfassung</Text></View> : null}
        </Pressable>
      </View>

      <View style={styles.navigationSurface}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={styles.tabScroll}
          contentContainerStyle={styles.tabRow}
        >
          {OFFICE_TIME_TRACKING_TABS.map((tab) => {
            const selected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => router.push(tab.href as never)}
                style={({ pressed }) => [
                  styles.tabChip,
                  { borderColor: selected ? `${accent}70` : 'transparent' },
                  selected && { backgroundColor: `${accent}12` },
                  pressed && styles.tabPressed,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabLabel, { color: selected ? accent : SHELL_TEXT.secondary }, selected && styles.tabLabelSelected]} numberOfLines={1}>
                  {tab.label}
                </Text>
                {selected ? <View style={[styles.activeMarker, { backgroundColor: accent }]} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.content}>
        <View style={styles.workspace}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.md,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    marginHorizontal: careSpacing.sm,
    marginTop: careSpacing.sm,
    borderWidth: 1,
    borderColor: SHELL_TEXT.border,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.84)',
    shadowColor: '#173B70',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  headerLead: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: careSpacing.md,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 21 },
  eyebrow: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerText: {
    flex: 1,
    gap: careSpacing.xs,
  },
  title: {
    ...typography.h2,
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 27,
    color: SHELL_TEXT.primary,
  },
  subtitle: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 17,
    color: SHELL_TEXT.secondary,
  },
  ownLink: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    backgroundColor: 'rgba(255,255,255,0.74)',
  },
  ownLinkPressed: {
    opacity: 0.85,
  },
  ownLinkIcon: {
    fontSize: 24,
    fontWeight: '400',
  },
  ownLinkKicker: {
    ...typography.caption,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: SHELL_TEXT.muted,
  },
  ownLinkText: {
    ...typography.body,
    fontWeight: '700',
  },
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? {
          maxHeight: 54,
          overflowX: 'auto' as const,
          overflowY: 'hidden' as const,
        }
      : null),
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  navigationSurface: {
    marginHorizontal: careSpacing.sm,
    marginTop: careSpacing.sm,
    borderWidth: 1,
    borderColor: SHELL_TEXT.border,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.78)',
    overflow: 'hidden',
  },
  tabChip: {
    flexShrink: 0,
    alignSelf: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    position: 'relative',
  },
  tabPressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  tabIcon: { fontSize: 14 },
  tabLabel: { ...typography.body, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  tabLabelSelected: { fontWeight: '800' },
  activeMarker: { position: 'absolute', left: 12, right: 12, bottom: 2, height: 2, borderRadius: 2 },
  content: {
    width: '100%',
    backgroundColor: 'transparent',
    padding: careSpacing.sm,
  },
  workspace: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: SHELL_TEXT.border,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
    padding: careSpacing.md,
    overflow: 'visible',
  },
});
