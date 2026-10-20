import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import { useScreensaverActivityEvents } from '@/hooks/useScreensaverActivityEvents';
import { screensaverIsActive } from '@/lib/screensaver/screensaverTypes';
import { ScreensaverOverlay } from './ScreensaverOverlay';
import { useScreensaverSettings } from './ScreensaverSettingsProvider';

/**
 * Global desktop/tablet screensaver — mounts once at app root (S.1).
 */
export function GlobalScreensaver() {
  const { isPhone } = useDeviceClass();
  const {
    settings,
    isLoaded,
    previewActive,
    previewSettings,
    visible,
    showScreensaver,
    hideScreensaver,
  } = useScreensaverSettings();

  const allowedOnDevice = !isPhone;
  const screensaverEnabled = isLoaded && allowedOnDevice && screensaverIsActive(settings);
  const overlayVisible = visible && allowedOnDevice;

  const { resetTimer } = useInactivityTimer({
    enabled: screensaverEnabled && !previewActive,
    timeoutMs: settings.timeoutMinutes * 60_000,
    visible: overlayVisible,
    onTimeout: showScreensaver,
  });

  useScreensaverActivityEvents({
    enabled: allowedOnDevice && (screensaverEnabled || previewActive),
    onActivity: () => {
      if (overlayVisible) {
        hideScreensaver();
      } else {
        resetTimer();
      }
    },
  });

  const overlaySettings = previewSettings ?? settings;

  return (
    <ScreensaverOverlay
      visible={overlayVisible}
      settings={overlaySettings}
      onDismiss={() => {
        hideScreensaver();
        resetTimer();
      }}
    />
  );
}
