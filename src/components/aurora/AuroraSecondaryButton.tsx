import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAuroraGlassButtonStyles } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { buttonHeights, radius } from '@/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

export function AuroraSecondaryButton({
  label,
  onPress,
  variant = 'secondary',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
}: Props) {
  const { typography } = useLegacyTheme();
  const auroraStyles = useAuroraGlassButtonStyles();
  const isDisabled = disabled || loading;

  return (
    <Pressable disabled={isDisabled} onPress={onPress} style={[fullWidth && styles.fullWidth, style]}>
      <View
        style={[
          styles.inner,
          { height: buttonHeights.md },
          variant === 'secondary' ? auroraStyles.secondary : auroraStyles.ghost,
          fullWidth && styles.fullWidth,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={auroraStyles.secondaryText.color} />
        ) : (
          <Text style={[auroraStyles.label, auroraStyles.secondaryText, typography.button]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minWidth: 120,
    borderWidth: 1,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
});
