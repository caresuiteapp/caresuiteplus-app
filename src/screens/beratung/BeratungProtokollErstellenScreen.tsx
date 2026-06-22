import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TemplateDropdownSelect } from '@/components/templates';
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
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createCounselingProtocol } from '@/lib/beratung/moduleExtensionService';
import { getDemoCounselingCaseListItems } from '@/data/demo/counselingCases';
import { colors, spacing } from '@/theme';

/** Arbeitsplan 075 — /beratung/protokolle/new */
export function BeratungProtokollErstellenScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const cases = getDemoCounselingCaseListItems();
  const [caseId, setCaseId] = useState(cases[0]?.id ?? '');
  const [templateId, setTemplateId] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const selectedCase = cases.find((c) => c.id === caseId);

  async function handleSubmit() {
    if (!tenantId || isReadOnly) return;
    setLoading(true);
    setError(null);
    const result = await createCounselingProtocol(
      tenantId,
      {
        caseId,
        caseSubject: selectedCase?.subject ?? 'Beratungsfall',
        content: content.trim(),
        templateId: templateId || undefined,
      },
      profile?.roleKey,
    );
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCreatedId(result.data.id);
  }

  if (loading) {
    return (
      <ScreenShell title="Protokoll erstellen" subtitle="Speichern…">
        <LoadingState message="Protokoll wird gespeichert…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Protokoll erstellen" subtitle="Erstellt">
        <SuccessState message="Beratungsprotokoll wurde angelegt." />
        <PremiumButton
          title="Zur Übersicht"
          fullWidth
          onPress={() => router.replace('/beratung/protokolle' as never)}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Protokoll erstellen" subtitle={roleLabel ?? 'Beratung'}>
      <View style={styles.heroWrap}>
        <FormScreenHero
          eyebrow="BERATUNG · PROTOKOLL"
          title="Protokoll erstellen"
          meta="Vorlage, Empfehlungen und Maßnahmen"
          icon="📝"
          formMode="create"
          accentColor={colors.orange}
        />
      </View>
      <PremiumCard>
        {!content ? (
          <EmptyState title="Neues Protokoll" message="Fall wählen und Protokolltext erfassen." />
        ) : null}
        <View style={styles.field}>
          <FilterChipGroup
            options={cases.slice(0, 6).map((c) => ({ key: c.id, label: c.subject.slice(0, 28) }))}
            value={caseId}
            onChange={setCaseId}
          />
        </View>
        <TemplateDropdownSelect
          label="Vorlage"
          filters={{ moduleKey: 'beratung' }}
          value={templateId}
          onChange={(id, tplContent) => {
            setTemplateId(id);
            if (tplContent && !content) setContent(tplContent.slice(0, 2000));
          }}
        />
        <PremiumInput
          label="Protokolltext"
          value={content}
          onChangeText={setContent}
          multiline
          placeholder="Gesprächsinhalt, Empfehlungen, vereinbarte Maßnahmen…"
        />
        {error ? <ErrorState title="Eingabe" message={error} /> : null}
        <PremiumButton title="Speichern" fullWidth onPress={handleSubmit} disabled={isReadOnly} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </PremiumCard>
    </ScreenShell>
  );
}

void createCounselingProtocol;

const styles = StyleSheet.create({
  heroWrap: { marginBottom: spacing.md },
  field: { marginBottom: spacing.sm },
});
