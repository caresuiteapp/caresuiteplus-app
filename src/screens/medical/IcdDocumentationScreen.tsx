import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { MedicalDocumentationDisclaimer } from '@/components/medical/MedicalDocumentationDisclaimer';
import { ErrorState, PremiumButton, PremiumInput, SuccessState } from '@/components/ui';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { documentDiagnosisAsPhysicianStatement, searchIcdCodes } from '@/lib/medical';
import { colors, spacing, typography } from '@/theme';

export function IcdDocumentationScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [query, setQuery] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<{ code: string; title: string }[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    if (!tenantId) return;
    setLoading(true);
    setSearchError(null);
    const result = await searchIcdCodes(tenantId, query, profile?.roleKey);
    setLoading(false);
    if (!result.ok) {
      setSearchError(result.error);
      setResults([]);
      return;
    }
    setResults(result.data.results.map((entry) => ({ code: entry.code, title: entry.title })));
  };

  const submitDocumentation = async () => {
    if (!tenantId) return;
    setLoading(true);
    setSubmitError(null);
    const result = await documentDiagnosisAsPhysicianStatement(
      tenantId,
      {
        clientId: 'client-001',
        icdCode: selectedCode,
        icdTitle: selectedTitle,
        physicianStatementText: statement,
        disclaimerAcknowledged,
      },
      profile?.roleKey,
    );
    setLoading(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setSuccessId(result.data.id);
  };

  return (
    <ScreenShell title="ICD-Dokumentation" subtitle="Ärztliche Angabe — keine Systemdiagnose">
      <ScrollView contentContainerStyle={styles.content}>
        <MedicalDocumentationDisclaimer showNoTherapyHint />

        <PremiumInput
          label="ICD suchen"
          value={query}
          onChangeText={setQuery}
          placeholder="z. B. J18 oder Pneumonie"
        />
        <PremiumButton title="Katalog durchsuchen" onPress={runSearch} disabled={loading || !query.trim()} />

        {searchError ? <ErrorState message={searchError} /> : null}

        {results.map((entry) => (
          <View key={entry.code} style={styles.resultRow}>
            <Text style={styles.code}>{entry.code}</Text>
            <Text style={styles.title}>{entry.title}</Text>
            <PremiumButton
              title="Auswählen"
              variant="secondary"
              onPress={() => {
                setSelectedCode(entry.code);
                setSelectedTitle(entry.title);
              }}
            />
          </View>
        ))}

        {selectedCode ? (
          <View style={styles.selected}>
            <Text style={styles.selectedLabel}>
              Ausgewählt: {selectedCode} — {selectedTitle}
            </Text>
            <PremiumInput
              label="Ärztliche Angabe (Freitext)"
              value={statement}
              onChangeText={setStatement}
              placeholder="Vom behandelnden Arzt mitgeteilte Diagnose…"
              multiline
            />
            <PremiumButton
              title={
                disclaimerAcknowledged
                  ? 'Hinweis bestätigt'
                  : 'Dokumentationshinweis bestätigen'
              }
              variant="secondary"
              onPress={() => setDisclaimerAcknowledged(true)}
            />
            <PremiumButton
              title="Als ärztliche Angabe speichern"
              onPress={submitDocumentation}
              disabled={loading || !disclaimerAcknowledged}
            />
          </View>
        ) : null}

        {submitError ? <ErrorState message={submitError} /> : null}
        {successId ? (
          <SuccessState message={`Diagnose dokumentiert (${successId}) — keine medizinische Entscheidung.`} />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  resultRow: {
    padding: spacing.sm,
    backgroundColor: colors.bgPanel,
    borderRadius: 8,
    gap: spacing.xs,
  },
  code: { ...typography.bodyStrong, color: colors.textPrimary },
  title: { ...typography.caption, color: colors.textMuted },
  selected: { gap: spacing.sm, marginTop: spacing.md },
  selectedLabel: { ...typography.body, color: colors.textPrimary },
});
