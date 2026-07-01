import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Modal, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { cleanupOrphanedFullscreenOverlays } from '@/lib/dom/cleanupOrphanedFullscreenOverlays';

export const FULLSCREEN_OVERLAY_Z_INDEX = 9999;
export { cleanupOrphanedFullscreenOverlays };

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
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    const blockTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };
    document.addEventListener('touchmove', blockTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
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
      } as ViewStyle)
    : null;

/**
 * Screen-filling overlay — portals to document.body on web to escape parent
 * overflow/transform clipping; uses native Modal elsewhere.
 *
 * Portal host is created only while `visible` and removed on hide/unmount so
 * a white shell cannot leak onto other routes when the parent screen stays mounted.
 */
export function FullscreenOverlay({
  visible,
  children,
  onRequestClose,
  zIndex = FULLSCREEN_OVERLAY_Z_INDEX,
  testID = 'fullscreen-overlay',
}: Props) {
  useWebBodyScrollLock(visible);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      setPortalHost(null);
      return;
    }

    if (!visible) {
      cleanupOrphanedFullscreenOverlays();
      setPortalHost(null);
      return;
    }

    cleanupOrphanedFullscreenOverlays();

    const host = document.createElement('div');
    host.setAttribute('data-caresuite-fullscreen-overlay', testID);
    document.body.appendChild(host);
    setPortalHost(host);

    return () => {
      host.remove();
      setPortalHost((current) => (current === host ? null : current));
      cleanupOrphanedFullscreenOverlays();
    };
  }, [visible, testID]);

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
    if (!portalHost) return null;
    return createPortal(content, portalHost);
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
