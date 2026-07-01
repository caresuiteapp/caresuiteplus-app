import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

export const FULLSCREEN_OVERLAY_Z_INDEX = 9999;

type Props = {
  visible: boolean;
  children: ReactNode;
  onRequestClose?: () => void;
  zIndex?: number;
  testID?: string;
};

function useWebBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof document === 'undefined') return;

    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';
    document.body.style.touchAction = 'none';

    const blockTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };
    document.addEventListener('touchmove', blockTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
      document.body.style.touchAction = prevTouchAction;
      document.removeEventListener('touchmove', blockTouchMove);
    };
  }, [active]);
}

const webFixedShell =
  Platform.OS === 'web'
    ? ({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overscrollBehavior: 'contain',
        touchAction: 'none',
      } as ViewStyle)
    : null;

/**
 * Screen-filling overlay — portals to document.body on web to escape parent
 * overflow/transform clipping; uses native Modal elsewhere.
 */
export function FullscreenOverlay({
  visible,
  children,
  onRequestClose,
  zIndex = FULLSCREEN_OVERLAY_Z_INDEX,
  testID = 'fullscreen-overlay',
}: Props) {
  useWebBodyScrollLock(visible);

  if (!visible) return null;

  const shellStyle = [
    styles.shell,
    webFixedShell,
    Platform.OS === 'web' ? ({ zIndex } as ViewStyle) : null,
  ];

  const content = (
    <View style={shellStyle} accessibilityViewIsModal testID={testID}>
      {children}
    </View>
  );

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
    minHeight: 0,
  },
});
