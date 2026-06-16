import { AuthHero } from '@/design/components';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { defaultRegisteringVisibility, type UiVisibility } from '@/lib/ui/uiVisibility';

type AuthRegisterHeroProps = {
  visibility?: UiVisibility;
};

export function AuthRegisterHero({ visibility = defaultRegisteringVisibility() }: AuthRegisterHeroProps) {
  void visibility;
  return (
    <AuthHero
      eyebrow="REGISTRIERUNG"
      title="Unternehmen anlegen"
      subtitle="Mandant und Admin-Benutzer in wenigen Schritten einrichten"
      iconEmoji="🏢"
      accentColor={galaxyPalette.careOrange}
      badges={[
        { kind: 'info', label: 'Office inklusive' },
        { kind: 'active', label: 'Module wählbar' },
        { kind: 'success', label: 'Sofort startklar' },
      ]}
    />
  );
}
