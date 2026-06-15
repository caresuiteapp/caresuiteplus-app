import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WoundDocumentation } from '@/types/modules/pflege';
import { PremiumBadge, PremiumCard } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

type WoundDocumentationListCardProps = {
  item: WoundDocumentation;
  clientName?: string;
  onPress?: () => void;
};

export function WoundDocumentationListCard({
  item,
  clientName,
  onPress,
}: WoundDocumentationListCardProps) {
  const variant =
    item.status === 'aktiv' ? 'green' : item.status === 'in_bearbeitung' ? 'orange' : 'muted';

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <PremiumCard style={styles.card} accentColor={colors.danger}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.bodyLocation}</Text>
          <PremiumBadge label={item.status} variant={variant} />
        </View>
        {clientName ? <Text style={styles.client}>{clientName}</Text> : null}
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.meta}>
          Dokumentiert: {new Date(item.documentedAt).toLocaleDateString('de-DE')}
        </Text>
      </PremiumCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  client: { ...typography.bodyStrong, marginBottom: 4 },
  description: { ...typography.body, marginBottom: 4 },
  meta: { ...typography.caption, color: colors.textMuted },
});
