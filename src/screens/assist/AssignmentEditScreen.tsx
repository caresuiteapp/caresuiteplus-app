import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CatalogValueSelect } from '@/components/templates';
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
import { getDemoAssignmentSeedById, updateDemoAssignmentFields } from '@/data/demo/assistAssignments';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing } from '@/theme';

/** /assist/einsaetze/[id]/edit */
export function AssignmentEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isReadOnly, roleLabel } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [statusKey, setStatusKey] = useState('entwurf');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    const item = getDemoAssignmentSeedById(id);
    if (item) {
      setTitle(item.title);
      setLocation(item.location);
      setNotes(item.notes ?? '');
      setStatusKey(item.status);
    }
    setLoading(false);
  }, [id]);

  function handleSave() {
    if (!id || isReadOnly || !title.trim()) return;
    const updated = updateDemoAssignmentFields(id, {
      title: title.trim(),
      location: location.trim(),
      notes: notes.trim(),
      status: statusKey as never,
    });
    if (!updated) {
      setError('Einsatz konnte nicht gespeichert werden.');
      return;
    }
    setSaved(true);
    setTimeout(() => router.replace(`/assist/einsaetze/${id}` as never), 900);
  }

  if (loading) {
    return (
      <ScreenShell title="Einsatz bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Einsatz wird geladen…" />
      </ScreenShell>
    );
  }

  if (saved) {
    return (
      <ScreenShell title="Gespeichert" showBack={false}>
        <SuccessState message="Einsatz aktualisiert." />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Einsatz bearbeiten" subtitle={roleLabel ?? 'Assist'} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="ASSIST · EINSATZ"
          title="Einsatz bearbeiten"
          meta="Bezeichnung, Ort, Notizen und Status"
          icon="✏️"
          formMode="edit"
          accentColor={colors.success}
        />
        <PremiumCard>
          <SectionPanel title="Einsatzdaten">
            <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} editable={!isReadOnly} />
            <PremiumInput label="Ort" value={location} onChangeText={setLocation} editable={!isReadOnly} />
            <PremiumInput label="Notizen" value={notes} onChangeText={setNotes} multiline editable={!isReadOnly} />
            <CatalogValueSelect catalogType="assignment_status" label="Status" value={statusKey} onChange={setStatusKey} />
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
