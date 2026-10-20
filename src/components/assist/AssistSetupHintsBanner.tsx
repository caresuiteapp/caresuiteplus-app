import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { InfoBanner } from '@/components/ui';
import { buildAssistSetupHints } from '@/lib/assist/assistSetupHints';
import { careSpacing } from '@/design/tokens/spacing';

type AssistSetupHintsBannerProps = {
  maxVisible?: number;
};

/** Non-intrusive setup hints for schema/config gaps on Assist dashboard. */
export function AssistSetupHintsBanner({ maxVisible = 3 }: AssistSetupHintsBannerProps) {
  const router = useRouter();
  const hints = buildAssistSetupHints().slice(0, maxVisible);

  if (hints.length === 0) return null;

  return (
    <View style={styles.stack}>
      {hints.map((hint) => (
        <InfoBanner
          key={hint.id}
          title={hint.title}
          message={hint.message}
          variant={hint.severity === 'warning' ? 'warning' : 'info'}
          actionLabel={hint.route ? 'Mehr erfahren →' : undefined}
          onAction={hint.route ? () => router.push(hint.route as never) : undefined}
          style={styles.card}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: careSpacing.sm, marginBottom: careSpacing.sm },
  card: { minHeight: 96 },
});
