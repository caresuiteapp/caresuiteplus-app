import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { OnboardingSetupHero } from '@/components/auth/OnboardingSetupHero';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { MODULE_NAV_CONFIG } from '@/data/demo/navigation';
import { PRODUCT_LABELS } from '@/data/demo/products';
import {
  getPublicPackages,
  resolvePackageModules,
  type PackageKey,
} from '@/lib/billing';
import { isSpecialtyModuleKey } from '@/lib/modules/constants';
import type { ProductKey } from '@/types';
import { loadOnboardingDraft, saveOnboardingDraft } from '@/lib/onboarding/onboardingService';
import { colors, radius, spacing, typography } from '@/theme';

const DEFAULT_PACKAGE: PackageKey = 'pflege_pro';

export function CompanySetupScreen() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<PackageKey | null>(DEFAULT_PACKAGE);
  const [selectedModules, setSelectedModules] = useState<ProductKey[]>(
    resolvePackageModules(DEFAULT_PACKAGE),
  );
  const [useCustomModules, setUseCustomModules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const publicPackages = getPublicPackages().filter((pkg) => !pkg.isContactSales);

  const toggleModule = (key: ProductKey) => {
    setUseCustomModules(true);
    setSelectedPackage(null);
    setSelectedModules((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectPackage = (packageKey: PackageKey) => {
    setUseCustomModules(false);
    setSelectedPackage(packageKey);
    setSelectedModules(resolvePackageModules(packageKey));
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmed = companyName.trim();
    if (!trimmed) {
      setError('Bitte geben Sie einen Firmennamen ein.');
      return;
    }
    if (selectedModules.length === 0) {
      setError('Bitte wählen Sie mindestens ein Modul oder Paket.');
      return;
    }
    const existing = await loadOnboardingDraft();
    await saveOnboardingDraft({
      firstName: existing?.firstName ?? 'Demo',
      lastName: existing?.lastName ?? 'Nutzer',
      email: existing?.email ?? 'demo@caresuiteplus.app',
      companyName: trimmed,
      modules: selectedModules,
    });
    setSuccess(true);
  };

  if (success) {
    return (
      <ScreenShell title="Mandant eingerichtet" subtitle="Demo abgeschlossen" showBack={false}>
        <SuccessState
          message={`„${companyName.trim()}" wurde als Demo-Mandant konfiguriert (${selectedModules.length} Module) und lokal gespeichert.`}
        />
        <PremiumButton
          title="Zur Business-Anmeldung"
          fullWidth
          onPress={() => router.replace('/auth/business-login' as never)}
        />
        <PremiumButton
          title="Zur Startseite"
          variant="secondary"
          fullWidth
          onPress={() => router.replace('/' as never)}
          style={styles.secondaryAction}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Mandant einrichten"
      subtitle="Demo-Konfiguration — ohne Speicherung"
      scroll
    >
      <OnboardingSetupHero moduleCount={selectedModules.length} />

      {error ? <ErrorState message={error} onRetry={() => setError(null)} /> : null}

      <SectionPanel title="Firmendaten" subtitle="Name Ihrer Organisation">
        <PremiumInput
          label="Firmenname *"
          placeholder="z. B. Pflegedienst Sonnenschein GmbH"
          value={companyName}
          onChangeText={setCompanyName}
          autoCapitalize="words"
          hint="Wird nur für diese Demo-Sitzung verwendet"
        />
      </SectionPanel>

      <SectionPanel title="Paket wählen" subtitle="Empfohlene Startpakete">
        <View style={styles.packages}>
          {publicPackages.map((pkg) => {
            const selected = !useCustomModules && selectedPackage === pkg.key;
            return (
              <Pressable
                key={pkg.key}
                onPress={() => selectPackage(pkg.key)}
                style={({ pressed }) => [
                  styles.packageRow,
                  selected && styles.packageRowSelected,
                  pressed && styles.packageRowPressed,
                ]}
              >
                <View style={styles.packageText}>
                  <Text style={styles.packageTitle}>{pkg.publicLabel}</Text>
                  <Text style={styles.packageDesc}>{pkg.description}</Text>
                  {pkg.key !== 'office_solo' ? (
                    <Text style={styles.includedHint}>Office inklusive</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </SectionPanel>

      <SectionPanel
        title="Einzelmodule (optional)"
        subtitle="Manuelle Auswahl — Office wird bei Fachmodulen automatisch enthalten"
      >
        <View style={styles.modules}>
          {(Object.keys(MODULE_NAV_CONFIG) as ProductKey[]).map((key) => {
            const config = MODULE_NAV_CONFIG[key];
            const selected = selectedModules.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleModule(key)}
                style={({ pressed }) => [
                  styles.moduleRow,
                  selected && styles.moduleRowSelected,
                  pressed && styles.moduleRowPressed,
                ]}
              >
                <Text style={styles.moduleIcon}>{config.icon}</Text>
                <View style={styles.moduleText}>
                  <Text style={styles.moduleTitle}>{PRODUCT_LABELS[key]}</Text>
                  <Text style={styles.moduleDesc}>{config.description}</Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.moduleHint}>
          {selectedModules.length} Modul{selectedModules.length === 1 ? '' : 'e'} ausgewählt
        </Text>
        {selectedModules.some((key) => isSpecialtyModuleKey(key)) && !selectedModules.includes('office') ? (
          <Text style={styles.includedHint}>
            CareSuite+ Office ist als Basisverwaltung automatisch enthalten, wenn Sie ein Fachmodul
            buchen.
          </Text>
        ) : null}
      </SectionPanel>

      <PremiumButton title="Mandant einrichten" fullWidth onPress={handleSubmit} />
      <PremiumButton
        title="Zur Registrierung"
        variant="secondary"
        fullWidth
        onPress={() => router.push('/auth/register' as never)}
        style={styles.secondaryAction}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  packages: { gap: spacing.sm, marginBottom: spacing.sm },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  packageRowSelected: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  packageRowPressed: { opacity: 0.9 },
  packageText: { flex: 1, gap: 2 },
  packageTitle: { ...typography.bodyStrong },
  packageDesc: { ...typography.caption, color: colors.textSecondary },
  modules: { gap: spacing.sm },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgSurface,
  },
  moduleRowSelected: {
    borderColor: colors.orange,
    backgroundColor: 'rgba(255,149,0,0.08)',
  },
  moduleRowPressed: { opacity: 0.9 },
  moduleIcon: { fontSize: 24 },
  moduleText: { flex: 1, gap: 2 },
  moduleTitle: { ...typography.bodyStrong },
  moduleDesc: { ...typography.caption, color: colors.textSecondary },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
  },
  checkmark: {
    color: colors.bgBase,
    fontSize: 14,
    fontWeight: '700',
  },
  moduleHint: {
    ...typography.caption,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  includedHint: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
    color: colors.cyan,
  },
  info: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  secondaryAction: {
    marginTop: spacing.sm,
  },
});
