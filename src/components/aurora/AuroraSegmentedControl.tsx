import { Pressable, ScrollView, StyleSheet, Text, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuroraGlassChipStyles } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { careSuiteAuroraTheme } from '@/theme/careSuiteAurora';

export type SegmentOption = { key: string; label: string };

type Props = {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
};

export function AuroraSegmentedControl({ options, value, onChange, style }: Props) {
  const styles = useAuroraGlassChipStyles();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, style]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.tab, active && styles.tabActive, localStyles.tabClip]}
          >
            {active ? (
              <LinearGradient
                colors={[...careSuiteAuroraTheme.gradients.buttonPrimary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, localStyles.gradientFill]}
                pointerEvents="none"
              />
            ) : null}
            <Text style={[styles.label, active && styles.labelSelected, active && localStyles.activeLabel]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const localStyles = StyleSheet.create({
  activeLabel: { color: '#FFFFFF', fontWeight: '700' },
  tabClip: {
    overflow: 'hidden',
  },
  gradientFill: {
    borderRadius: careRadius.lg,
  },
});
