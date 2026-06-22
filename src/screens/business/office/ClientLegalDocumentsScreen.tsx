import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAiPageContext } from '@/ai/useAiPageContext';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  PremiumButton,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientContracts } from '@/lib/clients/clientContractsService';
import { fetchClientConsents } from '@/lib/clients/clientConsentsService';
import { listClientDocuments } from '@/lib/clients/clientDocumentsService';
import {
  generateLegalDocumentFromTemplate,
  signLegalDocument,
  saveLegalDocumentToRecord,
  type LegalDocumentTemplateKey,
} from '@/lib/clients/legalDocumentWorkflowService';
import { spacing, typography } from '@/theme';

const TEMPLATES: { key: LegalDocumentTemplateKey; label: string }[] = [
  { key: 'datenschutz', label: 'Datenschutzeinwilligung' },
  { key: 'kundenvertrag', label: 'Kundenvertrag' },
  { key: 'leistungsvereinbarung', label: 'Leistungsvereinbarung' },
  { key: 'pflegevertrag', label: 'Pflegevertrag' },
  { key: 'einwilligung_foto', label: 'Foto-Einwilligung' },
];

type ClientLegalDocumentsScreenProps = {
  focus: 'contracts' | 'consents' | 'documents';
};

export function ClientLegalDocumentsScreen({ focus }: ClientLegalDocumentsScreenProps) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();
  const clientId = id ?? '';

  useAiPageContext({
    pageTitle: focus === 'documents' ? 'Dokumente' : focus === 'contracts' ? 'Verträge' : 'Einwilligungen',
    entityType: 'client',
    entityId: clientId || undefined,
    activeTab: focus,
    summary: `Klientendokumente (${focus})`,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<LegalDocumentTemplateKey>('kundenvertrag');
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);
  const [signedDocId, setSignedDocId] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const docsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return listClientDocuments(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId },
  );

  const contractsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientContracts(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId && focus === 'contracts' },
  );

  const consentsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientConsents(tenantId, clientId);
    },
    [tenantId, clientId],
    { enabled: !!tenantId && !!clientId && focus === 'consents' },
  );

  const title =
    focus === 'contracts' ? 'Verträge' : focus === 'consents' ? 'Einwilligungen' : 'Dokumente';

  async function handleGenerate() {
    if (!tenantId || !clientId || isReadOnly) return;
    setWorking(true);
    setActionError(null);
    setSavedOk(false);
    const result = await generateLegalDocumentFromTemplate(tenantId, clientId, selectedTemplate);
    setWorking(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setGeneratedDocId(result.data.id);
    setSignedDocId(null);
    await docsQuery.refresh();
  }

  async function handleSign() {
    if (!tenantId || !clientId || !generatedDocId || isReadOnly) return;
    setWorking(true);
    setActionError(null);
    const result = await signLegalDocument(
      tenantId,
      clientId,
      generatedDocId,
      profile?.displayName ?? 'Office Demo',
    );
    setWorking(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setSignedDocId(result.data.id);
    await docsQuery.refresh();
    if (focus === 'contracts') await contractsQuery.refresh();
    if (focus === 'consents') await consentsQuery.refresh();
  }

  async function handleSaveToRecord() {
    if (!tenantId || !clientId || !signedDocId || isReadOnly) return;
    setWorking(true);
    setActionError(null);
    const result = await saveLegalDocumentToRecord(tenantId, clientId, signedDocId);
    setWorking(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setSavedOk(true);
  }

  if (!clientId) {
    return (
      <ScreenShell title={title} subtitle="Fehler">
        <ErrorState message="Klient:in-ID fehlt." />
        <PremiumButton title="Zurück" variant="secondary" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  if (docsQuery.loading) {
    return (
      <ScreenShell title={title} subtitle="Wird geladen…">
        <LoadingState message="Akten-Dokumente werden geladen…" />
      </ScreenShell>
    );
  }

  const documents = docsQuery.data ?? [];

  return (
    <ScreenShell
      title={title}
      subtitle={`Rechtliche Dokumente · ${roleLabel ?? 'Demo'}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <InfoBanner
          variant="info"
          title="Vorlage → Generieren → Signieren → Akte"
          message="Demo-Workflow für Verträge, Einwilligungen und Dokumentenablage."
        />
        {actionError ? <InfoBanner variant="danger" title="Fehler" message={actionError} /> : null}
        {savedOk ? <SuccessState message="Dokument in Klient:innenakte gespeichert." /> : null}

        <SectionPanel title="Vorlage wählen">
          <View style={styles.templateRow}>
            {TEMPLATES.map((tpl) => (
              <PremiumButton
                key={tpl.key}
                title={tpl.label}
                variant={selectedTemplate === tpl.key ? 'primary' : 'secondary'}
                onPress={() => setSelectedTemplate(tpl.key)}
              />
            ))}
          </View>
          {!isReadOnly ? (
            <>
              <PremiumButton title={working ? 'Generieren…' : '1. Aus Vorlage generieren'} onPress={handleGenerate} disabled={working} />
              <PremiumButton
                title={working ? 'Signieren…' : '2. Digital signieren'}
                variant="secondary"
                onPress={handleSign}
                disabled={working || !generatedDocId}
              />
              <PremiumButton
                title="3. In Akte speichern"
                variant="secondary"
                onPress={handleSaveToRecord}
                disabled={working || !signedDocId}
              />
            </>
          ) : null}
        </SectionPanel>

        {focus === 'contracts' && contractsQuery.data ? (
          <SectionPanel title="Verträge in Akte">
            {contractsQuery.data.length === 0 ? (
              <EmptyState title="Keine Verträge" />
            ) : (
              contractsQuery.data.map((c) => (
                <Text key={c.id} style={styles.row}>
                  {c.contractNumber} · {c.status} · {c.signedAt ? 'signiert' : 'offen'}
                </Text>
              ))
            )}
          </SectionPanel>
        ) : null}

        {focus === 'consents' && consentsQuery.data ? (
          <SectionPanel title="Einwilligungen">
            {consentsQuery.data.length === 0 ? (
              <EmptyState title="Keine Einwilligungen" />
            ) : (
              consentsQuery.data.map((c) => (
                <Text key={c.id} style={styles.row}>
                  {c.title} · {c.granted ? 'erteilt' : 'offen'}
                </Text>
              ))
            )}
          </SectionPanel>
        ) : null}

        <SectionPanel title="Dokumente in Akte">
          {documents.length === 0 ? (
            <EmptyState title="Keine Dokumente" message="Generieren Sie ein Dokument aus einer Vorlage." />
          ) : (
            documents.slice(0, 12).map((doc) => (
              <Text key={doc.id} style={styles.row}>
                {doc.title} · {doc.status} · {doc.category}
              </Text>
            ))
          )}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  row: { ...typography.body, paddingVertical: spacing.xs },
});
