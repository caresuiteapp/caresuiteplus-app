import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useClientSignatureAttention } from './ClientSignatureAttentionProvider';
import { portalPremium } from '@/design/tokens/portalPremium';
export function ClientSignatureAttentionBanner() {
  const { items, error, refresh } = useClientSignatureAttention();
  const router = useRouter();
  if (!items.length && !error) return null;
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {items.length ? (
        <>
          <Text style={styles.title}>
            {items.length} {items.length === 1 ? 'Unterschrift offen' : 'Unterschriften offen'}
          </Text>
          <Text style={styles.text}>
            Bitte lesen und bestätigen Sie Ihre Leistungsnachweise und Dokumente.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push(
                (items.length === 1
                  ? items[0].route
                  : '/portal/client/documents/signatures') as never,
              )
            }
            style={styles.action}
          >
            <Text style={styles.actionText}>Jetzt prüfen und unterschreiben →</Text>
          </Pressable>
        </>
      ) : null}
      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void refresh()}
          style={{ minHeight: 48 }}
        >
          <Text style={styles.text}>
            Unterschriften konnten nicht vollständig geprüft werden. Erneut prüfen.
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7AD40',
    backgroundColor: '#FFF6DD',
  },
  title: { fontSize: 20, lineHeight: 27, fontWeight: '800', color: portalPremium.text.primary },
  text: { fontSize: 16, lineHeight: 24, color: portalPremium.text.secondary },
  action: { minHeight: 48, justifyContent: 'center' },
  actionText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '800',
    color: portalPremium.accent.blueDark,
  },
});
