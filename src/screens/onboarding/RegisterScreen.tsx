import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { saveOnboardingDraft } from '@/lib/onboarding/onboardingService';
import { colors, spacing, typography } from '@/theme';

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
};

const INITIAL_FORM: RegisterForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  companyName: '',
};

export function RegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>(INITIAL_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof RegisterForm>(key: K, value: RegisterForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): string | null => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return 'Bitte geben Sie Vor- und Nachname ein.';
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      return 'Bitte geben Sie eine gültige E-Mail-Adresse ein.';
    }
    if (form.password.length < 8) {
      return 'Das Passwort muss mindestens 8 Zeichen haben.';
    }
    if (!form.companyName.trim()) {
      return 'Bitte geben Sie einen Firmennamen ein.';
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    await saveOnboardingDraft({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      companyName: form.companyName.trim(),
      modules: ['office', 'assist'],
    });
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSubmitting(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <ScreenShell title="Registrierung erfolgreich" subtitle="Demo abgeschlossen" showBack={false}>
        <SuccessState
          message={`Willkommen, ${form.firstName.trim()}! Ihr Zugang für „${form.companyName.trim()}" wurde lokal gespeichert (WP 106).`}
        />
        <PremiumButton
          title="Zum Onboarding"
          fullWidth
          onPress={() => router.replace('/onboarding' as never)}
        />
        <PremiumButton
          title="Zur Business-Anmeldung"
          variant="secondary"
          fullWidth
          onPress={() => router.replace('/auth/business-login' as never)}
          style={styles.secondaryAction}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Registrieren" subtitle="Demo-Registrierung ohne Speicherung" scroll>
      <PremiumBadge label="Öffentlicher Zugang — Demo" variant="cyan" dot />

      <PremiumCard accentColor={colors.orange}>
        <Text style={styles.hint}>
          Dieses Formular dient der Demo. Es werden keine Konten angelegt und keine Daten
          an Supabase übermittelt.
        </Text>
      </PremiumCard>

      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}

      <SectionPanel title="Persönliche Daten">
        <PremiumInput
          label="Vorname *"
          value={form.firstName}
          onChangeText={(v) => updateField('firstName', v)}
          autoCapitalize="words"
        />
        <PremiumInput
          label="Nachname *"
          value={form.lastName}
          onChangeText={(v) => updateField('lastName', v)}
          autoCapitalize="words"
        />
        <PremiumInput
          label="E-Mail *"
          value={form.email}
          onChangeText={(v) => updateField('email', v)}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <PremiumInput
          label="Passwort *"
          value={form.password}
          onChangeText={(v) => updateField('password', v)}
          secureTextEntry
          hint="Mindestens 8 Zeichen (Demo)"
        />
      </SectionPanel>

      <SectionPanel title="Organisation">
        <PremiumInput
          label="Firmenname *"
          value={form.companyName}
          onChangeText={(v) => updateField('companyName', v)}
          autoCapitalize="words"
          placeholder="Ihr Pflegedienst oder Ihre Einrichtung"
        />
      </SectionPanel>

      <PremiumButton
        title="Konto registrieren"
        fullWidth
        loading={submitting}
        disabled={submitting}
        onPress={handleSubmit}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Bereits registriert?</Text>
        <PremiumButton
          title="Zur Anmeldung"
          variant="ghost"
          onPress={() => router.push('/auth/business-login' as never)}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  footerText: {
    ...typography.caption,
  },
  secondaryAction: {
    marginTop: spacing.sm,
  },
});
