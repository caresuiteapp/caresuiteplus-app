import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { PremiumButton } from '@/components/ui';
import { useAuroraGlassModalStyle } from '@/design/tokens/auroraGlass';
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
  primaryDisabled?: boolean;
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
  primaryDisabled,
}: PortalGlassModalProps) {
  const formPanelStyle = useAuroraGlassModalStyle({ viewContext: 'form' });

  return (
    <PlatformModal
      visible={visible}
      onClose={onClose}
      title={title}
      bodyStyle={styles.modalBody}
    >
      <View style={styles.body}>
        <View style={[styles.formPanel, formPanelStyle]}>{children}</View>
        <View style={styles.actions}>
          <PremiumButton title="Schließen" variant="secondary" onPress={onClose} />
          {primaryLabel && onPrimary ? (
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
    maxHeight: 420,
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
