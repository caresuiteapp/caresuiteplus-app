import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { PlatformModal } from '@/components/layout/platform';
import { PremiumInput } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useManagedSupabaseChannel } from '@/lib/realtime/useManagedSupabaseChannel';
import {
  approveDeferredSignatureRequest,
  fetchPendingDeferredSignatureApprovals,
  rejectDeferredSignatureRequest,
  type DeferredSignatureApprovalRequest,
} from '@/lib/assist/deferredSignatureApprovalService';
import { getServiceMode } from '@/lib/services/mode';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';

function displayDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function registerChannel(channel: RealtimeChannel, tenantId: string): RealtimeChannel {
  return channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'assist_visit_signature_requests',
      filter: `tenant_id=eq.${tenantId}`,
    },
    () => undefined,
  );
}

export function DeferredSignatureApprovalPopup() {
  const tenantId = useServiceTenantId();
  const { can, roleKey } = usePermissions();
  const enabled = Boolean(tenantId) && can('assist.execution.manage');
  const text = useAuroraAdaptiveText();
  const [requests, setRequests] = useState<DeferredSignatureApprovalRequest[]>([]);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !tenantId) return;
    const result = await fetchPendingDeferredSignatureApprovals(tenantId);
    if (!result.ok) {
      setError(result.error ?? 'Freigabeanfragen konnten nicht geladen werden.');
      return;
    }
    setRequests(result.data);
    setDismissedId((current) => current && result.data.some((item) => item.id === current) ? current : null);
  }, [enabled, tenantId]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const interval = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  useManagedSupabaseChannel(
    {
      channelName: tenantId ? `assist:signature-approvals:${tenantId}` : '',
      enabled: enabled && getServiceMode() === 'supabase',
      pollMs: 15_000,
      registerListeners: (channel) => registerChannel(channel, tenantId!),
    },
    () => void refresh(),
  );

  const current = requests.find((item) => item.id !== dismissedId) ?? null;
  const styles = useMemo(() => StyleSheet.create({
    body: { gap: careSpacing.md },
    notice: { ...careTypography.bodyStrong, color: text.primary },
    grid: { gap: careSpacing.sm },
    row: { gap: 2 },
    label: { ...careTypography.caption, color: text.secondary },
    value: { ...careTypography.bodyStrong, color: text.primary },
    documentation: {
      ...careTypography.body,
      color: text.primary,
      padding: careSpacing.sm,
      borderWidth: 1,
      borderColor: 'rgba(80,150,220,0.35)',
      borderRadius: 12,
    },
    error: { ...careTypography.bodyStrong, color: '#C7293D' },
  }), [text.primary, text.secondary]);

  const complete = async (action: 'approve' | 'reject') => {
    if (!current || loading) return;
    setLoading(true);
    setError(null);
    const result = action === 'approve'
      ? await approveDeferredSignatureRequest(current, roleKey)
      : await rejectDeferredSignatureRequest(current.id, reason);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? 'Entscheidung konnte nicht gespeichert werden.');
      return;
    }
    setReason('');
    setDismissedId(null);
    await refresh();
  };

  return (
    <PlatformModal
      visible={Boolean(current)}
      title="Freigabe: Unterschrift im Klientenportal"
      subtitle={requests.length > 1 ? `${requests.length} offene Freigaben` : 'Neue Mitarbeitenden-Anfrage'}
      onClose={() => setDismissedId(current?.id ?? null)}
      dismissOnBackdrop={false}
      maxWidth={680}
      glowColor={moduleColor('assist')}
      footerActions={[
        {
          title: 'Ablehnen',
          variant: 'danger',
          loading,
          disabled: loading || !reason.trim(),
          onPress: () => void complete('reject'),
        },
        {
          title: 'Genehmigen & ans Portal senden',
          variant: 'primary',
          loading,
          disabled: loading,
          onPress: () => void complete('approve'),
        },
      ]}
    >
      {current ? (
        <View style={styles.body} testID="deferred-signature-approval-popup">
          <Text style={styles.notice}>
            Ohne Ihre Genehmigung wird keine Unterschriftsanforderung an das Klient:innenportal gesendet.
          </Text>
          <View style={styles.grid}>
            <View style={styles.row}><Text style={styles.label}>Einsatz</Text><Text style={styles.value}>{current.serviceName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Klient:in</Text><Text style={styles.value}>{current.clientName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Mitarbeiter:in</Text><Text style={styles.value}>{current.employeeName}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Geplant</Text><Text style={styles.value}>{displayDateTime(current.plannedStartAt)} – {displayDateTime(current.plannedEndAt)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Tatsächlich</Text><Text style={styles.value}>{displayDateTime(current.actualStartAt)} – {displayDateTime(current.actualEndAt)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Beantragt</Text><Text style={styles.value}>{displayDateTime(current.requestedAt)}</Text></View>
          </View>
          <Text style={styles.label}>Dokumentationsvorschau</Text>
          <Text style={styles.documentation}>{current.documentation || 'Keine Vorschau verfügbar.'}</Text>
          <Text style={styles.label}>Begründung der mitarbeitenden Person</Text>
          <Text style={styles.documentation}>{current.requestReason}</Text>
          <PremiumInput
            label="Begründung bei Ablehnung (Pflichtfeld)"
            value={reason}
            onChangeText={setReason}
            multiline
            onLightSurface
            placeholder="Warum wird die Weiterleitung abgelehnt?"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}
    </PlatformModal>
  );
}
