import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumPreparedNotice } from '@/components/billing/PremiumPreparedNotice';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import { AuthRegisterHero } from '@/components/auth/AuthRegisterHero';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import type { AccessCredentialsReveal, BusinessRegistrationInput } from '@/lib/auth/auth.types';
import { registerBusinessTenant } from '@/lib/auth/businessAuthService';
import { formatFreePlatformPrice } from '@/lib/billing/freePlatformService';
import { colors, spacing, typography } from '@/theme';

const MODULE_OPTIONS = ['office', 'assist', 'pflege', 'beratung', 'akademie', 'stationaer'] as const;

const MODULE_LABELS: Record<(typeof MODULE_OPTIONS)[number], string> = {
  office: 'CareSuite+ Office (Basis)',
  assist: 'Assist',
  pflege: 'Pflege',
  beratung: 'Beratung',
  akademie: 'Akademie',
  stationaer: 'Stationär',
};

export function BusinessRegisterScreen() {
  const router = useRouter();
  const [form, setForm] = useState<BusinessRegistrationInput>({
    companyName: '',
    legalForm: '',
    industry: '',
    street: '',
    zip: '',
    city: '',
    phone: '',
    email: '',
    website: '',
    contactFirstName: '',
    contactLastName: '',
    contactRole: 'Geschäftsführung',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
    selectedModules: ['office', 'assist'],
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentialsReveal | null>(null);

  const update = <K extends keyof BusinessRegistrationInput>(key: K, value: BusinessRegistrationInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleModule = (module: (typeof MODULE_OPTIONS)[number]) => {
    if (module === 'office') return;
    setForm((prev) => ({
      ...prev,
      selectedModules: prev.selectedModules.includes(module)
        ? prev.selectedModules.filter((entry) => entry !== module)
        : [...prev.selectedModules, module],
    }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (form.adminPassword.length < 10) {
      setError('Admin-Passwort muss mindestens 10 Zeichen haben.');
      return;
    }
    if (form.adminPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    const result = await registerBusinessTenant(form);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setCredentials(result.data.credentials ?? { username: result.data.owner.username });
  };

  if (credentials) {
    return (
      <ScreenShell title="Registrierung erfolgreich" subtitle="Mandant angelegt — kostenlos" scroll>
        <AccessCredentialsPanel
          title="Zugang erfolgreich erstellt"
          credentials={credentials}
          onClose={() => router.replace('/onboarding' as never)}
        />
        <PremiumButton title="Zum Onboarding" onPress={() => router.replace('/onboarding' as never)} fullWidth />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Neues Unternehmen registrieren" subtitle="CareSuite+ Free Platform — 0 €" scroll>
      <AuthRegisterHero />
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}

      <SectionPanel title="Unternehmensdaten">
        <PremiumInput label="Firmenname *" value={form.companyName} onChangeText={(v) => update('companyName', v)} />
        <PremiumInput label="Rechtsform *" value={form.legalForm} onChangeText={(v) => update('legalForm', v)} />
        <PremiumInput label="Branche / Einrichtungstyp *" value={form.industry} onChangeText={(v) => update('industry', v)} />
        <PremiumInput label="Straße *" value={form.street} onChangeText={(v) => update('street', v)} />
        <PremiumInput label="PLZ *" value={form.zip} onChangeText={(v) => update('zip', v)} />
        <PremiumInput label="Ort *" value={form.city} onChangeText={(v) => update('city', v)} />
        <PremiumInput label="Telefon *" value={form.phone} onChangeText={(v) => update('phone', v)} />
        <PremiumInput label="E-Mail *" value={form.email} onChangeText={(v) => update('email', v)} autoCapitalize="none" />
      </SectionPanel>

      <SectionPanel title="Admin-Benutzer (Owner)">
        <PremiumInput label="Vorname *" value={form.adminFirstName} onChangeText={(v) => update('adminFirstName', v)} />
        <PremiumInput label="Nachname *" value={form.adminLastName} onChangeText={(v) => update('adminLastName', v)} />
        <PremiumInput label="E-Mail *" value={form.adminEmail} onChangeText={(v) => update('adminEmail', v)} autoCapitalize="none" />
        <PremiumInput label="Passwort *" value={form.adminPassword} onChangeText={(v) => update('adminPassword', v)} secureTextEntry />
        <PremiumInput label="Passwort bestätigen *" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      </SectionPanel>

      <SectionPanel
        title="Module kostenlos aktivieren"
        subtitle={`${formatFreePlatformPrice()} — keine Kreditkarte, kein Checkout`}
      >
        <Text style={styles.freeHint}>
          CareSuite+ Office ist immer enthalten. Wählen Sie zusätzliche Fachmodule — alle kostenlos.
        </Text>
        <View style={styles.modules}>
          {MODULE_OPTIONS.map((module) => {
            const selected = form.selectedModules.includes(module);
            const locked = module === 'office';
            return (
              <PremiumButton
                key={module}
                title={
                  locked
                    ? `✓ ${MODULE_LABELS[module]} — immer aktiv`
                    : selected
                      ? `✓ ${MODULE_LABELS[module]}`
                      : MODULE_LABELS[module]
                }
                variant={selected || locked ? 'primary' : 'secondary'}
                onPress={() => toggleModule(module)}
                disabled={locked}
                fullWidth
              />
            );
          })}
        </View>
      </SectionPanel>

      <PremiumPreparedNotice compact />

      <PremiumButton title="Kostenlos registrieren" onPress={handleSubmit} loading={loading} fullWidth />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  freeHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  modules: { gap: spacing.sm },
});
