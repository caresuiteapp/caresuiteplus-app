import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteWordmark } from '@/components/brand/CareSuiteWordmark';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { resolveTimeBasedGermanGreeting } from '@/lib/portal/engine/portalHeroCopy';
import type { PortalWelcomeKind } from '@/lib/auth/portalWelcomeSession';

type PortalWelcomeModalProps = {
  visible: boolean;
  kind: PortalWelcomeKind;
  displayName: string;
  tenantName: string;
  roleLabel: string;
  avatarUrl?: string | null;
  onClose: () => void;
};

const PORTAL_SUBTITLE: Record<PortalWelcomeKind, string> = {
  employee: 'Mitarbeiterportal · CareSuite HealthOS',
  client: 'Klient:innenportal · CareSuite HealthOS',
};

/** Welcome dialog after employee or client portal login — real name, tenant, role. */
export function PortalWelcomeModal({
  visible,
  kind,
  displayName,
  tenantName,
  roleLabel,
  avatarUrl,
  onClose,
}: PortalWelcomeModalProps) {
  const greeting = resolveTimeBasedGermanGreeting();
  const text = useAuroraAdaptiveText();
  const accent = kind === 'employee' ? moduleColor('assist') : moduleColor('assist');
  const styles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          alignItems: 'center',
          gap: careSpacing.md,
          paddingVertical: careSpacing.lg,
          minHeight: 260,
          justifyContent: 'center',
        },
        sheet: {
          minHeight: 430,
        },
        avatarWrap: {
          marginBottom: careSpacing.xs,
        },
        wordmark: {
          justifyContent: 'center',
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
        role: {
          ...careTypography.body,
          color: text.secondary,
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
      subtitle={PORTAL_SUBTITLE[kind]}
      onClose={onClose}
      dismissOnBackdrop
      maxWidth={480}
      maxHeightRatio={0.82}
      glowColor={accent}
      sheetStyle={styles.sheet}
      footerActions={[
        {
          title: 'Zur Übersicht',
          onPress: onClose,
          variant: 'primary',
        },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.avatarWrap}>
          <TopbarProfileAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            accentColor={accent}
            size="md"
          />
        </View>
        <CareSuiteWordmark size="lg" variant="aurora" style={styles.wordmark} />
        <Text style={styles.greeting} accessibilityRole="header">
          {greeting}, {displayName}
        </Text>
        <Text style={styles.tenant}>{tenantName}</Text>
        <Text style={styles.role}>{roleLabel}</Text>
      </View>
    </PlatformModal>
  );
}
