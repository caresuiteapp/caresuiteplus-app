import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { SurfaceContrastProvider } from '@/design/tokens/surfaceContrast';
import { ClientPortalPageHero } from './client/ClientPortalPageHero';
import { clientPortalDesign as c } from './client/clientPortalDesign';

type Props = { title: string; subtitle?: string; eyebrow?: string; children: ReactNode; compact?: boolean;
  showHero?: boolean; scrollable?: boolean; actionsSlot?: ReactNode; filtersSlot?: ReactNode; tabsSlot?: ReactNode };
/** Same dark working surface for every client page and detail route. */
export function ClientPortalPageFrame({ title, subtitle, eyebrow, children, compact = false, showHero = true,
  scrollable = false, actionsSlot, filtersSlot, tabsSlot }: Props) {
  const { isPhone } = useDeviceClass();
  return <SurfaceContrastProvider tone="dark"><View testID="client-portal-page-frame"
    style={[styles.page, !scrollable && styles.fill, isPhone && styles.phone]}>
    {showHero ? <ClientPortalPageHero title={title} subtitle={subtitle} eyebrow={eyebrow} compact={compact} /> : null}
    <View testID="client-portal-page-surface" style={[styles.content, !scrollable && styles.fill]}>
      {actionsSlot ? <View style={styles.controls}>{actionsSlot}</View> : null}
      {filtersSlot ? <View style={styles.controls}>{filtersSlot}</View> : null}
      {tabsSlot ? <View style={styles.controls}>{tabsSlot}</View> : null}
      {children}
    </View>
  </View></SurfaceContrastProvider>;
}
const styles = StyleSheet.create({
  page: { width: '100%', minWidth: 0, minHeight: 0, maxWidth: 1680, alignSelf: 'center', gap: 20, padding: 24, backgroundColor: c.backdrop },
  phone: { padding: 14, gap: 15 }, content: { width: '100%', minWidth: 0, minHeight: 0, gap: 16 }, fill: { flex: 1 },
  controls: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
});
