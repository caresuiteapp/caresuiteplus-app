import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAdaptiveContentStyles } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
import { AuroraSegmentedControl } from '@/components/aurora';
import { PortalTabHero } from '@/components/portal/PortalTabHero';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumCard,
} from '@/components/ui';
import { usePortalSignatures } from '@/hooks/usePortalSignatures';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { usePlatformLayout } from '@/hooks/usePlatformLayout';
import { PORTAL_MOBILE_NAV_HEIGHT } from '@/lib/navigation/portalMobileTabs';
import type { PortalSignatureDocument, PortalSignatureFilterTab } from '@/types/portal/documentSignatures';
import {
  PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS,
  PORTAL_SIGNATURE_FILTER_TAB_LABELS,
  PORTAL_SIGNATURE_PRIORITY_LABELS,
  PORTAL_SIGNATURE_STATUS_LABELS,
} from '@/types/portal/documentSignatures';
import { colors, spacing } from '@/theme';

const FILTER_TABS: PortalSignatureFilterTab[] = ['open', 'due_today', 'overdue', 'completed'];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function priorityVariant(priority: PortalSignatureDocument['priority']) {
  if (priority === 'urgent') return 'red' as const;
  if (priority === 'high') return 'orange' as const;
  return 'muted' as const;
}

type PortalSignaturesTabProps = {
  detailBasePath?: string;
};

export function PortalSignaturesTab({ detailBasePath = '/portal/employee/signatures' }: PortalSignaturesTabProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PortalSignatureFilterTab>('open');
  const { items, loading, error, refreshing, refresh } = usePortalSignatures(activeTab);
  const content = useAdaptiveContentStyles();
  const insets = useSafeAreaInsets();
  const { isPhone } = useDeviceClass();
  const { showBottomTabs } = usePlatformLayout();
  const contentPadding = {
    paddingHorizontal: isPhone ? careSpacing.sm : 0,
    paddingBottom: showBottomTabs
      ? PORTAL_MOBILE_NAV_HEIGHT + Math.max(insets.bottom, careSpacing.sm)
      : spacing.xxl,
  };

  const styles = StyleSheet.create({
    scroll: { gap: spacing.md, width: '100%', maxWidth: '100%', alignSelf: 'stretch' },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    title: { ...content.title, flex: 1, minWidth: 0 },
    meta: { ...content.caption, marginTop: spacing.xs },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
    card: { width: '100%', alignSelf: 'stretch' },
    filterRow: { marginBottom: spacing.sm },
  });

  if (loading && items.length === 0) {
    return <LoadingState message="Unterschriften werden geladen…" />;
  }

  if (error && items.length === 0) {
    return (
      <ErrorState
        title="Unterschriften nicht verfügbar"
        message={error}
        onRetry={refresh}
      />
    );
  }

  const listBody = (
    <>
      <PortalTabHero
        tab="signatures"
        scope="portal_employee"
        totalCount={items.length}
        restrictedCount={items.filter((d) => d.priority === 'urgent').length}
      />

      <View style={styles.filterRow}>
        <AuroraSegmentedControl
          options={FILTER_TABS.map((tab) => ({
            key: tab,
            label: PORTAL_SIGNATURE_FILTER_TAB_LABELS[tab],
          }))}
          value={activeTab}
          onChange={(key) => setActiveTab(key as PortalSignatureFilterTab)}
        />
      </View>

      {items.length === 0 ? (
        <EmptyState
          title={`Keine ${PORTAL_SIGNATURE_FILTER_TAB_LABELS[activeTab].toLowerCase()}en Unterschriften`}
          message={
            activeTab === 'completed'
              ? 'Abgeschlossene Dokumente erscheinen hier in der Historie.'
              : 'Aktuell liegen keine Dokumente zur Unterschrift vor.'
          }
          actionLabel="Erneut laden"
          onAction={refresh}
        />
      ) : (
        items.map((doc) => (
          <PremiumCard
            key={doc.id}
            accentColor={colors.primary}
            style={styles.card}
            onPress={() => router.push(`${detailBasePath}/${doc.id}` as never)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{doc.title}</Text>
              <PremiumBadge
                label={PORTAL_SIGNATURE_STATUS_LABELS[doc.status]}
                variant={doc.status === 'completed' ? 'green' : 'cyan'}
              />
            </View>
            <Text style={styles.meta}>
              {PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[doc.documentType]}
              {doc.clientName ? ` · ${doc.clientName}` : ''}
            </Text>
            <Text style={styles.meta}>
              Erstellt: {formatDate(doc.createdAt)} · Fällig: {formatDate(doc.dueDate)}
            </Text>
            <Text style={styles.meta}>Von: {doc.creatorName}</Text>
            <View style={styles.badges}>
              <PremiumBadge
                label={PORTAL_SIGNATURE_PRIORITY_LABELS[doc.priority]}
                variant={priorityVariant(doc.priority)}
              />
              {doc.requiredBeforeAssignment ? (
                <PremiumBadge label="Pflicht vor Einsatz" variant="red" />
              ) : null}
            </View>
          </PremiumCard>
        ))
      )}
    </>
  );

  if (isPhone) {
    return <View style={[styles.scroll, contentPadding]}>{listBody}</View>;
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
      contentContainerStyle={[styles.scroll, contentPadding]}
    >
      {listBody}
    </ScrollView>
  );
}
