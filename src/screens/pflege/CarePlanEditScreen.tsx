import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { getDemoCarePlanById, updateDemoCarePlan } from '@/data/demo/carePlans';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

/** /pflege/planung/[id]/edit */
export function CarePlanEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [statusKey, setStatusKey] = useState('entwurf');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const plan = getDemoCarePlanById(id);
    if (plan) {
      setTitle(plan.title);
      setSummary(plan.summary ?? '');
      setStatusKey(plan.status);
    }
    setLoading(false);
  }, [id]);

  function handleSave() {
    if (!id || isReadOnly || !title.trim()) return;
    const updated = updateDemoCarePlan(id, {
      title: title.trim(),
      summary: summary.trim(),
      status: statusKey as never,
    });
    if (!updated) {
      setError('Pflegeplan konnte nicht gespeichert werden.');
      return;
    }
    setSaved(true);
    setTimeout(() => router.replace(`/pflege/planung/${id}` as never), 900);
  }

  if (loading) {
    return (
      <ScreenShell title="Pflegeplan bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Pflegeplan wird geladen…" />
      </ScreenShell>
    );
  }

  if (saved) {
    return (
      <ScreenShell title="Gespeichert" showBack={false}>
        <SuccessState message="Pflegeplan aktualisiert." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Pflegeplan bearbeiten" subtitle={roleLabel ?? 'Pflege'} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="PFLEGE · PFLEGEPLAN"
          title="Pflegeplan bearbeiten"
          meta="Titel, Zusammenfassung und Status"
          icon="✏️"
          formMode="edit"
          accentColor={colors.cyan}
        />
        <PremiumCard>
          <SectionPanel title="Plan">
            <PremiumInput label="Titel *" value={title} onChangeText={setTitle} editable={!isReadOnly} />
            <PremiumInput label="Zusammenfassung" value={summary} onChangeText={setSummary} multiline editable={!isReadOnly} />
            <PremiumInput label="Status" value={statusKey} onChangeText={setStatusKey} editable={!isReadOnly} />
          </SectionPanel>
          {error ? <ErrorState message={error} /> : null}
          <PremiumButton title="Speichern" fullWidth disabled={isReadOnly || !title.trim()} onPress={handleSave} />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md } });
