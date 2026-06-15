import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingWelcomeHero } from '@/components/auth';
import { ScreenShell } from '@/components/layout';
import {
  FormStepper,
  PremiumButton,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

const STEPS = ['Willkommen', 'Mandant', 'Loslegen'];

export function OnboardingWelcomeScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <ScreenShell
      title="Willkommen bei CareSuite+"
      subtitle={`Schritt ${step + 1} von ${STEPS.length}`}
      showBack={!isFirst}
      onBack={() => setStep((s) => Math.max(0, s - 1))}
      scroll
    >
      <OnboardingWelcomeHero step={step} totalSteps={STEPS.length} />

      <FormStepper steps={STEPS} currentStep={step} />

      {step === 0 ? (
        <SectionPanel
          title="Ihre Plattform für Pflege & Betreuung"
          subtitle="In wenigen Schritten zum eigenen Mandanten"
        >
          <PremiumCard accentColor={colors.orange}>
            <Text style={styles.lead}>
              CareSuite+ vereint Verwaltung, Einsatzplanung, Pflege und Portale in einer
              Premium-Oberfläche — speziell für ambulante und stationäre Anbieter.
            </Text>
            <Text style={styles.body}>
              Dieses Onboarding führt Sie durch die Demo-Einrichtung. Es werden keine Daten
              gespeichert; Sie können jederzeit zur Startseite zurückkehren.
            </Text>
          </PremiumCard>
        </SectionPanel>
      ) : null}

      {step === 1 ? (
        <SectionPanel
          title="Mandant anlegen"
          subtitle="Organisation, Module und Team — alles aus einer Hand"
        >
          <PremiumCard accentColor={colors.cyan}>
            <Text style={styles.body}>
              Im nächsten Schritt legen Sie Ihren Demo-Mandanten an: Firmenname und die
              gewünschten CareSuite+-Module.
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.feature}>• Office — Verwaltung & Klient:innen</Text>
              <Text style={styles.feature}>• Assist — Einsätze & Alltagsbegleitung</Text>
              <Text style={styles.feature}>• Pflege — Pläne & Vitalwerte</Text>
              <Text style={styles.feature}>• Portale für Team und Klient:innen</Text>
            </View>
          </PremiumCard>
        </SectionPanel>
      ) : null}

      {step === 2 ? (
        <SectionPanel title="Loslegen" subtitle="Bereit für die Mandanten-Einrichtung">
          <PremiumCard accentColor={colors.success}>
            <Text style={styles.lead}>Alles klar — fast geschafft!</Text>
            <Text style={styles.body}>
              Richten Sie jetzt Ihren Demo-Mandanten ein oder registrieren Sie sich für
              einen vollständigen Zugang (Demo ohne Speicherung).
            </Text>
          </PremiumCard>
        </SectionPanel>
      ) : null}

      <View style={styles.nav}>
        {!isFirst ? (
          <PremiumButton title="Zurück" variant="secondary" onPress={() => setStep((s) => s - 1)} />
        ) : (
          <PremiumButton title="Abbrechen" variant="ghost" onPress={() => router.replace('/' as never)} />
        )}
        {!isLast ? (
          <PremiumButton title="Weiter" onPress={() => setStep((s) => s + 1)} style={styles.navBtn} />
        ) : (
          <PremiumButton
            title="Mandant einrichten"
            onPress={() => router.push('/onboarding/company-setup' as never)}
            style={styles.navBtn}
          />
        )}
      </View>

      {isLast ? (
        <PremiumButton
          title="Zur Registrierung"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/auth/register' as never)}
          style={styles.secondaryAction}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  lead: {
    ...typography.bodyStrong,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  featureList: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  feature: {
    ...typography.caption,
  },
  nav: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  navBtn: {
    flex: 1,
  },
  secondaryAction: {
    marginTop: spacing.sm,
  },
});
