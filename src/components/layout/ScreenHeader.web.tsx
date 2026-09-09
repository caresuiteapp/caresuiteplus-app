import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { BreadcrumbTrail as Trail } from '@/types/navigation/breadcrumbs';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { BreadcrumbTrail } from './BreadcrumbTrail';

type Props = { title: string; subtitle?: string; breadcrumbTrail?: Trail; showBack?: boolean;
  onBack?: () => void; rightSlot?: ReactNode; simplifyOnPhone?: boolean; compact?: boolean };
export function ScreenHeader({ title, subtitle, breadcrumbTrail, showBack = true, onBack, rightSlot,
  simplifyOnPhone = true, compact = false }: Props) {
  const router = useRouter();
  const { isPhone } = useDeviceClass();
  const [width, setWidth] = useState(0);
  const narrow = width > 0 ? width < 640 : isPhone;
  const back = () => onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/' as never);
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.header, compact && styles.compact]} dataSet={{ csWorkspaceComponent: 'screen-header', csWorkspaceTone: 'light' }}>
    {showBack ? <Pressable accessibilityRole="button" accessibilityLabel="Zurück" onPress={back} style={styles.back}><Text style={styles.backText}>← Zurück</Text></Pressable> : null}
    <View style={styles.copy}>
      {breadcrumbTrail && (!narrow || !simplifyOnPhone) ? <BreadcrumbTrail trail={breadcrumbTrail} /> : null}
      <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {rightSlot ? <View style={[styles.actions, narrow && styles.phoneActions]}>{rightSlot}</View> : null}
  </View>;
}
const styles = StyleSheet.create({
  header: { minWidth: 0, width: '100%', minHeight: 82, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 14, flexShrink: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#CCDBEA' },
  compact: { minHeight: 64, paddingVertical: 10 },
  copy: { flexGrow: 1, flexBasis: 220, minWidth: 0, gap: 4 },
  title: { color: '#102B49', fontSize: font(24), lineHeight: font(31), fontWeight: '800' },
  compactTitle: { fontSize: font(21), lineHeight: font(28) },
  subtitle: { color: '#526B82', fontSize: font(15), lineHeight: font(23) },
  actions: { minWidth: 0, maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  phoneActions: { flexBasis: '100%' },
  back: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#BED2E7', backgroundColor: '#F2F7FD' },
  backText: { color: '#075EB8', fontSize: font(15), lineHeight: font(22), fontWeight: '700' },
});
