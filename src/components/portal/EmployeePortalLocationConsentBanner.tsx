import { StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumButton } from '@/components/ui';
import type { EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';
import { colors, spacing, typography } from '@/theme';

type EmployeePortalLocationConsentBannerProps = {
  consent: EmployeePortalLocationConsent | null;
  onAccept: () => void;
  loading?: boolean;
};

export function EmployeePortalLocationConsentBanner({
  consent,
  onAccept,
  loading = false,
}: EmployeePortalLocationConsentBannerProps) {
  if (consent?.granted) return null;

  return (
    <View style={styles.wrap}>
      <InfoBanner
        variant="warning"
        title="Standort-Einwilligung erforderlich"
        message="Für Anfahrt und Live-Tracking benötigen wir Ihre Einwilligung. Ihr Standort wird nur während des Einsatzes (Anfahrt bis Ankunft/Beendigung) an Assist/Office übermittelt — nicht dauerhaft. Klient:innen sehen nur eine eingeschränkte Ansicht im Freigabefenster. Tracking endet automatisch bei Beendigung des Einsatzes."
      />
      <PremiumButton
        title="Einwilligung erteilen & verstanden"
        fullWidth
        loading={loading}
        onPress={onAccept}
      />
      <Text style={styles.note}>
        Ohne Einwilligung: keine GPS-Position — Fahrzeit-Timer und Statuswechsel bleiben möglich.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted },
});
