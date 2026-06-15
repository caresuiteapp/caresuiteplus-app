import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePlatformLayout } from '@/hooks/platform/usePlatformLayout';
import { colors, spacing, typography } from '@/theme';

type MasterDetailLayoutProps = {
  master: ReactNode;
  detail: ReactNode;
  detailPlaceholder?: ReactNode;
  showDetail?: boolean;
};

const styles = StyleSheet.create({
  phone: {
    flex: 1,
  },
  split: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bgBase,
  },
  master: {
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: colors.borderSoft,
    backgroundColor: colors.bgBase,
  },
  divider: {
    width: 0,
  },
  detail: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.bgBase,
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
    maxWidth: 360,
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
 * Split-pane layout for tablet and desktop. On phone, only the master pane is shown —
 * detail navigation remains stack-based via Expo Router.
 */
export function MasterDetailLayout({
  master,
  detail,
  detailPlaceholder,
  showDetail = true,
}: MasterDetailLayoutProps) {
  const { useMasterDetail, masterPaneWidth: paneWidth } = usePlatformLayout();
  const placeholder = detailPlaceholder ?? <DefaultDetailPlaceholder />;

  if (!useMasterDetail) {
    return <View style={styles.phone}>{master}</View>;
  }

  return (
    <View style={styles.split}>
      <View style={[styles.master, { width: paneWidth, maxWidth: paneWidth }]}>
        {master}
      </View>
      <View style={styles.divider} />
      <View style={styles.detail}>
        {showDetail ? detail : placeholder}
      </View>
    </View>
  );
}
