import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PortalShellLayout } from '@/components/layout/portal';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';

function PortalPreviewBody() {
  const text = useAuroraAdaptiveText();
  const type = useAuthFlowTypography();
  const { isDesktopOrWide } = useDeviceClass();

  return (
    <View style={styles.body}>
      <Text style={[type.h2, { color: text.primary }]}>Klient:innenportal</Text>
      {isDesktopOrWide ? (
        <Text style={[type.body, { color: text.secondary }]}>Portal Shell — scroll-only mobile</Text>
      ) : null}
      <GlassCard glow accentColor={moduleColor('assist')}>
        <Text style={[type.cardTitle, { color: text.primary }]}>Nächster Termin</Text>
        <Text style={[type.body, { color: text.secondary }]}>Mi, 25.06. · 10:00 Uhr · Hausbesuch</Text>
      </GlassCard>
    </View>
  );
}

/** __DEV__ only — client portal shell preview for responsive screenshots. */
export default function PortalPreviewRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <PortalShellLayout accentColor={moduleColor('assist')} kind="client">
      <PortalPreviewBody />
    </PortalShellLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: careSpacing.md,
    width: '100%',
  },
});
