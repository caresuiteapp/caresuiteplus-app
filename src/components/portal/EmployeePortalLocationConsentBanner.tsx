import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { EmployeePortalLocationConsent } from '@/types/modules/employeePortalTracking';

type EmployeePortalLocationConsentBannerProps = {
  consent: EmployeePortalLocationConsent | null;
  onAccept: () => void;
  onCancel?: () => void;
  loading?: boolean;
};

export function EmployeePortalLocationConsentBanner({
  consent,
  onAccept,
  onCancel,
  loading = false,
}: EmployeePortalLocationConsentBannerProps) {
  return (
    <View
      style={styles.overlay}
      accessibilityViewIsModal
      accessibilityRole="alert"
      testID="employee-background-location-disclosure"
    >
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon} accessibilityElementsHidden>⌖</Text>
        </View>
        <Text style={styles.kicker}>DIENSTLICHE GPS-AUFZEICHNUNG</Text>
        <Text style={styles.title}>Fahrten und Einsatztag vollständig erfassen</Text>
        <Text style={styles.body}>
          CareSuite erfasst deinen präzisen Standort während einer von dir gestarteten
          dienstlichen Fahrt und des aktiven Einsatztags – auch wenn die App im Hintergrund
          läuft oder das Display ausgeschaltet ist.
        </Text>
        <Text style={styles.body}>
          Daraus entstehen Anfahrts-, Zwischen-, Weiter- und Heimfahrten im Fahrtenbuch sowie
          Ankunfts- und Einsatznachweise. Android zeigt währenddessen dauerhaft „CareSuite
          GPS-Aufzeichnung aktiv“ an. Außerhalb eines aktiven Fahrt-/Einsatzkontexts findet
          keine dienstliche Hintergrundaufzeichnung statt.
        </Text>
        <Text style={styles.privacy}>
          Die Daten werden geschützt und nur für freigegebene dienstliche Funktionen im
          jeweiligen Mandanten verarbeitet. Du kannst die Berechtigung in den
          Android-Einstellungen ändern.
        </Text>
        {consent?.explainedAt ? (
          <Text style={styles.alreadyExplained}>Hinweis wurde bereits angezeigt.</Text>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={onAccept}
          disabled={loading}
          accessibilityRole="button"
          testID="employee-background-location-continue"
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Wird vorbereitet …' : 'Verstanden · Berechtigung prüfen'}
          </Text>
        </Pressable>
        {onCancel ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={onCancel}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Nicht jetzt</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 20_000,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 12, 28, 0.9)',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '94%',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#9DD9FF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F4FF',
  },
  icon: { fontSize: 30, fontWeight: '800', color: '#0878F9' },
  kicker: { fontSize: 12, lineHeight: 16, fontWeight: '900', color: '#0878F9', letterSpacing: 0.8 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#10213A', textAlign: 'center' },
  body: { fontSize: 15, lineHeight: 22, color: '#334A65', textAlign: 'left', width: '100%' },
  privacy: { fontSize: 13, lineHeight: 19, color: '#536A82', textAlign: 'left', width: '100%' },
  alreadyExplained: { fontSize: 12, lineHeight: 17, color: '#536A82' },
  primaryButton: {
    width: '100%',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0878F9',
  },
  primaryButtonText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  secondaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '800', color: '#29415C' },
  pressed: { opacity: 0.72 },
});
