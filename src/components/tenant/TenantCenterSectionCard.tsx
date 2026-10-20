import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAuroraAdaptiveText, useAuroraGlassCardStyle } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { PremiumButton } from '@/components/ui';
import type { TenantCenterSectionMeta } from '@/types/tenant/tenantCenter';

type Props = {
  section: TenantCenterSectionMeta;
  onEdit: () => void;
};

const COMPLETENESS_LABEL = {
  complete: 'Vollständig',
  partial: 'In Arbeit',
  empty: 'Ausstehend',
} as const;

const COMPLETENESS_COLOR = {
  complete: '#34D399',
  partial: '#FBBF24',
  empty: '#64748B',
} as const;

export function TenantCenterSectionCard({ section, onEdit }: Props) {
  const text = useAuroraAdaptiveText();
  const cardGlass = useAuroraGlassCardStyle({ viewContext: 'settings' });
  const { width } = useWindowDimensions();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={[styles.card, cardGlass]}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[type.body, styles.title, { color: text.primary }]}>{section.title}</Text>
          <View style={[styles.badge, { borderColor: COMPLETENESS_COLOR[section.completeness] }]}>
            <Text style={[type.caption, { color: COMPLETENESS_COLOR[section.completeness] }]}>
              {COMPLETENESS_LABEL[section.completeness]}
            </Text>
          </View>
        </View>
        <Text style={[type.caption, styles.text, { color: text.muted }]}>{section.description}</Text>
        <Text style={[type.caption, styles.summary, styles.text, { color: text.secondary }]} numberOfLines={2}>
          {section.summary}
        </Text>
        {section.editable ? (
          <PremiumButton
            title={section.stub ? 'Ansehen' : 'Bearbeiten'}
            variant="secondary"
            size="sm"
            fullWidth
            onPress={onEdit}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 180,
    padding: careSpacing.md,
    borderRadius: careRadius.lg,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: careSpacing.sm,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    gap: careSpacing.xs,
    width: '100%',
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: 2,
  },
  text: {
    textAlign: 'center',
    width: '100%',
  },
  summary: {
    marginTop: careSpacing.xs,
    minHeight: 36,
  },
});
