import { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { AuroraSegmentedControl } from '@/components/aurora';
import { CsDocumentRequestCard } from '@/components/office/documentSignatures/CsDocumentRequestCard';
import { CsDocumentSendWizard } from '@/components/office/documentSignatures/CsDocumentSendWizard';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SectionPanel,
} from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  fetchCsDocumentRequests,
  fetchCsDocumentTemplates,
  sendCsDocumentRequest,
  type CsDocumentRequestTab,
} from '@/lib/documents/csTemplates';
import type { CsRecipientScope } from '@/types/documents/csTemplateDatabase';
import { typography } from '@/theme';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

const TAB_OPTIONS: { key: CsDocumentRequestTab; label: string }[] = [
  { key: 'open', label: 'Offen' },
  { key: 'in_progress', label: 'In Bearbeitung' },
  { key: 'completed', label: 'Erledigt' },
  { key: 'all', label: 'Alle' },
  { key: 'templates', label: 'Vorlagen' },
];

export function CsOfficeDocumentSignaturesScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { can, isReadOnly } = usePermissions();
  const text = useAuroraAdaptiveText();
  const officeAccent = moduleColor('office');

  const [tab, setTab] = useState<CsDocumentRequestTab>('open');
  const [sendVisible, setSendVisible] = useState(false);

  const canView = can('office.documents.view' as never);
  const canSend = can('documents.create' as never);

  const requestsQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId || tab === 'templates') return { ok: true as const, data: [] };
      return fetchCsDocumentRequests(tenantId, profile?.roleKey, tab);
    }, [tenantId, profile?.roleKey, tab]),
    [tenantId, profile?.roleKey, tab],
    { enabled: !!tenantId && tab !== 'templates' },
  );

  const templatesQuery = useAsyncQuery(
    useCallback(async () => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      return fetchCsDocumentTemplates(tenantId, profile?.roleKey);
    }, [tenantId, profile?.roleKey]),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { gap: spacing.sm },
        templateTitle: { ...typography.body, fontWeight: '600', color: text.primary },
        templateMeta: { ...typography.caption, color: text.muted, marginTop: spacing.xs },
      }),
    [text],
  );

  const handleSend = async (input: {
    templateKey: string;
    recipientScope: CsRecipientScope;
    employeeId?: string;
    clientId?: string;
    assignmentId?: string;
  }) => {
    if (!tenantId) return { ok: false, error: 'Kein Mandant.' };
    const result = await sendCsDocumentRequest(
      {
        tenantId,
        templateKey: input.templateKey,
        recipientScope: input.recipientScope,
        employeeId: input.employeeId ?? null,
        clientId: input.clientId ?? null,
        assignmentId: input.assignmentId ?? null,
        createdBy: profile?.id ?? null,
      },
      profile?.roleKey,
      { name: profile?.displayName, email: profile?.email },
    );
    if (result.ok) {
      await requestsQuery.refresh();
      setTab('open');
    }
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  };

  if (!canView) {
    return (
      <C14vSubpageShell title="Dokumente & Unterschriften" showBack accentColor={officeAccent}>
        <PremiumCard>
          <Text style={{ color: text.primary }}>Keine Berechtigung für Dokumente & Unterschriften.</Text>
        </PremiumCard>
      </C14vSubpageShell>
    );
  }

  const loading = tab === 'templates' ? templatesQuery.loading : requestsQuery.loading;
  const error = tab === 'templates' ? templatesQuery.error : requestsQuery.error;

  return (
    <>
      <C14vSubpageShell
        title="Dokumente & Unterschriften"
        eyebrow="OFFICE · VORLAGEN & PORTAL"
        subtitle={`Senden, unterschreiben lassen, archivieren${isReadOnly ? ' · Lesemodus' : ''}`}
        moduleLabel="Office"
        showBack={false}
        scroll
        accentColor={officeAccent}
        actions={[
          ...(canSend && !isReadOnly
            ? [{ key: 'send', label: 'Neues Dokument senden', onPress: () => setSendVisible(true), variant: 'primary' as const }]
            : []),
          {
            key: 'templates-admin',
            label: 'Vorlagen verwalten',
            onPress: () => router.push('/business/office/templates' as never),
            variant: 'secondary' as const,
          },
          {
            key: 'refresh',
            label: 'Aktualisieren',
            onPress: () => {
              void requestsQuery.refresh();
              void templatesQuery.refresh();
            },
            variant: 'ghost' as const,
          },
        ]}
      >
        <AuroraSegmentedControl options={TAB_OPTIONS} value={tab} onChange={(key) => setTab(key as CsDocumentRequestTab)} />

        {loading && !requestsQuery.data && !templatesQuery.data ? (
          <LoadingState message="Wird geladen…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => (tab === 'templates' ? templatesQuery.refresh() : requestsQuery.refresh())} />
        ) : tab === 'templates' ? (
          <SectionPanel title="Systemvorlagen" subtitle="Zentrale Vorlagen-Datenbank (cs_*)">
            {(templatesQuery.data ?? []).length === 0 ? (
              <EmptyState
                title="Keine Vorlagen"
                message="Migration 0226 ausführen oder Supabase-Verbindung prüfen."
              />
            ) : (
              <View style={styles.list}>
                {(templatesQuery.data ?? []).map((t) => (
                  <PremiumCard key={t.id}>
                    <Text style={styles.templateTitle}>{t.title}</Text>
                    <Text style={styles.templateMeta}>
                      {t.templateKey} · {t.categoryKey} · {t.recipientScope}
                    </Text>
                    {t.isRequiredBeforeService ? (
                      <PremiumBadge label="Pflicht vor Einsatz" variant="red" />
                    ) : null}
                  </PremiumCard>
                ))}
              </View>
            )}
          </SectionPanel>
        ) : (requestsQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="Keine Dokumentanforderungen"
            message="Senden Sie eine Vorlage an Mitarbeiterportal oder Klient:innenportal."
            actionLabel={canSend && !isReadOnly ? 'Neues Dokument senden' : undefined}
            onAction={canSend && !isReadOnly ? () => setSendVisible(true) : undefined}
          />
        ) : (
          <View style={styles.list}>
            {(requestsQuery.data ?? []).map((item) => (
              <CsDocumentRequestCard
                key={item.id}
                item={item}
                onOpen={() => router.push(`/business/office/documents/signatures/${item.id}` as never)}
              />
            ))}
          </View>
        )}
      </C14vSubpageShell>

      <Modal visible={sendVisible} animationType="slide" onRequestClose={() => setSendVisible(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <CsDocumentSendWizard
            tenantId={tenantId ?? ''}
            templates={templatesQuery.data ?? []}
            officeUserName={profile?.displayName}
            onSend={handleSend}
            onClose={() => setSendVisible(false)}
          />
        </ScrollView>
      </Modal>
    </>
  );
}
