import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
} from '@/components/ui';
import { DataSubjectRequestsAdminHero } from './DataSubjectRequestsAdminHero';
import { useDataSubjectRequestsAdmin } from '@/hooks/useDataSubjectRequestsAdmin';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/lib/auth/context';
import {
  DATA_REQUEST_TYPE_LABELS,
  DATA_SUBJECT_REQUEST_STATUS_LABELS,
  statusBadgeVariant,
} from '@/lib/privacy/dataSubjectRequestLabels';
import {
  deadlineBadgeVariant,
  getDataSubjectRequestDeadlineInfo,
} from '@/lib/privacy/dataSubjectRequestSla';
import {
  DATA_SUBJECT_REQUEST_PREPARED_MESSAGE,
  isDataSubjectRequestBackendReady,
} from '@/lib/privacy/dataRequestConfig';
import { DSGVO_ADMIN_NOTIFY_PREPARED_MESSAGE } from '@/lib/privacy/dataSubjectRequestAdminNotify';
import type {
  DataSubjectRequest,
  DataSubjectRequestStatus,
} from '@/lib/privacy/dataSubjectRequest.types';
import { colors, spacing, typography } from '@/theme';

const ADMIN_STATUS_OPTIONS: { key: DataSubjectRequestStatus; label: string }[] = [
  { key: 'queued', label: 'Warteschlange' },
  { key: 'running', label: 'In Bearbeitung' },
  { key: 'completed', label: 'Abgeschlossen' },
  { key: 'failed', label: 'Fehlgeschlagen' },
  { key: 'cancelled', label: 'Abgebrochen' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type RequestRowProps = {
  item: DataSubjectRequest;
  canManage: boolean;
  updating: boolean;
  onStatusChange?: (status: DataSubjectRequestStatus) => void;
};

function RequestRow({ item, canManage, updating, onStatusChange }: RequestRowProps) {
  const deadline = getDataSubjectRequestDeadlineInfo(item);

  return (
    <PremiumCard accentColor={colors.warning}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTitle}>
          {item.requestNumber ?? item.id.slice(0, 8).toUpperCase()}
        </Text>
        <View style={styles.badgeRow}>
          <PremiumBadge
            label={deadline.label}
            variant={deadlineBadgeVariant(deadline.status)}
            dot
          />
          <PremiumBadge
            label={DATA_SUBJECT_REQUEST_STATUS_LABELS[item.status]}
            variant={statusBadgeVariant(item.status)}
            dot
          />
        </View>
      </View>
      <Text style={styles.rowType}>{DATA_REQUEST_TYPE_LABELS[item.requestType]}</Text>
      <Text style={styles.rowMeta}>
        {item.requesterName ?? 'Unbekannt'}
        {item.requesterEmail ? ` · ${item.requesterEmail}` : ''}
      </Text>
      <Text style={styles.rowDate}>Eingegangen: {formatDate(item.receivedAt ?? item.createdAt)}</Text>
      <Text style={styles.rowDate}>Frist (Art. 12): {formatDate(deadline.deadlineAt)}</Text>
      {item.verificationNotes ? (
        <Text style={styles.rowNotes}>{item.verificationNotes}</Text>
      ) : null}
      {canManage && onStatusChange ? (
        <View style={styles.statusPicker}>
          <Text style={styles.statusLabel}>Status ändern</Text>
          <FilterChipGroup
            options={ADMIN_STATUS_OPTIONS}
            value={item.status}
            onChange={(status) => {
              if (status !== item.status && !updating) onStatusChange(status);
            }}
          />
        </View>
      ) : null}
    </PremiumCard>
  );
}

export function DataSubjectRequestsAdminListView() {
  const { profile } = useAuth();
  const { can, roleLabel, check } = usePermissions();
  const canView = can('security.view');
  const canManage = can('security.manage');
  const roleKey = profile?.roleKey ?? 'business_admin';
  const liveReady = isDataSubjectRequestBackendReady();

  const {
    items,
    kpis,
    totalCount,
    loading,
    error,
    refreshing,
    refresh,
    isEmpty,
    updateStatus,
    updatingId,
    updateError,
    exportList,
    exporting,
    exportResult,
    exportLiveReady,
  } = useDataSubjectRequestsAdmin();

  if (!canView) {
    return (
      <LockedActionBanner
        message={check('security.view').reason ?? 'Keine Berechtigung.'}
        roleLabel={roleLabel}
      />
    );
  }

  if (loading && items.length === 0) {
    return <LoadingState message="Betroffenenanfragen werden geladen…" />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        title="Anfragen nicht verfügbar"
        message={error}
        onRetry={refresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      <DataSubjectRequestsAdminHero
        kpis={kpis}
        totalCount={totalCount}
        roleKey={roleKey}
        canManage={canManage}
        exportLiveReady={exportLiveReady}
        onExport={exportLiveReady ? () => void exportList() : undefined}
        exporting={exporting}
      />

      {!liveReady ? (
        <InfoBanner
          title="Live-Liste in Vorbereitung"
          message={DATA_SUBJECT_REQUEST_PREPARED_MESSAGE}
        />
      ) : null}

      {!exportLiveReady ? (
        <InfoBanner
          title="CSV-Export in Vorbereitung"
          message="Der CSV-Export der Anfragenliste wird mit der Live-Anbindung verfügbar — kein E-Mail-Versand."
        />
      ) : null}

      {liveReady ? (
        <InfoBanner
          title="Admin-E-Mail-Benachrichtigung"
          message={DSGVO_ADMIN_NOTIFY_PREPARED_MESSAGE}
        />
      ) : null}

      {exportResult ? (
        <InfoBanner
          title={exportLiveReady ? 'CSV-Export' : 'Export'}
          message={exportResult}
        />
      ) : null}

      {canManage && !liveReady ? (
        <InfoBanner
          title="Status-Update in Vorbereitung"
          message="Live-Statusänderungen folgen mit der nächsten Freigabe. Der Demo-Modus unterstützt Status-Updates."
        />
      ) : null}

      {updateError ? (
        <InfoBanner title="Status-Update fehlgeschlagen" message={updateError} />
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestRow
            item={item}
            canManage={canManage}
            updating={updatingId === item.id}
            onStatusChange={(status) => void updateStatus(item.id, status)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState
              title="Keine Betroffenenanfragen"
              message={
                canManage
                  ? 'Sobald Anfragen eingereicht werden, können Sie den Status hier bearbeiten.'
                  : 'Sobald Anfragen eingereicht werden, erscheinen sie hier — read-only für Mandanten-Admins.'
              }
              actionLabel="Aktualisieren"
              onAction={refresh}
            />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    maxWidth: '55%',
  },
  rowTitle: {
    ...typography.bodyStrong,
    flex: 1,
  },
  rowType: {
    ...typography.caption,
    color: colors.orange,
    marginBottom: 2,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rowDate: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  rowNotes: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  statusPicker: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  statusLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
