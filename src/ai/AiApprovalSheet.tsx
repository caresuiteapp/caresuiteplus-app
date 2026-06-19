import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PlatformModal } from '@/components/layout/platform';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import type { AiPendingActionSummary } from './aiToolTypes';
import { useAiStore } from './useAiStore';

type AiApprovalSheetProps = {
  pendingActions: AiPendingActionSummary[];
  tenantId: string;
};

export function AiApprovalSheet({ pendingActions, tenantId }: AiApprovalSheetProps) {
  const { removePendingAction } = useAiStore();
  const [busy, setBusy] = useState(false);
  const current = pendingActions[0] ?? null;

  const footerActions = useMemo(
    () => [
      {
        title: 'Ablehnen',
        variant: 'glass' as const,
        disabled: busy,
        onPress: () => {
          if (current) void reject(current.pending_action_id);
        },
      },
      {
        title: 'Prüfen & speichern',
        variant: 'primary' as const,
        loading: busy,
        disabled: busy,
        onPress: () => {
          if (current) void approve(current.pending_action_id);
        },
      },
    ],
    [busy, current],
  );

  if (!current) return null;

  async function approve(actionId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Fehler', 'Supabase ist nicht verfügbar.');
      return;
    }

    setBusy(true);
    try {
      const { error: approveError } = await fromUnknownTable(supabase, 'ai_pending_actions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', actionId)
        .eq('tenant_id', tenantId);

      if (approveError) {
        Alert.alert('Fehler', approveError.message);
        return;
      }

      const commit = await invokeEdgeFunction<{ result?: Record<string, unknown> }>(
        'ai-commit-approved-action',
        {
          tenant_id: tenantId,
          pending_action_id: actionId,
        },
      );

      if (!commit.ok) {
        Alert.alert('Fehler beim Speichern', commit.error);
        return;
      }

      removePendingAction(actionId);
      Alert.alert('Gespeichert', 'Die KI-Aktion wurde nach deiner Freigabe gespeichert.');
    } finally {
      setBusy(false);
    }
  }

  async function reject(actionId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      Alert.alert('Fehler', 'Supabase ist nicht verfügbar.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await fromUnknownTable(supabase, 'ai_pending_actions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', actionId)
        .eq('tenant_id', tenantId);

      if (error) {
        Alert.alert('Fehler', error.message);
        return;
      }

      removePendingAction(actionId);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformModal
      visible
      title={current.title}
      subtitle={
        current.risk_level
          ? `Risiko: ${String(current.risk_level).toUpperCase()}`
          : 'Freigabe erforderlich'
      }
      onClose={() => void reject(current.pending_action_id)}
      footerActions={footerActions}
      variant="bottomSheet"
      maxWidth={720}
      glowColor="rgba(255,255,255,0.35)"
    >
      {current.description ? (
        <Text style={styles.description}>{current.description}</Text>
      ) : null}

      <ScrollView style={styles.preview} contentContainerStyle={styles.previewContent}>
        <Text style={styles.previewText}>{current.preview_markdown}</Text>
      </ScrollView>

      {pendingActions.length > 1 ? (
        <View style={styles.queueHint}>
          <Text style={styles.queueHintText}>
            {pendingActions.length - 1} weitere Aktion(en) warten auf Freigabe.
          </Text>
        </View>
      ) : null}
    </PlatformModal>
  );
}

const styles = StyleSheet.create({
  description: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  preview: {
    maxHeight: 420,
  },
  previewContent: {
    paddingBottom: 8,
  },
  previewText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 22,
  },
  queueHint: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  queueHintText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
  },
});
