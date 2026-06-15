import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useCallback, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { QmAiAssistantHero, QmAiDraftPanel } from '@/components/qm';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumButton } from '@/components/ui';
import { useQmAiAssistant } from '@/hooks/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { acceptQmAiDraft, createQmAiDraft, rejectQmAiDraft } from '@/lib/qm';
import type { QmAiDraftAction } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

const AI_ACTIONS: { action: QmAiDraftAction; label: string }[] = [
  { action: 'create_chapter', label: 'Kapitel erstellen' },
  { action: 'revise_document', label: 'Dokument überarbeiten' },
  { action: 'summarize', label: 'Zusammenfassen' },
  { action: 'checklist', label: 'Checkliste generieren' },
  { action: 'measure_plan', label: 'Maßnahmenplan' },
  { action: 'gap_analysis', label: 'Lückenanalyse' },
];

export function QmAiAssistantScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { data, loading, error, refresh } = useQmAiAssistant();
  const [busy, setBusy] = useState(false);

  const handleAction = useCallback(
    async (action: QmAiDraftAction) => {
      if (!tenantId) return;
      setBusy(true);
      await createQmAiDraft(
        tenantId,
        { action, promptSummary: AI_ACTIONS.find((a) => a.action === action)?.label ?? action },
        profile?.roleKey,
      );
      await refresh();
      setBusy(false);
    },
    [tenantId, profile, refresh],
  );

  const handleAccept = useCallback(
    async (draftId: string) => {
      if (!tenantId) return;
      setBusy(true);
      await acceptQmAiDraft(tenantId, draftId, profile?.roleKey);
      await refresh();
      setBusy(false);
    },
    [tenantId, profile, refresh],
  );

  const handleReject = useCallback(
    async (draftId: string) => {
      if (!tenantId) return;
      setBusy(true);
      await rejectQmAiDraft(tenantId, draftId, profile?.roleKey);
      await refresh();
      setBusy(false);
    },
    [tenantId, profile, refresh],
  );

  if (!can('qm.use_ai_assistant')) {
    return (
      <CareLightPageShell title="KI-Assistent" showBack>
        <LockedActionBanner message={check('qm.use_ai_assistant').reason ?? 'Keine Berechtigung.'} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !data) {
    return (
      <CareLightPageShell title="KI-Assistent" showBack>
        <LoadingState message="KI-Entwürfe werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !data) {
    return (
      <CareLightPageShell title="KI-Assistent" showBack>
        <ErrorState title="KI-Assistent" message={error} onRetry={refresh} />
      </CareLightPageShell>
    );
  }

  const drafts = data ?? [];
  const roleKey = profile?.roleKey ?? 'business_admin';

  return (
    <CareLightPageShell title="QM-KI-Assistent" subtitle="Strukturierte Vorschläge (P-READY)" showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        <QmAiAssistantHero
          draftCount={drafts.length}
          actionCount={AI_ACTIONS.length}
          roleKey={roleKey}
        />
        <Text style={styles.section}>Aktionen</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {AI_ACTIONS.map(({ action, label }) => (
            <PremiumButton
              key={action}
              title={label}
              size="sm"
              variant="ghost"
              onPress={() => handleAction(action)}
              loading={busy}
            />
          ))}
        </ScrollView>
        {drafts.length === 0 ? (
          <EmptyState title="Keine Entwürfe" message="Wählen Sie eine Aktion oben." />
        ) : (
          drafts.map((draft) => (
            <QmAiDraftPanel
              key={draft.id}
              draft={draft}
              onAccept={() => handleAccept(draft.id)}
              onReject={() => handleReject(draft.id)}
              loading={busy}
            />
          ))
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  section: { ...typography.bodyStrong },
  actions: { gap: spacing.sm, paddingVertical: spacing.sm },
});
