import { StyleSheet, Text, View } from 'react-native';
import { AdaptiveKpiGrid } from '@/components/adaptive';
import { PremiumKpiCard, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';

const PREVIEW_KPIS = [
  { label: 'Klient:innen', value: '128', icon: '👥', accent: moduleColor('office') },
  { label: 'Termine heute', value: '24', icon: '📅', accent: moduleColor('assist') },
  { label: 'Offene Aufgaben', value: '7', icon: '✅', accent: moduleColor('pflege') },
  { label: 'Nachrichten', value: '3', icon: '💬', accent: '#67E8F9' },
];

/** Static dashboard body for __DEV__ shell preview screenshots (no auth). */
export function PlatformShellPreviewContent() {
  const text = useAuroraAdaptiveText();
  const type = useAuthFlowTypography();
  const { isDesktopOrWide } = useDeviceClass();

  return (
    <View style={styles.root}>
      <Text style={[type.h2, { color: text.primary }]}>Business Zentrale</Text>
      {isDesktopOrWide ? (
        <Text style={[type.body, { color: text.secondary, marginBottom: careSpacing.sm }]}>
          Responsive Shell-Vorschau — LLGAN Design Tokens
        </Text>
      ) : null}
      <AdaptiveKpiGrid
        items={PREVIEW_KPIS.map((kpi) => ({
          id: kpi.label,
          node: (
            <PremiumKpiCard
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              accentColor={kpi.accent}
            />
          ),
        }))}
      />
      {isDesktopOrWide ? (
        <SectionPanel title="Modulübersicht" subtitle="PlatformShell rail + sidebar + scroll">
          <Text style={[type.body, { color: text.secondary }]}>
            Tablet und Desktop teilen dieselbe Informationsarchitektur. Mobile scrollt die Modulnavigation
            unterhalb des Hauptinhalts — ohne Slide-Drawer.
          </Text>
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: careSpacing.md,
    width: '100%',
  },
});
