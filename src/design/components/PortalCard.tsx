import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteIcon } from '@/components/brand/CareSuiteIcon';
import type { AppStartIconKey } from '@/data/landing/appStartEntries';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { careSpacing } from '@/design/tokens/spacing';
import { noBreakTextProps } from '@/design/tokens/responsiveTypography';
import { GlassCard } from './GlassCard';

type PortalCardProps = {
  iconKey: AppStartIconKey;
  title: string;
  description: string;
  accentColor: string;
  onPress?: () => void;
};

/** Start-page entry card — glass surface, responsive title, no mid-word breaks. */
export function PortalCard({ iconKey, title, description, accentColor, onPress }: PortalCardProps) {
  const type = useAuthFlowTypography();

  return (
    <GlassCard onPress={onPress} accentColor={accentColor}>
      <View style={styles.inner}>
        <CareSuiteIcon
          iconKey={iconKey}
          accentColor={accentColor}
          size={52}
          variant="aurora"
        />
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
    alignItems: 'center',
    gap: careSpacing.sm,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  description: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'center',
  },
});
