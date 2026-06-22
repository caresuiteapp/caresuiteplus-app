import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PortalShellLayout } from '@/components/layout/portal';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';

function EmployeePortalPreviewBody() {
  const text = useAuroraAdaptiveText();
  const type = useAuthFlowTypography();
  const { isDesktopOrWide } = useDeviceClass();

  return (
    <View style={styles.body}>
      <Text style={[type.h2, { color: text.primary }]}>Mitarbeiterportal</Text>
      {isDesktopOrWide ? (
        <Text style={[type.body, { color: text.secondary }]}>Employee Portal Shell Preview</Text>
      ) : null}
      <GlassCard glow accentColor={moduleColor('assist')}>
        <Text style={[type.cardTitle, { color: text.primary }]}>Heute</Text>
        <Text style={[type.body, { color: text.secondary }]}>3 Einsätze · 1 offene Durchführung</Text>
      </GlassCard>
    </View>
  );
}

/** __DEV__ only — employee portal shell preview for responsive screenshots. */
export default function EmployeePortalShellPreviewRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <PortalShellLayout accentColor={moduleColor('assist')} kind="employee">
      <EmployeePortalPreviewBody />
    </PortalShellLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: careSpacing.md,
    width: '100%',
  },
});
