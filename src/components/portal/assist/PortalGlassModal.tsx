import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalGlassModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
};

/** Glass overlay modal — aurora background shows through shell. */
export function PortalGlassModal({
  visible,
  title,
  onClose,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading,
}: PortalGlassModalProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <PlatformModal visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <GlassCard>
          <Text style={[type.cardTitle, { color: text.primary }]}>{title}</Text>
          {children}
        </GlassCard>
        <View style={styles.actions}>
          <PremiumButton title="Schließen" variant="secondary" onPress={onClose} />
          {primaryLabel && onPrimary ? (
            <PremiumButton
              title={primaryLabel}
              onPress={onPrimary}
              loading={primaryLoading}
            />
          ) : null}
        </View>
      </View>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: careSpacing.md,
  },
  actions: {
    gap: careSpacing.sm,
  },
});
