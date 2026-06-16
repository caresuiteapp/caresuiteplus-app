import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { colors, spacing, typography } from '@/theme';

export type ListDetailLayoutProps = {
  /** List pane — compact rows, filters, search. */
  list: ReactNode;
  /** Detail pane — shown when an item is selected. */
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
  /** Flex weight for the list pane when detail is visible (default 2). */
  listFlex?: number;
  /** Flex weight for the detail pane when detail is visible (default 3). */
  detailFlex?: number;
};

const styles = StyleSheet.create({
  phone: {
    flex: 1,
  },
  stack: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.bgBase,
    minHeight: 0,
  },
  listPane: {
    flexShrink: 0,
    minHeight: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.bgBase,
  },
  detailPane: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.bgBase,
  },
  detailScroll: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  placeholderTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 420,
  },
});

function DefaultDetailPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderTitle}>Auswahl treffen</Text>
      <Text style={styles.placeholderText}>
        Wählen Sie einen Eintrag in der Liste, um Details anzuzeigen.
      </Text>
    </View>
  );
}

/**
 * Vertical list-detail layout for tablet and desktop.
 * List occupies the top pane; detail expands below when an item is selected.
 * On phone, only the list is shown — detail navigation stays stack-based via Expo Router.
 */
export function ListDetailLayout({
  list,
  detail,
  detailPlaceholder,
  showDetail = true,
  listFlex = 2,
  detailFlex = 3,
}: ListDetailLayoutProps) {
  const { useMasterDetail } = usePlatformLayout();
  const placeholder = detailPlaceholder ?? <DefaultDetailPlaceholder />;

  if (!useMasterDetail) {
    return <View style={styles.phone}>{list}</View>;
  }

  const listWeight = showDetail ? listFlex : 1;
  const detailWeight = showDetail ? detailFlex : 1;

  return (
    <View style={styles.stack}>
      <View style={[styles.listPane, { flex: listWeight }]}>
        {list}
      </View>
      <View style={[styles.detailPane, { flex: detailWeight }]}>
        <ScrollView
          style={styles.detailScroll}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {showDetail ? detail : placeholder}
        </ScrollView>
      </View>
    </View>
  );
}
