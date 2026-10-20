import { SettingsScreenFrame } from '@/components/settings/settingsscreenframe';
import { ScreensaverSettingsSection } from '@/components/settings/ScreensaverSettingsSection';

export function AppearanceSettingsScreen({
  embeddedInModal = false,
}: {
  embeddedInModal?: boolean;
} = {}) {
  return (
    <SettingsScreenFrame
      title="Darstellung & Oberfläche"
      subtitle="Bildschirmschoner und Darstellung"
      embeddedInModal={embeddedInModal}
      showSideNavigation
    >
      <ScreensaverSettingsSection />
    </SettingsScreenFrame>
  );
}
