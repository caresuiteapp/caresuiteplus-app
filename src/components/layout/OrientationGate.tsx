import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LandscapePrompt } from '@/components/layout/LandscapePrompt';
import type { LandscapeScreenKey } from '@/config/landscapeRequiredScreens';
import { hasLandscapeSoftFallback } from '@/config/landscapeRequiredScreens';
import { useLandscapeRequired, type UseLandscapeRequiredOptions } from '@/hooks/useOrientation';

type Props = {
  screenKey: LandscapeScreenKey;
  children: ReactNode;
  /** When false, gate is transparent (no prompt, no lock). */
  active?: boolean;
  options?: Omit<UseLandscapeRequiredOptions, 'active'>;
};

/**
 * Per-screen landscape hint — wraps specific screens only, never PortalShell globally.
 * Renders a bottom-sheet prompt as flex sibling; workflow content stays interactive.
 */
export function OrientationGate({ screenKey, children, active = true, options }: Props) {
  const dismissScope = options?.dismissScope ?? screenKey;
  const state = useLandscapeRequired(screenKey, { ...options, active, dismissScope });
  const softFallback = hasLandscapeSoftFallback(screenKey);

  return (
    <View style={styles.host}>
      <View style={styles.content}>{children}</View>
      <LandscapePrompt
        visible={state.showOverlay}
        variant={state.overlayVariant}
        pending={state.lockPending}
        lockFailed={state.lockFailed}
        onActivateLandscape={() => {
          void state.requestLandscapeLock();
        }}
        onContinuePortrait={
          softFallback || state.lockFailed || state.overlayVariant === 'hint'
            ? state.continueInPortrait
            : undefined
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
});
