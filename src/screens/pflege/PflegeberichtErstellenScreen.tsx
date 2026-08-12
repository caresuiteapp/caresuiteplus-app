import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { createPflegeBericht } from '@/lib/pflege/pflegeReportListService';
import { colors, spacing, typography } from '@/theme';

/** Arbeitsplan 066 — /pflege/berichte/new */
export function PflegeberichtErstellenScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const clients = useAsyncQuery(
    () => tenantId ? fetchEligibleCareClients(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const clientOptions = useMemo(() => (clients.data ?? []).map((client) => ({ key: client.id, label: `${client.lastName}, ${client.firstName}` })), [clients.data]);
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('pflegebericht');
  const [clientId, setClientId] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSubmit() {
    if (isReadOnly) return;
    setLoading(true);
    setError(null);
    if (!tenantId) { setLoading(false); setError('Kein Mandant zugeordnet.'); return; }
    const result = await createPflegeBericht(profile?.roleKey, {
      tenantId,
      clientId,
      title: title.trim(),
      reportType,
      content: content.trim(),
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedId(result.data.id);
  }

  if (loading) {
    return (
      <ScreenShell title="Pflegebericht erstellen" subtitle="Speichern…">
        <LoadingState message="Pflegebericht wird gespeichert…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Pflegebericht erstellen" subtitle="Erstellt">
        <SuccessState message="Pflegebericht wurde angelegt und in der Akte abgelegt." />
        <PremiumButton
          title="Zur Übersicht"
          fullWidth
          onPress={() => router.replace('/pflege/berichte' as never)}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Pflegebericht erstellen" subtitle={roleLabel ?? 'Pflege'}>
      <View style={styles.heroWrap}>
        <FormScreenHero
          eyebrow="PFLEGE · BERICHT"
          title="Pflegebericht erstellen"
          meta="Berichtstyp, Vorlage, Text und Aktenablage"
          icon="📄"
          formMode="create"
          accentColor={colors.cyan}
        />
      </View>
      <PremiumCard>
        {!title && !content ? (
          <EmptyState title="Neuer Pflegebericht" message="Berichtstyp und Text unten erfassen." />
        ) : null}
        <CatalogValueSelect
          catalogType="document_category"
          label="Berichtstyp"
          required
          value={reportType}
          onChange={setReportType}
        />
        <PremiumInput label="Titel" value={title} onChangeText={setTitle} />
        <Text style={styles.label}>Aktiver Pflegefall *</Text>
        <FilterChipGroup wrap options={clientOptions} value={clientId} onChange={setClientId} />
        <PremiumInput
          label="Berichtstext"
          value={content}
          onChangeText={setContent}
          multiline
          placeholder="Beobachtungen, Maßnahmen, Evaluation…"
        />
        {error ? <ErrorState title="Eingabe" message={error} /> : null}
        <PremiumButton title="Live speichern und zurücklesen" fullWidth onPress={handleSubmit} disabled={isReadOnly || !clientId} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </PremiumCard>
    </ScreenShell>
  );
}

void createPflegeBericht;

/** Alias für Sprint-Nomenklatur */
export const CareReportCreateScreen = PflegeberichtErstellenScreen;

const styles = StyleSheet.create({ heroWrap: { marginBottom: spacing.md }, label: { ...typography.label, color: colors.textMuted } });
