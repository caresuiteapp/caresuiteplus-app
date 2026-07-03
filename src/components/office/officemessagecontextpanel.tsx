import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing, radius } from '@/theme';
import type {
  OfficeMessageCategory,
  OfficeMessagePriority,
  OfficeMessageThread as OfficeMessageThreadType,
  OfficeThreadStatus,
} from '@/types/office/messaging';
import { EmptyState } from '@/components/ui';
import {
  OFFICE_STATUS_ACTIONS,
  OFFICE_THREAD_STATUS_LABELS,
  PORTAL_THREAD_STATUS_LABELS,
} from '@/lib/office/messagestatuslabels';
import { exportOfficeMessageThread } from '@/lib/office/officemessageexportservice';
import { fetchOfficeMessageCategories } from '@/lib/office/messagethreadservice';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

const PRIORITY_OPTIONS: { key: OfficeMessagePriority; label: string }[] = [
  { key: 'low', label: 'Niedrig' },
  { key: 'normal', label: 'Normal' },
  { key: 'high', label: 'Hoch' },
  { key: 'urgent', label: 'Dringend' },
];

const THREAD_TYPE_LABELS: Record<OfficeMessageThreadType['threadType'], string> = {
  client_office: 'Klient:innen ↔ Office',
  employee_office: 'Mitarbeitende ↔ Office',
  internal: 'Intern (Büro)',
};

type OfficeMessageContextPanelProps = {
  thread: OfficeMessageThreadType | null;
  onThreadUpdated?: () => void;
  onUpdateStatus?: (status: OfficeThreadStatus) => Promise<{ ok: boolean; error?: string }>;
  onAssignSelf?: () => Promise<{ ok: boolean; error?: string }>;
  onUpdatePriority?: (priority: OfficeMessagePriority) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCategory?: (categoryId: string) => Promise<{ ok: boolean; error?: string }>;
  readOnly?: boolean;
  sheet?: boolean;
};

