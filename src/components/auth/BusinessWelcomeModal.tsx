import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteWordmark } from '@/components/brand/CareSuiteWordmark';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
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
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          alignItems: 'center',
          gap: careSpacing.md,
          paddingVertical: careSpacing.sm,
        },
        wordmark: {
          justifyContent: 'center',
        },
        greeting: {
          ...careTypography.h2,
          fontSize: 26,
          fontWeight: '700',
          color: '#F9FAFB',
          textAlign: 'center',
        },
        tenant: {
          ...careTypography.bodyStrong,
          fontSize: 17,
          fontWeight: '700',
          color: '#F9FAFB',
          textAlign: 'center',
        },
        tenantHint: {
          ...careTypography.caption,
          color: 'rgba(249, 250, 251, 0.72)',
          textAlign: 'center',
        },
      }),
    [],
  );

  return (
    <PlatformModal
      visible={visible}
      title="Willkommen"
      subtitle="Verwaltung · CareSuite+"
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
        <CareSuiteWordmark size="lg" variant="aurora" style={styles.wordmark} />
        <Text style={styles.greeting} accessibilityRole="header">
          {greeting}, {displayName}
        </Text>
        <Text style={styles.tenant}>{tenantName}</Text>
        <Text style={styles.tenantHint}>Mandant {tenantName}</Text>
      </View>
    </PlatformModal>
  );
}
