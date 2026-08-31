import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
          gap: careSpacing.sm,
          paddingVertical: careSpacing.md,
          justifyContent: 'center',
        },
        avatarWrap: {
          marginVertical: careSpacing.xs,
        },
        brand: {
          ...careTypography.caption,
          color: text.secondary,
          fontWeight: '800',
          letterSpacing: 1.2,
          textAlign: 'center',
          textTransform: 'uppercase',
        },
        greeting: {
          ...careTypography.h2,
          fontSize: 23,
          lineHeight: 29,
          fontWeight: '800',
          color: text.primary,
          textAlign: 'center',
        },
        tenant: {
          ...careTypography.bodyStrong,
          fontSize: 16,
          lineHeight: 22,
          fontWeight: '700',
          color: text.primary,
          textAlign: 'center',
        },
        rolePill: {
          marginTop: careSpacing.xs,
          paddingHorizontal: careSpacing.md,
          paddingVertical: careSpacing.xs,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: `${accent}40`,
          backgroundColor: `${accent}12`,
        },
        role: {
          ...careTypography.caption,
          color: text.primary,
          fontWeight: '700',
          textAlign: 'center',
        },
      }),
    [accent, text.primary, text.secondary],
  );

  return (
    <PlatformModal
      visible={visible}
      title="Willkommen"
      subtitle={PORTAL_SUBTITLE[kind]}
      onClose={onClose}
      dismissOnBackdrop
      maxWidth={440}
      minWidth={0}
      maxHeightRatio={0.88}
      glowColor={accent}
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
        <Text style={styles.brand}>CareSuite HealthOS</Text>
        <Text style={styles.greeting} accessibilityRole="header">
          {greeting}, {displayName}
        </Text>
        <Text style={styles.tenant}>{tenantName}</Text>
        <View style={styles.rolePill}>
          <Text style={styles.role}>{roleLabel}</Text>
        </View>
      </View>
    </PlatformModal>
  );
}
