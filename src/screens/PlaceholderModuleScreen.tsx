import { PremiumBadge, PremiumCard, PremiumButton } from '@/components/ui';
import { ScreenShell } from '@/components/layout';
import { typography } from '@/theme';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

type PlaceholderModuleScreenProps = {
  title: string;
  subtitle: string;
  icon: string;
  wpLabel: string;
};

export function PlaceholderModuleScreen({
  title,
  subtitle,
  icon,
  wpLabel,
}: PlaceholderModuleScreenProps) {
  const router = useRouter();

  return (
    <ScreenShell title={title} subtitle={subtitle}>
      <PremiumCard accentColor="#FF9500">
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          Dieser Bereich ist als Route angelegt und durch Guards geschützt. Die fachlichen
          Screens folgen in den nächsten Arbeitspaketen.
        </Text>
        <PremiumBadge label={wpLabel} variant="cyan" />
      </PremiumCard>
      <PremiumButton
        title="Zurück zum Business-Bereich"
        variant="secondary"
        fullWidth
        onPress={() => router.replace('/business' as never)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 40, marginBottom: 8 },
  title: { ...typography.h2, marginBottom: 8 },
  body: { ...typography.body, marginBottom: 12 },
});
