import { Slot, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
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
  const accent = moduleColor('office');
  const activeTab = resolveOfficeTimeTrackingTabKey(pathname);
  const ownCaptureActive = isOfficeTimeTrackingOwnCaptureRoute(pathname);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: text.primary }]}>Arbeitszeit</Text>
          <Text style={[styles.subtitle, { color: text.secondary }]}>
            Teamsteuerung · Prüfung · Export
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(OFFICE_TIME_TRACKING_OWN_HREF as never)}
          style={({ pressed }) => [
            styles.ownLink,
            { borderColor: ownCaptureActive ? accent : text.border },
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

      <View style={styles.tabBar}>
        {OFFICE_TIME_TRACKING_TABS.map((tab) => {
          const selected = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(tab.href as never)}
              style={({ pressed }) => [
                styles.tab,
                { borderColor: selected ? accent : text.border },
                selected && { backgroundColor: `${accent}18` },
                pressed && styles.tabPressed,
              ]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: selected ? accent : text.secondary },
                  selected && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
    paddingTop: careSpacing.sm,
    paddingBottom: 4,
  },
  headerText: {
    flex: 1,
    gap: 0,
  },
  title: {
    ...typography.bodyMedium,
    fontWeight: '700',
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 14,
  },
  ownLink: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 4,
  },
  ownLinkPressed: {
    opacity: 0.85,
  },
  ownLinkText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.sm,
    ...(Platform.OS === 'web'
      ? ({
          rowGap: 6,
          columnGap: 6,
        } as object)
      : null),
  },
  tab: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  tabPressed: {
    opacity: 0.88,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: careSpacing.md,
  },
});
