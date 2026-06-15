import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import { useMessages } from '@/hooks/useMessages';
import { useAuth } from '@/lib/auth/context';
import { resolvePortalScope } from '@/lib/portal/portalVisibility';
import { VISIBILITY_LABELS } from '@/types/portal/visibility';
import { colors, spacing, typography } from '@/theme';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type PortalMessagesTabProps = {
  detailBasePath?: string;
};

export function PortalMessagesTab({ detailBasePath }: PortalMessagesTabProps = {}) {
  const router = useRouter();
  const { profile } = useAuth();
  const scope = resolvePortalScope(profile?.roleKey ?? null);
  const {
    items,
    unreadCount,
    loading,
    error,
    refreshing,
    showSuccess,
    refresh,
    isEmpty,
  } = useMessages();

  if (loading && items.length === 0) {
    return <LoadingState message="Nachrichten werden geladen…" />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        title="Nachrichten nicht verfügbar"
        message={error}
        onRetry={refresh}
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
      contentContainerStyle={styles.scroll}
    >
      <PortalTabHero
        tab="messages"
        scope={scope}
        totalCount={items.length}
        unreadCount={unreadCount}
      />

      {showSuccess ? <SuccessState message="Nachrichten aktualisiert." /> : null}

      {isEmpty ? (
        <EmptyState
          title="Keine Nachrichten"
          message="Ihr Posteingang ist leer. Neue Mitteilungen erscheinen hier."
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : (
        items.map((msg) => (
          <PremiumCard
            key={msg.id}
            accentColor={msg.readAt ? undefined : colors.orange}
            onPress={
              detailBasePath
                ? () => router.push(`${detailBasePath}/${msg.id}` as never)
                : undefined
            }
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.subject, !msg.readAt && styles.unreadSubject]}>
                {msg.subject}
              </Text>
              {!msg.readAt ? (
                <PremiumBadge label="Neu" variant="orange" />
              ) : null}
            </View>
            <Text style={styles.body} numberOfLines={3}>
              {msg.body}
            </Text>
            <View style={styles.footer}>
              <Text style={styles.meta}>
                Von {msg.senderName} · {formatDate(msg.updatedAt)}
              </Text>
              <PremiumBadge
                label={VISIBILITY_LABELS[msg.visibility]}
                variant="muted"
              />
            </View>
          </PremiumCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  subject: {
    ...typography.bodyStrong,
    flex: 1,
  },
  unreadSubject: {
    color: colors.orange,
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  meta: {
    ...typography.caption,
    flex: 1,
  },
});
