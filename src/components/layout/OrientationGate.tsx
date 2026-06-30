import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LandscapeRequiredOverlay } from '@/components/layout/LandscapeRequiredOverlay';
import type { LandscapeScreenKey } from '@/config/landscapeRequiredScreens';
import { useLandscapeRequired, type UseLandscapeRequiredOptions } from '@/hooks/useOrientation';

type Props = {
  screenKey: LandscapeScreenKey;
  children: ReactNode;
  /** When false, gate is transparent (no overlay, no lock). */
  active?: boolean;
  options?: Omit<UseLandscapeRequiredOptions, 'active'>;
};

export function OrientationGate({ screenKey, children, active = true, options }: Props) {
  const state = useLandscapeRequired(screenKey, { ...options, active });

  return (
    <View style={styles.host}>
      <View
        style={state.blockContent ? styles.blocked : styles.content}
        pointerEvents={state.blockContent ? 'none' : 'auto'}
        accessibilityElementsHidden={state.blockContent}
        importantForAccessibility={state.blockContent ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      <LandscapeRequiredOverlay
        visible={state.showOverlay}
        variant={state.overlayVariant}
        pending={state.lockPending}
        lockFailed={state.lockFailed}
        onActivateLandscape={() => {
          void state.requestLandscapeLock();
        }}
        onDismiss={state.overlayVariant === 'banner' ? state.dismissBanner : undefined}
        onContinuePortrait={
          state.overlayVariant === 'hint' ? state.continueInPortrait : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
  blocked: {
    flex: 1,
    minHeight: 0,
    opacity: 0.35,
  },
});
