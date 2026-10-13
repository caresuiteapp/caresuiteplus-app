import { View, StyleSheet } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { MODULE_NAV_MODAL_SCREENS } from '@/lib/navigation/moduleNav';
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
        {modalStack.map((item, index) => {
          const Component = item.modalKey ? MODULE_NAV_MODAL_SCREENS[item.modalKey]?.Component : undefined;
          const active = index === depth - 1;
          return <View key={item.id} style={active ? undefined : styles.hiddenPage} pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
            {Component ? <Component embeddedInModal payload={item.payload} /> : null}
          </View>;
        })}
      </PlatformModal>
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenPage: { display: 'none' },
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 2000,
  },
});
