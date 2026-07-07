import { Slot, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FilterChipGroup } from '@/components/ui';
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

  const tabOptions = OFFICE_TIME_TRACKING_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
  }));

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

      <FilterChipGroup
        options={tabOptions}
        value={activeTab}
        onSelect={(key) => {
          const tab = OFFICE_TIME_TRACKING_TABS.find((item) => item.key === key);
          if (tab) router.push(tab.href as never);
        }}
        style={styles.tabs}
      />

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
  tabs: {
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.sm,
  },
  content: {
    flex: 1,
  },
});
