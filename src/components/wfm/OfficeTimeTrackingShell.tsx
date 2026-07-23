import { Slot, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { lightSurfaceText, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import {
  isOfficeTimeTrackingOwnCaptureRoute,
  OFFICE_TIME_TRACKING_OWN_HREF,
  OFFICE_TIME_TRACKING_TABS,
  resolveOfficeTimeTrackingTabKey,
} from '@/lib/navigation/officeTimeTrackingNav';
import { typography } from '@/theme';

export function OfficeTimeTrackingShell() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const text = useAuroraAdaptiveText();
  const accent = moduleColor('office');
  const compact = width < 760;
  const wrapNavigation = width >= 1180;
  const activeTab = resolveOfficeTimeTrackingTabKey(pathname);
  const ownCaptureActive = isOfficeTimeTrackingOwnCaptureRoute(pathname);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { borderColor: text.border }]}> 
        <View style={styles.headerLead}>
          <View style={[styles.iconTile, { backgroundColor: `${accent}18`, borderColor: `${accent}45` }]}> 
            <Text style={styles.icon}>⏱</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: accent }]}>OFFICE · WORKFORCE MANAGEMENT</Text>
            <Text style={[styles.title, { color: lightSurfaceText.primary }]}>Arbeitszeit</Text>
            <Text style={[styles.subtitle, { color: lightSurfaceText.secondary }]}>
              Zeiten erfassen, Abweichungen prüfen und Freigaben zentral steuern
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push(OFFICE_TIME_TRACKING_OWN_HREF as never)}
          style={({ pressed }) => [
            styles.ownLink,
            { borderColor: ownCaptureActive ? accent : text.border },
            ownCaptureActive && { backgroundColor: `${accent}14` },
            pressed && styles.ownLinkPressed,
          ]}
          accessibilityRole="link"
          accessibilityLabel="Eigene Erfassung öffnen"
        >
          <Text style={[styles.ownLinkIcon, { color: accent }]}>＋</Text>
          {!compact ? <View><Text style={[styles.ownLinkKicker, { color: lightSurfaceText.muted }]}>PERSÖNLICH</Text><Text style={[styles.ownLinkText, { color: ownCaptureActive ? accent : lightSurfaceText.primary }]}>Eigene Erfassung</Text></View> : null}
        </Pressable>
      </View>

      <View style={[styles.navigationSurface, { borderColor: text.border }]}> 
        {wrapNavigation ? (
          <View style={styles.tabRowDesktop}>
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
                  <Text style={[styles.tabLabel, { color: selected ? accent : lightSurfaceText.secondary }, selected && styles.tabLabelSelected]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                  {selected ? <View style={[styles.activeMarker, { backgroundColor: accent }]} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
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
                <Text style={[styles.tabLabel, { color: selected ? accent : lightSurfaceText.secondary }, selected && styles.tabLabelSelected]} numberOfLines={1}>
                  {tab.label}
                </Text>
                {selected ? <View style={[styles.activeMarker, { backgroundColor: accent }]} /> : null}
              </Pressable>
            );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <View style={[styles.workspace, { borderColor: text.border }]}> 
          <Slot />
        </View>
      </ScrollView>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.md,
    padding: careSpacing.lg,
    marginHorizontal: careSpacing.md,
    marginTop: careSpacing.md,
    borderWidth: 1,
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
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 25 },
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
    lineHeight: 31,
  },
  subtitle: {
    ...typography.body,
    fontSize: 14,
  },
  ownLink: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    minHeight: 52,
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
  },
  ownLinkText: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? {
          maxHeight: 62,
          overflowX: 'auto' as const,
          overflowY: 'hidden' as const,
        }
      : null),
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  tabRowDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  navigationSurface: {
    marginHorizontal: careSpacing.md,
    marginTop: careSpacing.sm,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.78)',
    overflow: 'hidden',
  },
  tabChip: {
    flexShrink: 0,
    alignSelf: 'center',
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    position: 'relative',
  },
  tabPressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  tabIcon: { fontSize: 14 },
  tabLabel: { ...typography.caption, fontSize: 12, fontWeight: '600' },
  tabLabelSelected: { fontWeight: '800' },
  activeMarker: { position: 'absolute', left: 12, right: 12, bottom: 2, height: 2, borderRadius: 2 },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    flexGrow: 1,
    padding: careSpacing.md,
    paddingTop: careSpacing.sm,
    ...(Platform.OS === 'web'
      ? {
          maxWidth: '100%',
        }
      : null),
  },
  workspace: {
    width: '100%',
    maxWidth: 1500,
    alignSelf: 'center',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: careSpacing.sm,
    overflow: 'visible',
  },
});
