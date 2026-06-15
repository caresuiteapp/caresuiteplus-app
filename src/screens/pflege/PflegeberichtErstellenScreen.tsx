import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogValueSelect } from '@/components/templates';
import { FormScreenHero } from '@/components/forms';
import { CareLightPageShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { createPflegeBericht } from '@/lib/pflege/pflegeReportListService';
import { demoClients } from '@/data/demo/clients';
import { colors, spacing } from '@/theme';

/** Arbeitsplan 066 — /pflege/berichte/new */
export function PflegeberichtErstellenScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();
  const [title, setTitle] = useState('');
  const [reportType, setReportType] = useState('pflegebericht');
  const [clientName, setClientName] = useState(
    demoClients[0] ? `${demoClients[0].firstName} ${demoClients[0].lastName}` : '',
  );
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  async function handleSubmit() {
    if (isReadOnly) return;
    setLoading(true);
    setError(null);
    const result = await createPflegeBericht(profile?.roleKey, {
      title: title.trim(),
      reportType,
      clientName: clientName.trim(),
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
      <CareLightPageShell title="Pflegebericht erstellen" subtitle="Speichern…">
        <LoadingState message="Pflegebericht wird gespeichert…" />
      </CareLightPageShell>
    );
  }

  if (createdId) {
    return (
      <CareLightPageShell title="Pflegebericht erstellen" subtitle="Erstellt">
        <SuccessState message="Pflegebericht wurde angelegt und in der Akte abgelegt." />
        <PremiumButton
          title="Zur Übersicht"
          fullWidth
          onPress={() => router.replace('/pflege/berichte' as never)}
        />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Pflegebericht erstellen" subtitle={roleLabel ?? 'Pflege'}>
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
        <PremiumInput label="Klient:in" value={clientName} onChangeText={setClientName} />
        <PremiumInput
          label="Berichtstext"
          value={content}
          onChangeText={setContent}
          multiline
          placeholder="Beobachtungen, Maßnahmen, Evaluation…"
        />
        {error ? <ErrorState title="Eingabe" message={error} /> : null}
        <PremiumButton title="Speichern" fullWidth onPress={handleSubmit} disabled={isReadOnly} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </PremiumCard>
    </CareLightPageShell>
  );
}

void createPflegeBericht;

/** Alias für Sprint-Nomenklatur */
export const CareReportCreateScreen = PflegeberichtErstellenScreen;

const styles = StyleSheet.create({ heroWrap: { marginBottom: spacing.md } });
