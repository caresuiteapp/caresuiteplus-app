import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { LockedActionBanner } from '@/components/permissions';
import { CareLightPageShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumCard } from '@/components/ui';
import { QmTypeLabel } from '@/components/qm';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchQmTemplates } from '@/lib/qm';
import type { QmTemplateSeed } from '@/lib/qm';
import { colors, spacing, typography } from '@/theme';

export function QmTemplatesScreen() {
  const { can, check, roleLabel } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [templates, setTemplates] = useState<QmTemplateSeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    const result = await fetchQmTemplates(tenantId, profile?.roleKey);
    if (result.ok) {
      setTemplates(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tenantId, profile?.roleKey]);

  if (!can('qm.view')) {
    return (
      <CareLightPageShell title="QM-Vorlagen" showBack>
        <LockedActionBanner message={check('qm.view').reason ?? ''} roleLabel={roleLabel} />
      </CareLightPageShell>
    );
  }

  if (loading && !templates.length) {
    return (
      <CareLightPageShell title="QM-Vorlagen" showBack>
        <LoadingState message="Vorlagen werden geladen…" />
      </CareLightPageShell>
    );
  }

  if (error && !templates.length) {
    return (
      <CareLightPageShell title="QM-Vorlagen" showBack>
        <ErrorState title="Vorlagen" message={error} onRetry={load} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title="QM-Vorlagen" subtitle={`${templates.length} Vorlagen (Paket F)`} showBack>
      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {templates.length === 0 ? (
          <EmptyState title="Keine Vorlagen" message="" />
        ) : (
          templates.map((tpl) => (
            <PremiumCard key={tpl.id} accentColor={colors.orange}>
              <Text style={styles.title}>{tpl.title}</Text>
              <QmTypeLabel type={tpl.documentType} />
              <Text style={styles.preview} numberOfLines={4}>{tpl.content}</Text>
            </PremiumCard>
          ))
        )}
      </ScrollView>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.bodyStrong, marginBottom: spacing.xs },
  preview: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
