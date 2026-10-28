import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteLogo } from '@/components/brand/CareSuiteLogo';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { lightSurfaceText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveTimeBasedGermanGreeting } from '@/lib/portal/engine/portalHeroCopy';
type BusinessWelcomeModalProps = {
  visible: boolean;
  displayName: string;
  tenantName: string;
  onClose: () => void;
};
/** Mandatory welcome dialog after Verwaltung / business login — tenant-scoped greeting. */
export function BusinessWelcomeModal({
  visible,
  displayName,
  tenantName,
  onClose,
}: BusinessWelcomeModalProps) {
  const greeting = resolveTimeBasedGermanGreeting();
  const text = lightSurfaceText;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          alignItems: 'center',
          gap: careSpacing.md,
          paddingVertical: careSpacing.sm,
        },
        wordmark: {
          alignItems: 'center',
          gap: careSpacing.sm,
          maxWidth: '100%',
        },
        brand: {
          ...careTypography.h2,
          fontSize: 24,
          fontWeight: '800',
          color: text.primary,
          textAlign: 'center',
          flexShrink: 1,
        },
        greeting: {
          ...careTypography.h2,
          fontSize: 26,
          fontWeight: '700',
          color: text.primary,
          textAlign: 'center',
        },
        tenant: {
          ...careTypography.bodyStrong,
          fontSize: 17,
          fontWeight: '700',
          color: text.primary,
          textAlign: 'center',
        },
        tenantHint: {
          ...careTypography.caption,
          color: text.secondary,
          textAlign: 'center',
        },
      }),
    [text.primary, text.secondary],
  );
  return (
    <PlatformModal
      visible={visible}
      title="Willkommen"
      subtitle="Verwaltung · CareSuite HealthOS"
      surfaceScope="company"
      onClose={onClose}
      dismissOnBackdrop={false}
      maxWidth={480}
      glowColor={moduleColor('office')}
      footerActions={[
        {
          title: 'Weiter zur Übersicht',
          onPress: onClose,
          variant: 'primary',
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.wordmark}><CareSuiteLogo size="md" /><Text style={styles.brand}>CareSuite HealthOS</Text></View>
        <Text style={styles.greeting} accessibilityRole="header">
          {greeting}, {displayName}
        </Text>
        <Text style={styles.tenant}>{tenantName}</Text>
        <Text style={styles.tenantHint}>Ihre Verwaltungsübersicht ist bereit.</Text>
      </View>
    </PlatformModal>
  );
}
