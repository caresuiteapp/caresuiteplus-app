import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import { useAuroraGlassModalStyle } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

type TenantCenterGlassModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
  primaryDisabled?: boolean;
  large?: boolean;
};

export function TenantCenterGlassModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  primaryLabel = 'Speichern',
  onPrimary,
  primaryLoading,
  primaryDisabled,
  large = false,
}: TenantCenterGlassModalProps) {
  const formPanelStyle = useAuroraGlassModalStyle({ viewContext: 'form' });

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidth={large ? 1120 : 640}
      maxHeightRatio={large ? 0.92 : 0.88}
      bodyStyle={styles.modalBody}
    >
      <View style={styles.body}>
        <ScrollView
          style={[styles.scroll, large ? styles.scrollLarge : null]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.formPanel, formPanelStyle]}>{children}</View>
        </ScrollView>
        <View style={styles.actions}>
          <PremiumButton title="Schließen" variant="secondary" onPress={onClose} />
          {onPrimary ? (
            <PremiumButton
              title={primaryLabel}
              onPress={onPrimary}
              loading={primaryLoading}
              disabled={primaryDisabled}
            />
          ) : null}
        </View>
      </View>
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  modalBody: {
    paddingTop: 0,
    gap: 0,
  },
  body: {
    gap: careSpacing.md,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 480,
  },
  scrollLarge: {
    maxHeight: 640,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formPanel: {
    borderRadius: careRadius.lg,
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
  actions: {
    gap: careSpacing.sm,
  },
});
