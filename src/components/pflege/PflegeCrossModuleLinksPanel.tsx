import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumButton, SectionPanel } from '@/components/ui';
import {
  buildPflegeCrossModuleLinks,
  type PflegeCrossModuleContext,
} from '@/lib/pflege/pflegeCrossModuleLinks';
import { colors, spacing, typography } from '@/theme';

type PflegeCrossModuleLinksPanelProps = {
  context: PflegeCrossModuleContext;
  title?: string;
};

export function PflegeCrossModuleLinksPanel({
  context,
  title = 'Verknüpfungen',
}: PflegeCrossModuleLinksPanelProps) {
  const router = useRouter();
  const links = buildPflegeCrossModuleLinks(context);

  return (
    <SectionPanel title={title} subtitle="Modulübergreifende Navigation">
      <View style={styles.list}>
        {links.map((link) => (
          <View key={link.id} style={styles.item}>
            <View style={styles.itemText}>
              <Text style={styles.itemLabel}>
                {link.icon} {link.label}
              </Text>
              <Text style={styles.itemDesc}>{link.description}</Text>
            </View>
            <PremiumButton
              title="Öffnen"
              size="sm"
              variant="secondary"
              onPress={() => router.push(link.href as never)}
            />
          </View>
        ))}
      </View>
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  itemText: { flex: 1, gap: 2 },
  itemLabel: { ...typography.bodyStrong },
  itemDesc: { ...typography.caption, color: colors.textMuted },
});
