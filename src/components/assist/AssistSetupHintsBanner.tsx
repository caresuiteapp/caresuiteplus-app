import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { InfoBanner } from '@/components/ui';
import { buildAssistSetupHints } from '@/lib/assist/assistSetupHints';
import { careSpacing } from '@/design/tokens/spacing';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { typography } from '@/theme';

type AssistSetupHintsBannerProps = {
  maxVisible?: number;
};

/** Non-intrusive setup hints for schema/config gaps on Assist dashboard. */
export function AssistSetupHintsBanner({ maxVisible = 3 }: AssistSetupHintsBannerProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const hints = buildAssistSetupHints().slice(0, maxVisible);

  if (hints.length === 0) return null;

  return (
    <View style={styles.stack}>
      {hints.map((hint) => (
        <View key={hint.id}>
          <InfoBanner
            title={hint.title}
            message={hint.message}
            variant={hint.severity === 'warning' ? 'warning' : 'info'}
          />
          {hint.route ? (
            <Pressable onPress={() => router.push(hint.route as never)} style={styles.linkWrap}>
              <Text style={[styles.link, { color: text.secondary }]}>Mehr erfahren →</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: careSpacing.sm, marginBottom: careSpacing.sm },
  linkWrap: { marginTop: -4, marginBottom: careSpacing.xs, paddingHorizontal: careSpacing.sm },
  link: { ...typography.caption },
});
