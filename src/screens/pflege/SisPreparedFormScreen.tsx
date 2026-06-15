import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { SisPreparedFormHero } from '@/components/pflege/SisPreparedFormHero';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchSisAssessmentDetail } from '@/lib/pflege/sisListService';
import {
  isSisWriteReady,
  SIS_CREATE_PREPARED_MESSAGE,
  SIS_EDIT_PREPARED_MESSAGE,
} from '@/lib/pflege/pflegeModuleConfig';
import { spacing } from '@/theme';

type SisPreparedFormScreenProps = {
  mode: 'create' | 'edit';
};

export function SisPreparedFormScreen({ mode }: SisPreparedFormScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const roleKey = profile?.roleKey ?? 'nurse';
  const writeReady = isSisWriteReady();
  const preparedOnly = !writeReady;

  const query = useAsyncQuery(
    () => {
      if (mode !== 'edit' || !id || !tenantId) {
        return Promise.resolve({ ok: true as const, data: null });
      }
      return fetchSisAssessmentDetail(id, tenantId, profile?.roleKey);
    },
    [mode, id, tenantId, profile?.roleKey],
    { enabled: mode === 'edit' && !!id && !!tenantId },
  );

  const assessment = query.data;
  const [clientName, setClientName] = useState('');
  const [score, setScore] = useState('');
  const [assessor, setAssessor] = useState('');
  const [notes, setNotes] = useState('');

  if (mode === 'edit' && query.loading) {
    return (
      <ScreenShell title="SIS bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Assessment wird geladen…" />
      </ScreenShell>
    );
  }

  if (mode === 'edit' && (query.error || !assessment)) {
    return (
      <ScreenShell title="SIS bearbeiten" subtitle="Fehler">
        <ErrorState message={query.error ?? 'Assessment nicht gefunden.'} onRetry={query.refresh} />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  const title = mode === 'create' ? 'SIS anlegen' : 'SIS bearbeiten';
  const preparedMessage = mode === 'create' ? SIS_CREATE_PREPARED_MESSAGE : SIS_EDIT_PREPARED_MESSAGE;
  const displayClient = mode === 'edit' && assessment ? assessment.clientName : clientName;
  const displayScore = mode === 'edit' && assessment ? String(assessment.overallScore) : score;
  const displayAssessor = mode === 'edit' && assessment ? assessment.assessorName : assessor;

  return (
    <ScreenShell
      title={title}
      subtitle={`Formular-Vorschau · ${roleLabel ?? 'Demo'}${isReadOnly ? ' · Lesemodus' : ''}`}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <SisPreparedFormHero
          mode={mode}
          clientName={mode === 'edit' ? assessment?.clientName : undefined}
          roleKey={roleKey}
          isReadOnly={isReadOnly}
        />
        {preparedOnly ? (
          <InfoBanner variant="warning" title="Demo-funktional" message={preparedMessage} />
        ) : null}

        <SectionPanel title="Assessment" subtitle="Pflichtfelder (Vorschau)">
          <PremiumInput
            label="Klient:in"
            placeholder="Name der Bewohner:in"
            value={displayClient}
            onChangeText={setClientName}
            editable={!isReadOnly && writeReady}
            hint={preparedOnly ? 'Formular-Vorschau — Speichern deaktiviert.' : undefined}
          />
          <PremiumInput
            label="Gesamtscore"
            placeholder="0–100"
            value={displayScore}
            onChangeText={setScore}
            keyboardType="numeric"
            editable={!isReadOnly && writeReady}
          />
          <PremiumInput
            label="Assessor:in"
            placeholder="Pflegekraft / PDL"
            value={displayAssessor}
            onChangeText={setAssessor}
            editable={!isReadOnly && writeReady}
          />
          <PremiumInput
            label="Anmerkungen"
            placeholder="SIS-Baustein-Hinweise…"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            editable={!isReadOnly && writeReady}
          />
          <PremiumButton
            title={
              preparedOnly
                ? 'Demo-funktional'
                : isReadOnly
                  ? 'Lesemodus — Speichern gesperrt'
                  : 'Assessment speichern'
            }
            fullWidth
            disabled={preparedOnly || isReadOnly}
            onPress={() => undefined}
          />
          <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="sis-form" />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
});
