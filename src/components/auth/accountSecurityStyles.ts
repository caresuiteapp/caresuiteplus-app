import { usePortalPremiumTheme } from '@/design/tokens/portalPremium';
import { clientPortalNight as night } from '@/design/tokens/clientPortalNight';
import { StyleSheet } from 'react-native';
export const accountSecurityStyles = StyleSheet.create({
  stack: { gap: 16, minWidth: 0 }, card: { padding: 18, gap: 12, minWidth: 0, borderWidth: 1, borderColor: '#CBD8E6', backgroundColor: '#FFFFFF', borderRadius: 18 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: '#10283F' },
  text: { fontSize: 15, lineHeight: 23, color: '#304E69', flexShrink: 1 },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#10283F' },
  status: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: '#355B83' },
  error: { color: '#A51E35', fontSize: 15, lineHeight: 23 },
  item: { gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E4EBF2' },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, minWidth: 0 }, grow: { flex: 1 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#9BAFC4', borderRadius: 12, backgroundColor: '#FFFFFF', color: '#10283F', fontSize: 18 },
  qr: { padding: 8, alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFFFFF', maxWidth: '100%' },
  secret: { fontSize: 16, lineHeight: 25, color: '#10283F', flexShrink: 1 },
});

const clientStyles = StyleSheet.create({
  ...accountSecurityStyles,
  card: { ...accountSecurityStyles.card, backgroundColor: night.surface, borderColor: night.border },
  title: { ...accountSecurityStyles.title, color: night.text.primary },
  text: { ...accountSecurityStyles.text, color: night.text.secondary, fontSize: 16, lineHeight: 24 },
  label: { ...accountSecurityStyles.label, color: night.text.primary },
  error: { ...accountSecurityStyles.error, color: night.accent.danger },
  item: { ...accountSecurityStyles.item, borderColor: night.borderSoft },
  status: { ...accountSecurityStyles.status, color: night.accent.blue },
  input: { ...accountSecurityStyles.input, color: night.text.primary, backgroundColor: night.control, borderColor: night.borderStrong },
  secret: { ...accountSecurityStyles.secret, color: night.text.primary },
});
/** Keep the QR code's white scan surface; surrounding account cards follow the portal. */
export function useAccountSecurityStyles() {
  const portal = usePortalPremiumTheme();
  return portal.active && portal.kind === 'client' ? clientStyles : accountSecurityStyles;
}
