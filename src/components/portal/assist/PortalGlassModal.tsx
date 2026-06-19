import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumButton } from '@/components/ui';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';

type PortalGlassModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  primaryLabel?: string;
  onPrimary?: () => void;
  primaryLoading?: boolean;
};

/** Glass overlay modal — opaque shell via PlatformModal + GlassSurface elevated. */
export function PortalGlassModal({
  visible,
  title,
  onClose,
  children,
  primaryLabel,
  onPrimary,
  primaryLoading,
}: PortalGlassModalProps) {
  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title={title}
      bodyStyle={styles.modalBody}
    >
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formPanel}>{children}</View>
        </ScrollView>
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
  modalBody: {
    paddingTop: 0,
    gap: 0,
  },
  body: {
    gap: careSpacing.md,
  },
  scroll: {
    flexGrow: 0,
    maxHeight: 420,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formPanel: {
    backgroundColor: auroraGlass.modal,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: auroraGlass.borderStrong,
    padding: careSpacing.md,
    gap: careSpacing.sm,
  },
  actions: {
    gap: careSpacing.sm,
  },
});
