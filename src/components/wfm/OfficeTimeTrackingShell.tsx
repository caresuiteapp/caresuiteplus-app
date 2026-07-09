import { Slot, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText, useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
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
  const text = useAuroraAdaptiveText();
  const chipStyles = useAuroraGlassChipStyles();
  const accent = moduleColor('office');
  const activeTab = resolveOfficeTimeTrackingTabKey(pathname);
  const ownCaptureActive = isOfficeTimeTrackingOwnCaptureRoute(pathname);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: text.primary }]}>Arbeitszeit</Text>
          <Text style={[styles.subtitle, { color: text.secondary }]}>
            Workforce Management — Teamsteuerung und Prüfung
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(OFFICE_TIME_TRACKING_OWN_HREF as never)}
          style={({ pressed }) => [
            styles.ownLink,
            ownCaptureActive && { borderColor: accent },
            pressed && styles.ownLinkPressed,
          ]}
          accessibilityRole="link"
          accessibilityLabel="Eigene Erfassung öffnen"
        >
          <Text style={[styles.ownLinkText, { color: ownCaptureActive ? accent : text.secondary }]}>
            Eigene Erfassung
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
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
                chipStyles.chip,
                selected && chipStyles.chipSelected,
                pressed && chipStyles.chipPressed,
                styles.tabChip,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[chipStyles.label, selected && chipStyles.labelSelected]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.content}>
        <Slot />
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: careSpacing.md,
    paddingHorizontal: careSpacing.md,
    paddingTop: careSpacing.md,
    paddingBottom: careSpacing.sm,
  },
  headerText: {
    flex: 1,
    gap: careSpacing.xs,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
  },
  ownLink: {
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.xs,
  },
  ownLinkPressed: {
    opacity: 0.85,
  },
  ownLinkText: {
    ...typography.caption,
    fontWeight: '600',
  },
  tabScroll: {
    flexGrow: 0,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? {
          maxHeight: 44,
          overflowX: 'auto' as const,
          overflowY: 'hidden' as const,
        }
      : null),
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.sm,
  },
  tabChip: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: careSpacing.md,
    backgroundColor: Platform.OS === 'web' ? 'rgba(250,251,252,0.92)' : 'transparent',
    ...(Platform.OS === 'web'
      ? {
          overflowX: 'hidden' as const,
          maxWidth: '100%',
        }
      : null),
  },
});
