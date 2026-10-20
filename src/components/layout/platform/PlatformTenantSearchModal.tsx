import { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { withAlpha } from '@/design/tokens/motion';
import { radius, spacing, typography } from '@/theme';
import {
  TENANT_SEARCH_ENTITY_LABELS,
  type TenantSearchHistoryEntry,
  type TenantSearchResultItem,
} from '@/lib/search/tenantSearchTypes';

export type PlatformTenantSearchModalMode = 'results' | 'history';

type PlatformTenantSearchModalProps = {
  visible: boolean;
  mode: PlatformTenantSearchModalMode;
  query?: string;
  results?: TenantSearchResultItem[];
  history?: TenantSearchHistoryEntry[];
  loading?: boolean;
  error?: string | null;
  accentColor?: string;
  onClose: () => void;
  onSelectResult: (item: TenantSearchResultItem) => void;
  onSelectHistoryEntry: (entry: TenantSearchHistoryEntry) => void;
};

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

function formatHistoryTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PlatformTenantSearchModal({
  visible,
  mode,
  query,
  results = [],
  history = [],
  loading = false,
  error = null,
  accentColor,
  onClose,
  onSelectResult,
  onSelectHistoryEntry,
}: PlatformTenantSearchModalProps) {
  const { colors } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const accent = accentColor ?? colors.violet;

  const title = mode === 'history' ? 'Suchverlauf' : 'Suchergebnisse';
  const subtitle =
    mode === 'results' && query?.trim()
      ? `${results.length} Treffer für „${query.trim()}“`
      : mode === 'history'
        ? `${history.length} gespeicherte Suchen`
        : undefined;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        emptyWrap: {
          paddingVertical: spacing.lg,
          alignItems: 'center',
          gap: spacing.xs,
        },
        emptyText: {
          ...typography.body,
          color: text.muted,
          textAlign: 'center',
        },
        errorText: {
          ...typography.body,
          color: colors.danger,
          textAlign: 'center',
          paddingVertical: spacing.sm,
        },
        list: {
          gap: spacing.xs,
        },
        row: {
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: withAlpha(accent, 0.18),
          backgroundColor: withAlpha(accent, 0.04),
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          gap: 2,
        },
        rowTitle: {
          ...typography.bodyStrong,
          color: text.primary,
        },
        rowMeta: {
          ...typography.caption,
          color: text.muted,
        },
        rowSubtitle: {
          ...typography.caption,
          color: text.secondary,
        },
        loadingWrap: {
          paddingVertical: spacing.lg,
          alignItems: 'center',
        },
      }),
    [accent, colors.danger, text.muted, text.primary, text.secondary],
  );

  return (
    <PlatformModal
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      glowColor={accent}
      maxWidth={640}
      minWidth={360}
      maxHeightRatio={0.82}
      lockBodyScroll
    >
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={accent} />
          <Text style={styles.emptyText}>Suche läuft …</Text>
        </View>
      ) : null}

      {!loading && error ? <Text style={styles.errorText}>{error}</Text> : null}

      {!loading && !error && mode === 'results' ? (
        results.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Keine Treffer in aktiven Modulen.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {results.map((item) => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                style={[styles.row, webCursor]}
                onPress={() => onSelectResult(item)}
                accessibilityRole="button"
              >
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {TENANT_SEARCH_ENTITY_LABELS[item.kind]} · {item.moduleLabel}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {!loading && mode === 'history' ? (
        history.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Noch keine Suchen gespeichert.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {history.map((entry) => (
              <Pressable
                key={`${entry.searchedAt}-${entry.query}`}
                style={[styles.row, webCursor]}
                onPress={() => onSelectHistoryEntry(entry)}
                accessibilityRole="button"
              >
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {entry.query}
                </Text>
                <Text style={styles.rowMeta}>{formatHistoryTimestamp(entry.searchedAt)}</Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}
    </PlatformModal>
  );
}