function ContextRow({ label, value }: { label: string; value: string }) {
  const { c } = useCareLightPalette();
  const { typography } = useLegacyTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { gap: 2 },
        label: { ...typography.caption, color: c.muted, textTransform: 'uppercase' },
        value: { ...typography.body, color: c.text, fontWeight: '600' },
      }),
    [c, typography],
  );
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function OfficeMessageContextPanel({
  thread,
  onThreadUpdated,
  onUpdateStatus,
  onAssignSelf,
  onUpdatePriority,
  onUpdateCategory,
  readOnly = false,
}: OfficeMessageContextPanelProps) {
  const { c } = useCareLightPalette();
  const { colors, typography } = useLegacyTheme();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [categories, setCategories] = useState<OfficeMessageCategory[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          minWidth: 0,
          borderLeftWidth: 1,
          borderLeftColor: c.border,
          padding: spacing.md,
          gap: spacing.md,
          backgroundColor: c.surface,
        },
        title: { ...typography.h3, color: c.text },
        section: {
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.bgPanel,
        },
        hint: { ...typography.caption, color: c.muted, lineHeight: 18 },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
        chip: {
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: radius.capsule,
          borderWidth: 1,
          borderColor: c.border,
        },
        chipActive: { backgroundColor: `${c.violet}22`, borderColor: c.violet },
        chipText: { ...typography.caption, color: c.muted },
        chipTextActive: { color: c.violet, fontWeight: '700' },
        error: { ...typography.caption, color: c.danger },
      }),
    [c, colors.bgPanel, typography],
  );

  useEffect(() => {
    if (!tenantId || !thread) {
      setCategories([]);
      return;
    }
    void fetchOfficeMessageCategories(tenantId, profile?.roleKey).then((result) => {
      if (result.ok) {
        const audience =
          thread.threadType === 'client_office'
            ? 'client'
            : thread.threadType === 'employee_office' || thread.threadType === 'employee_group_office'
              ? 'employee'
              : 'internal';
        setCategories(
          result.data.filter(
            (category) => category.audience === audience || category.audience === 'all',
          ),
        );
      }
    });
  }, [tenantId, thread, profile?.roleKey]);

  const handleExport = useCallback(async () => {
    if (!tenantId || !thread) return;
    setBusy(true);
    setActionError(null);
    const result = await exportOfficeMessageThread(
      tenantId,
      thread.id,
      profile?.roleKey,
      profile?.displayName,
    );
    setBusy(false);
    if (!result.ok) {
      setActionError(result.error ?? 'Export fehlgeschlagen.');
    }
  }, [tenantId, thread, profile?.roleKey, profile?.displayName]);

  const runAction = useCallback(
    async (action: () => Promise<{ ok: boolean; error?: string }>) => {
      setBusy(true);
      setActionError(null);
      const result = await action();
      setBusy(false);
      if (!result.ok) {
        setActionError(result.error ?? 'Aktion fehlgeschlagen.');
        return;
      }
      onThreadUpdated?.();
    },
    [onThreadUpdated],
  );

  if (!thread) {
    return (
      <View style={styles.root}>
        <EmptyState title="Kontext" message="Details zum ausgewählten Chat erscheinen hier." />
      </View>
    );
  }

  const participant =
    thread.clientName ?? thread.employeeName ?? (thread.threadType === 'internal' ? 'Büro-Team' : '—');
  const isClosed = ['resolved', 'closed', 'archived'].includes(thread.status);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Kontext</Text>
      <View style={styles.section}>
        <ContextRow label="Teilnehmer" value={participant} />
        <ContextRow label="Kanal" value={THREAD_TYPE_LABELS[thread.threadType]} />
        <ContextRow label="Kategorie" value={thread.categoryLabel ?? '—'} />
        <ContextRow label="Priorität" value={PRIORITY_OPTIONS.find((p) => p.key === thread.priority)?.label ?? thread.priority} />
        <ContextRow label="Status (Office)" value={OFFICE_THREAD_STATUS_LABELS[thread.status]} />
        <ContextRow label="Status (Portal)" value={PORTAL_THREAD_STATUS_LABELS[thread.status]} />
        {thread.assignedToUserName || thread.assignedToUserId ? (
          <ContextRow
            label="Zugewiesen"
            value={thread.assignedToUserName ?? thread.assignedToUserId ?? '—'}
          />
        ) : null}
      </View>

      {!readOnly && !isClosed ? (
        <>
          <View style={styles.section}>
            <Text style={styles.hint}>Status ändern</Text>
            <View style={styles.chips}>
              {OFFICE_STATUS_ACTIONS.map((action) => (
                <Pressable
                  key={action.key}
                  disabled={busy || thread.status === action.key}
                  onPress={() => {
                    if (!onUpdateStatus) return;
                    void runAction(async () => {
                      const result = await onUpdateStatus(action.key);
                      return { ok: result.ok, error: result.error };
                    });
                  }}
                  style={[styles.chip, thread.status === action.key && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      thread.status === action.key && styles.chipTextActive,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {onAssignSelf ? (
              <PremiumButton
                title="Übernehmen"
                onPress={() => void runAction(async () => {
                  const result = await onAssignSelf();
                  return { ok: result.ok, error: result.error };
                })}
                disabled={busy}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.hint}>Priorität</Text>
            <View style={styles.chips}>
              {PRIORITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.key}
                  disabled={busy || thread.priority === option.key}
                  onPress={() => {
                    if (!onUpdatePriority) return;
                    void runAction(async () => {
                      const result = await onUpdatePriority(option.key);
                      return { ok: result.ok, error: result.error };
                    });
                  }}
                  style={[styles.chip, thread.priority === option.key && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      thread.priority === option.key && styles.chipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {categories.length > 0 && onUpdateCategory ? (
            <View style={styles.section}>
              <Text style={styles.hint}>Kategorie ändern</Text>
              <View style={styles.chips}>
                {categories.map((category) => (
                  <Pressable
                    key={category.id}
                    disabled={busy || thread.categoryId === category.id}
                    onPress={() =>
                      void runAction(async () => {
                        const result = await onUpdateCategory(category.id);
                        return { ok: result.ok, error: result.error };
                      })
                    }
                    style={[styles.chip, thread.categoryId === category.id && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        thread.categoryId === category.id && styles.chipTextActive,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

      <PremiumButton
        title="Chat exportieren"
        variant="secondary"
        onPress={() => void handleExport()}
        disabled={busy || readOnly}
      />

      <Text style={styles.hint}>
        Nachrichten im Office-Modul — keine direkte Klient:innen↔Mitarbeitende-Kommunikation.
        Interne Notizen sind nur im Büro sichtbar.
      </Text>
      {thread.closedAt || thread.archivedAt ? (
        <View style={styles.section}>
          <ContextRow
            label="Abgeschlossen am"
            value={new Date(thread.closedAt ?? thread.archivedAt ?? '').toLocaleString('de-DE')}
          />
        </View>
      ) : null}
    </View>
  );
}
