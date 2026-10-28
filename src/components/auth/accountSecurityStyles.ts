import { StyleSheet } from 'react-native';
export const accountSecurityStyles = StyleSheet.create({
  stack: { gap: 16, minWidth: 0 }, card: { padding: 18, gap: 12, minWidth: 0, borderWidth: 1, borderColor: '#CBD8E6', backgroundColor: '#FFFFFF', borderRadius: 18 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: '#10283F' },
  text: { fontSize: 15, lineHeight: 23, color: '#304E69', flexShrink: 1 },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: '#10283F' },
  error: { color: '#A51E35', fontSize: 15, lineHeight: 23 },
  item: { gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E4EBF2' },
  preference: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, minWidth: 0 }, grow: { flex: 1 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#9BAFC4', borderRadius: 12, backgroundColor: '#FFFFFF', color: '#10283F', fontSize: 18 },
  qr: { padding: 8, alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#FFFFFF', maxWidth: '100%' },
  secret: { fontSize: 16, lineHeight: 25, color: '#10283F', flexShrink: 1 },
});
