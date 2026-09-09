import { type ReactNode, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

type Props = { master: ReactNode; detail: ReactNode; detailPlaceholder?: ReactNode; showDetail?: boolean };

/** Keep both mounted across resize so selections and unsaved forms survive a layout change. */
export function MasterDetailLayout({ master, detail, detailPlaceholder, showDetail = true }: Props) {
  const [width, setWidth] = useState(0);
  const hasDetail = showDetail && detail != null;
  const sideBySide = hasDetail && width >= 1040;
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.root, !sideBySide && styles.stacked]}
    dataSet={{ csWorkspaceComponent: 'master-detail', csWorkspaceSplit: String(sideBySide) }}>
    <View style={[styles.master, sideBySide && styles.masterSplit]}>{master}</View>
    <View style={[styles.detail, !hasDetail && styles.noDetail, !hasDetail && detailPlaceholder == null && styles.hidden, hasDetail && !sideBySide && styles.stackedDetail]}>
      {hasDetail ? detail : detailPlaceholder}
    </View>
  </View>;
}
const pane = { minWidth: 0, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' } as unknown as ViewStyle;
const styles = StyleSheet.create({
  root: { flex: 1, width: '100%', minWidth: 0, minHeight: 0, gap: 18, flexDirection: 'row', alignItems: 'stretch' },
  stacked: { flexDirection: 'column' },
  master: { ...pane, flex: 1 },
  masterSplit: { flexBasis: '42%', maxWidth: '48%', flexGrow: 0, flexShrink: 0 },
  detail: { ...pane, flex: 1, borderWidth: 1, borderColor: '#CCDBEA', borderRadius: 16, backgroundColor: '#FFFFFF' },
  stackedDetail: { flex: 1, minHeight: 0 },
  hidden: { display: 'none' },
  noDetail: { flex: undefined, flexGrow: 0, borderWidth: 0, backgroundColor: 'transparent' },
});
