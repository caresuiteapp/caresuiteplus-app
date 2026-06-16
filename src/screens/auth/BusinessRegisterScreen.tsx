import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumPreparedNotice } from '@/components/billing/PremiumPreparedNotice';
import { AccessCredentialsPanel } from '@/components/auth/AccessCredentialsPanel';
import {
  ErrorState,
  GlassCard,
  InputField,
  ModuleCard,
  PremiumButton,
  RegisterLayout,
} from '@/design/components';
import type { CareModuleKey } from '@/design/tokens/modules';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { AccessCredentialsReveal, BusinessRegistrationInput } from '@/lib/auth/auth.types';
import { registerBusinessTenant } from '@/lib/auth/businessAuthService';

const MODULE_OPTIONS = ['office', 'assist', 'pflege', 'beratung', 'akademie', 'stationaer'] as const;

const PREMIUM_PREPARED_MODULES = new Set<(typeof MODULE_OPTIONS)[number]>(['akademie', 'stationaer']);

const MODULE_META: Record<
  (typeof MODULE_OPTIONS)[number],
  { title: string; description: string; moduleKey: CareModuleKey }
> = {
  office: {
    title: 'CareSuite+ Office',
    description: 'Basis-Modul — immer inklusive',
    moduleKey: 'office',
  },
  assist: {
    title: 'Assist',
    description: 'Einsätze, Touren und mobile Dokumentation',
    moduleKey: 'assist',
  },
  pflege: {
    title: 'Pflege',
    description: 'Pflegeplanung, SIS und Vitalwerte',
    moduleKey: 'pflege',
  },
  beratung: {
    title: 'Beratung',
    description: 'Fälle, Protokolle und Erstgespräche',
    moduleKey: 'beratung',
  },
  akademie: {
    title: 'Akademie',
    description: 'Demnächst verfügbar — Schulungen, Kurse und Zertifikate',
    moduleKey: 'akademie',
  },
  stationaer: {
    title: 'Stationär',
    description: 'Demnächst verfügbar — Bewohner, Übergaben und Wohnbereiche',
    moduleKey: 'stationaer',
  },
};

export function BusinessRegisterScreen() {
  const router = useRouter();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);
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
      <RegisterLayout title="Registrierung erfolgreich" subtitle="Ihr Zugang ist bereit">
        <AccessCredentialsPanel
          title="Zugang erfolgreich erstellt"
          credentials={credentials}
          onClose={() => router.replace('/onboarding' as never)}
        />
        <PremiumButton title="Zum Onboarding" onPress={() => router.replace('/onboarding' as never)} fullWidth />
      </RegisterLayout>
    );
  }

  return (
    <RegisterLayout
      title="Neues Unternehmen registrieren"
      subtitle="CareSuite+ einrichten und Module auswählen"
    >
      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}

      <GlassCard>
        <Text style={[type.caption, styles.stepEyebrow]}>Schritt 1</Text>
        <Text style={[type.h2, styles.sectionTitle]} numberOfLines={1}>
          Unternehmen anlegen
        </Text>
        <View style={styles.fields}>
          <InputField label="Firmenname *" value={form.companyName} onChangeText={(v) => update('companyName', v)} />
          <InputField label="Rechtsform *" value={form.legalForm} onChangeText={(v) => update('legalForm', v)} />
          <InputField label="Branche / Einrichtungstyp *" value={form.industry} onChangeText={(v) => update('industry', v)} />
          <InputField label="Straße *" value={form.street} onChangeText={(v) => update('street', v)} />
          <InputField label="PLZ *" value={form.zip} onChangeText={(v) => update('zip', v)} />
          <InputField label="Ort *" value={form.city} onChangeText={(v) => update('city', v)} />
          <InputField label="Telefon *" value={form.phone} onChangeText={(v) => update('phone', v)} />
          <InputField label="E-Mail *" value={form.email} onChangeText={(v) => update('email', v)} autoCapitalize="none" />
        </View>
      </GlassCard>

      <View style={styles.moduleSection}>
        <Text style={[type.caption, styles.stepEyebrow]}>Schritt 2</Text>
        <Text style={type.h2} numberOfLines={2}>
          Module auswählen
        </Text>
        <Text style={[type.body, styles.moduleHint]} numberOfLines={2}>
          Office ist immer enthalten — Fachmodule nach Bedarf wählen
        </Text>
        <View style={styles.modules}>
          {MODULE_OPTIONS.map((module) => {
            const meta = MODULE_META[module];
            const selected = form.selectedModules.includes(module);
            const locked = module === 'office';
            return (
              <ModuleCard
                key={module}
                moduleKey={meta.moduleKey}
                title={locked ? `${meta.title} — immer enthalten` : meta.title}
                description={meta.description}
                selected={selected || locked}
                locked={locked}
                statusKind={
                  locked
                    ? 'active'
                    : PREMIUM_PREPARED_MODULES.has(module)
                      ? 'comingSoon'
                      : selected
                        ? 'active'
                        : undefined
                }
                onPress={() => toggleModule(module)}
              />
            );
          })}
        </View>
      </View>

      <GlassCard>
        <Text style={[type.caption, styles.stepEyebrow]}>Schritt 3</Text>
        <Text style={[type.h2, styles.sectionTitle]} numberOfLines={1}>
          Admin-Konto
        </Text>
        <View style={styles.fields}>
          <InputField label="Vorname *" value={form.adminFirstName} onChangeText={(v) => update('adminFirstName', v)} />
          <InputField label="Nachname *" value={form.adminLastName} onChangeText={(v) => update('adminLastName', v)} />
          <InputField label="E-Mail *" value={form.adminEmail} onChangeText={(v) => update('adminEmail', v)} autoCapitalize="none" />
          <InputField label="Passwort *" value={form.adminPassword} onChangeText={(v) => update('adminPassword', v)} secureTextEntry />
          <InputField label="Passwort bestätigen *" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        </View>
      </GlassCard>

      <PremiumPreparedNotice compact />

      <View style={styles.submitSection}>
        <Text style={[type.caption, styles.stepEyebrow]}>Schritt 4</Text>
        <PremiumButton title="Prüfen und registrieren" onPress={handleSubmit} loading={loading} fullWidth />
      </View>
    </RegisterLayout>
  );
}

const styles = StyleSheet.create({
  stepEyebrow: { marginBottom: careSpacing.xs, opacity: 0.85 },
  sectionTitle: { marginBottom: careSpacing.sm },
  fields: { gap: careSpacing.md },
  moduleSection: { gap: careSpacing.sm },
  moduleHint: { flexShrink: 1 },
  modules: { gap: careSpacing.sm },
  submitSection: { gap: careSpacing.xs },
});
