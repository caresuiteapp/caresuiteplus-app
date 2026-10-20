import { StyleSheet, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { spacing, typography } from '@/theme';

type Props = {
  page: number;
  pageSize: number;
  pageSizeOptions: number[];
  filteredCount: number;
  hasMore: boolean;
  onPageSizeChange: (size: number) => void;
  onLoadMore: () => void;
};

export function TIPagination({
  page,
  pageSize,
  pageSizeOptions,
  filteredCount,
  hasMore,
  onPageSizeChange,
  onLoadMore,
}: Props) {
  const shown = Math.min(page * pageSize, filteredCount);

  return (
    <View style={styles.container}>
      <Text style={styles.meta}>
        {shown} von {filteredCount} · Seite {page}
      </Text>
      <View style={styles.row}>
        {pageSizeOptions.map((size) => (
          <PremiumButton
            key={size}
            title={String(size)}
            size="sm"
            variant={size === pageSize ? 'primary' : 'ghost'}
            onPress={() => onPageSizeChange(size)}
          />
        ))}
      </View>
      {hasMore ? (
        <PremiumButton title="Mehr laden" variant="secondary" onPress={onLoadMore} fullWidth />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm, marginTop: spacing.md },
  meta: { ...typography.caption, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
