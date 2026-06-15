import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { CareLightPageShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { updateDemoCounselingCase, getDemoCounselingCaseById } from '@/data/demo/counselingCases';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import { colors, spacing } from '@/theme';

/** /beratung/faelle/[id]/edit */
export function CaseEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { isReadOnly, roleLabel } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [summary, setSummary] = useState('');
  const [statusKey, setStatusKey] = useState('entwurf');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const item = getDemoCounselingCaseById(id);
    if (item) {
      setSubject(item.subject);
      setCategory(item.category);
      setSummary(item.summary ?? '');
      setStatusKey(item.status);
    }
    setLoading(false);
  }, [id]);

  function handleSave() {
    if (!id || isReadOnly || !subject.trim()) return;
    const updated = updateDemoCounselingCase(id, {
      subject: subject.trim(),
      category: category.trim(),
      summary: summary.trim() || null,
      status: statusKey as never,
    });
    if (!updated) {
      setError('Fall konnte nicht gespeichert werden.');
      return;
    }
    setSaved(true);
    setTimeout(() => router.replace(`/beratung/faelle/${id}` as never), 900);
  }

  if (loading) {
    return (
      <CareLightPageShell title="Fall bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Beratungsfall wird geladen…" />
      </CareLightPageShell>
    );
  }

  if (saved) {
    return (
      <CareLightPageShell title="Gespeichert" showBack={false}>
        <SuccessState message="Beratungsfall aktualisiert." />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="Fall bearbeiten" subtitle={roleLabel ?? 'Beratung'} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="BERATUNG · FALL"
          title="Fall bearbeiten"
          meta="Anliegen, Kategorie und Status"
          icon="✏️"
          formMode="edit"
          accentColor={colors.orange}
        />
        <PremiumCard>
          <SectionPanel title="Stammdaten">
            <PremiumInput label="Anliegen *" value={subject} onChangeText={setSubject} editable={!isReadOnly} />
            <PremiumInput label="Kategorie" value={category} onChangeText={setCategory} editable={!isReadOnly} />
            <PremiumInput label="Zusammenfassung" value={summary} onChangeText={setSummary} multiline editable={!isReadOnly} />
            <PremiumInput label="Status" value={statusKey} onChangeText={setStatusKey} editable={!isReadOnly} />
          </SectionPanel>
          {error ? <ErrorState message={error} /> : null}
          <PremiumButton title="Speichern" fullWidth disabled={isReadOnly || !subject.trim()} onPress={handleSave} />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </PremiumCard>
      </ScrollView>
    </CareLightPageShell>
  );
}


const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md } });
