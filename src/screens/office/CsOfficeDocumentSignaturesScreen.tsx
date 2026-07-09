import { useCallback, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { AuroraSegmentedControl } from '@/components/aurora';
import { CsDocumentRequestCard } from '@/components/office/documentSignatures/CsDocumentRequestCard';
import { CsDocumentSendWizard } from '@/components/office/documentSignatures/CsDocumentSendWizard';
import { OfficeSignatureDocumentComposer } from '@/components/office/OfficeSignatureDocumentComposer';
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
import { useOfficeDocumentSignatures } from '@/hooks/useOfficeDocumentSignatures';
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
import {
  PORTAL_SIGNATURE_PRIORITY_LABELS,
  PORTAL_SIGNATURE_STATUS_LABELS,
  PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS,
} from '@/types/portal/documentSignatures';
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

type SendMode = 'template' | 'compose';

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
  const canCompose = can('office.documents.signatures.manage' as never);

  const [sendMode, setSendMode] = useState<SendMode>('template');
  const { items: portalSignatureDocs, compose, refresh: refreshPortalSignatures } =
    useOfficeDocumentSignatures();

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

  const openPortalDocs = useMemo(
    () =>
      portalSignatureDocs.filter((doc) =>
        ['new', 'open', 'in_progress', 'partially_signed'].includes(doc.status),
      ),
    [portalSignatureDocs],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { gap: spacing.sm },
        templateTitle: { ...typography.body, fontWeight: '600', color: text.primary },
        templateMeta: { ...typography.caption, color: text.muted, marginTop: spacing.xs },
        cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
        cardTitle: { ...typography.body, fontWeight: '700', flex: 1, color: text.primary },
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
              void refreshPortalSignatures();
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
        ) : (requestsQuery.data ?? []).length === 0 && openPortalDocs.length === 0 ? (
          <EmptyState
            title="Keine Dokumentanforderungen"
            message="Senden Sie eine Vorlage oder ein freies Dokument (Schreiben/PDF) an das Mitarbeiterportal."
            actionLabel={canSend && !isReadOnly ? 'Neues Dokument senden' : undefined}
            onAction={canSend && !isReadOnly ? () => setSendVisible(true) : undefined}
          />
        ) : (
          <View style={styles.list}>
            {openPortalDocs.length > 0 ? (
              <SectionPanel title="Freie Portal-Dokumente" subtitle="Schreiben, PDF oder Office-Vorlage">
                {openPortalDocs.map((doc) => (
                  <PremiumCard key={doc.id} accentColor={officeAccent}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{doc.title}</Text>
                      <PremiumBadge
                        label={PORTAL_SIGNATURE_STATUS_LABELS[doc.status]}
                        variant="cyan"
                      />
                    </View>
                    <Text style={styles.templateMeta}>
                      {PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[doc.documentType]}
                      {doc.documentSourceType === 'office_write' ? ' · Schreiben' : ''}
                      {doc.documentSourceType === 'pdf_upload' ? ' · PDF' : ''}
                      {' · '}
                      {doc.signatureFields.length} Signaturfeld(er)
                    </Text>
                    <Text style={styles.templateMeta}>
                      Priorität: {PORTAL_SIGNATURE_PRIORITY_LABELS[doc.priority]}
                    </Text>
                  </PremiumCard>
                ))}
              </SectionPanel>
            ) : null}
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
        <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC', padding: spacing.md }}>
          {canCompose ? (
            <>
              <Text style={{ ...typography.caption, color: '#94a3b8', marginBottom: spacing.sm }}>
                Sendemodus
              </Text>
              <AuroraSegmentedControl
                options={[
                  { key: 'template', label: 'Systemvorlage' },
                  { key: 'compose', label: 'Schreiben / PDF' },
                ]}
                value={sendMode}
                onChange={(key) => setSendMode(key as SendMode)}
              />
            </>
          ) : null}
          {sendMode === 'compose' && canCompose ? (
            <OfficeSignatureDocumentComposer
              accentColor={officeAccent}
              onCancel={() => setSendVisible(false)}
              onSubmit={async (input) => {
                const result = await compose(input);
                if (result.ok) {
                  setSendVisible(false);
                  setTab('open');
                  await refreshPortalSignatures();
                }
                return result.ok ? { ok: true } : { ok: false, error: result.error };
              }}
            />
          ) : (
            <CsDocumentSendWizard
              tenantId={tenantId ?? ''}
              templates={templatesQuery.data ?? []}
              officeUserName={profile?.displayName}
              onSend={handleSend}
              onClose={() => setSendVisible(false)}
            />
          )}
        </ScrollView>
      </Modal>
    </>
  );
}
