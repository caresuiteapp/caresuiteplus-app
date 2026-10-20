import { StyleSheet, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { ReportsListView } from '@/components/reporting/ReportsListView';
import { usePermissions } from '@/hooks/usePermissions';
import { wp501A11y } from '@/lib/a11y/wp501-reporting';

export function ReportsListScreen({
  onReportPress,
  selectedId,
  embedded = false,
}: {
  onReportPress?: (id: string) => void;
  selectedId?: string | null;
  embedded?: boolean;
} = {}) {
  const { isReadOnly, roleLabel } = usePermissions();

  if (embedded) {
    return (
      <ReportsListView onReportPress={onReportPress} selectedId={selectedId} embedded />
    );
  }

  return (
    <ScreenShell
      title="Berichte"
      subtitle={`${isReadOnly ? 'Lesemodus · ' : ''}${roleLabel ?? 'Reporting'}`}
      scroll={false}
      showBack
      a11yMeta={wp501A11y}
    >
      <View style={styles.content}>
        <ReportsListView onReportPress={onReportPress} selectedId={selectedId} />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});
