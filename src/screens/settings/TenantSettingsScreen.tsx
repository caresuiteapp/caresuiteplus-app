import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { TenantLogoPicker } from '@/components/tenant/TenantLogoPicker';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchTenantSettings,
  saveTenantSettings,
  toTenantSettingsForm,
} from '@/lib/tenant/tenantSettingsService';
import { EMPTY_TENANT_LOGO, type TenantLogoValue } from '@/lib/tenant/tenantLogoService';
import { TENANT_SETTINGS_PERMISSION } from '@/lib/tenant/tenantSettingsRoute';
import type { TenantSettingsForm } from '@/types/tenant/tenantSettings';
import { spacing, typography } from '@/theme';

export function TenantSettingsScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel } = usePermissions();
  const [form, setForm] = useState<TenantSettingsForm | null>(null);
  const [logo, setLogo] = useState<TenantLogoValue>(EMPTY_TENANT_LOGO);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchTenantSettings(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  useEffect(() => {
    if (!query.data) return;
    setForm(toTenantSettingsForm(query.data));
    setLogo({
      displayUri: query.data.logoUrl.trim() || null,
      pending: null,
      removed: false,
    });
  }, [query.data?.updatedAt]);

  if (!can(TENANT_SETTINGS_PERMISSION)) {
    return (
      <CareLightPageShell title="Mandant" subtitle="Organisation" showBack>
        <LockedActionBanner
          message={check(TENANT_SETTINGS_PERMISSION).reason ?? 'Keine Berechtigung für Mandanten-Stammdaten.'}
          roleLabel={roleLabel}
        />
      </CareLightPageShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <CareLightPageShell title="Mandant" subtitle="Wird geladen…" showBack>
        <LoadingState message="Mandantendaten werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <CareLightPageShell title="Mandant" subtitle="Fehler" showBack>
        <ErrorState message={query.error} onRetry={query.refresh} />
      </CareLightPageShell>
    );
  }

  if (!form) return null;

  const patch = <K extends keyof TenantSettingsForm>(key: K, value: TenantSettingsForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!tenantId || !form) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveTenantSettings(tenantId, form, profile?.roleKey, logo);
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      setForm(toTenantSettingsForm(result.data));
      setLogo({
        displayUri: result.data.logoUrl.trim() || null,
        pending: null,
        removed: false,
      });
      await query.refresh();
      return;
    }
    setSaveError(result.error);
  };

  return (
    <CareLightPageShell
      title="Mandant"
      subtitle={`${query.data?.name ?? 'Organisation'} · ${roleLabel ?? ''}`}
      showBack
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>
          Firmenname, Adresse, Kontakt und Logo für Ihren Mandanten — sichtbar in Dokumenten und der App.
        </Text>

        {saved ? <SuccessState message="Mandantendaten gespeichert." /> : null}
        {saveError ? <ErrorState message={saveError} /> : null}

        <SectionPanel title="Firma">
          <PremiumInput
            label="Firmenname"
            value={form.name}
            onChangeText={(value) => patch('name', value)}
            placeholder="z. B. Helferhasen+ Pflegedienst"
          />
          <PremiumInput
            label="Rechtlicher Name (optional)"
            value={form.legalName}
            onChangeText={(value) => patch('legalName', value)}
            placeholder="z. B. Helferhasen Plus GmbH"
          />
        </SectionPanel>

        <SectionPanel title="Adresse">
          <PremiumInput
            label="Straße"
            value={form.street}
            onChangeText={(value) => patch('street', value)}
          />
          <PremiumInput
            label="Hausnummer"
            value={form.houseNumber}
            onChangeText={(value) => patch('houseNumber', value)}
          />
          <PremiumInput label="PLZ" value={form.zip} onChangeText={(value) => patch('zip', value)} />
          <PremiumInput label="Ort" value={form.city} onChangeText={(value) => patch('city', value)} />
          <PremiumInput
            label="Land"
            value={form.country}
            onChangeText={(value) => patch('country', value)}
          />
        </SectionPanel>

        <SectionPanel title="Kontakt">
          <PremiumInput
            label="Telefon"
            value={form.phone}
            onChangeText={(value) => patch('phone', value)}
            keyboardType="phone-pad"
          />
          <PremiumInput
            label="E-Mail"
            value={form.email}
            onChangeText={(value) => patch('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <PremiumInput
            label="Website"
            value={form.website}
            onChangeText={(value) => patch('website', value)}
            autoCapitalize="none"
          />
        </SectionPanel>

        <SectionPanel title="Logo">
          <View style={styles.logoSection}>
            <TenantLogoPicker
              companyName={form.name}
              value={logo}
              onChange={(next) => {
                setLogo(next);
                if (next.pending || next.removed) {
                  patch('logoUrl', '');
                }
                setSaved(false);
                setSaveError(null);
              }}
              disabled={saving}
            />
          </View>
          <PremiumInput
            label="Logo-URL (optional)"
            value={form.logoUrl}
            onChangeText={(value) => {
              patch('logoUrl', value);
              if (value.trim()) {
                setLogo({
                  displayUri: value.trim(),
                  pending: null,
                  removed: false,
                });
              }
            }}
            placeholder="https://…"
            autoCapitalize="none"
            hint="Alternativ: externe Logo-URL statt Datei-Upload."
          />
        </SectionPanel>

        <PremiumButton
          title={saving ? 'Speichern…' : 'Speichern'}
          onPress={handleSave}
          disabled={saving || !form.name.trim()}
        />
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
  },
  lead: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
});
