import { View, StyleSheet } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { MODULE_NAV_MODAL_SCREENS } from '@/lib/navigation/modulenav';
import { useModalStack } from '@/hooks/useModalStack';

/** Renders the top modal entry; stack depth drives back navigation. */
export function ModalStackRenderer() {
  const { modalStack, closeTopModal } = useModalStack();

  if (modalStack.length === 0) return null;

  const depth = modalStack.length;
  const entry = modalStack[depth - 1];
  const registry = entry.modalKey ? MODULE_NAV_MODAL_SCREENS[entry.modalKey] : undefined;
  const title = entry.title || registry?.title || 'Details';
  const subtitle = entry.subtitle ?? registry?.subtitle;
  const maxWidth = entry.maxWidth ?? registry?.maxWidth ?? 720;
  const Component = registry?.Component;

  const handleClose = () => closeTopModal();

  return (
    <View style={styles.host} pointerEvents="box-none">
      <PlatformModal
        visible={true}
        onClose={handleClose}
        onBack={depth > 1 ? handleClose : undefined}
        title={title}
        subtitle={subtitle}
        maxWidth={maxWidth}
      >
        {Component ? <Component embeddedInModal payload={entry.payload} /> : null}
      </PlatformModal>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2000,
  },
});
