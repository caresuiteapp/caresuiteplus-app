import { StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';

type CalendarHeaderProps = {
  title: string;
  subtitle?: string;
  accentColor?: string;
};

export function CalendarHeader({ title, subtitle, accentColor }: CalendarHeaderProps) {
  const text = useAuroraAdaptiveText();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: text.primary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: text.muted }]}>
          {accentColor ? '● ' : ''}
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: careSpacing.xs, marginBottom: careSpacing.sm },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13 },
});
