import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography, noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { GlassCard } from './GlassCard';

type PortalCardProps = {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  onPress?: () => void;
};

/** Start-page entry card — glass surface, responsive title, no mid-word breaks. */
export function PortalCard({ icon, title, description, accentColor, onPress }: PortalCardProps) {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <GlassCard onPress={onPress} accentColor={accentColor}>
      <View style={styles.inner}>
        <CareSuiteIcon emoji={icon} accentColor={accentColor} size={44} />
        <Text
          style={[type.cardTitle, styles.title]}
          numberOfLines={2}
          {...noBreakTextProps}
        >
          {title}
        </Text>
        {description.trim() ? (
          <Text
            style={[type.caption, styles.description]}
            numberOfLines={3}
            {...noBreakTextProps}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  inner: {
    gap: careSpacing.xs,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  description: {
    flexShrink: 1,
    minWidth: 0,
  },
});
