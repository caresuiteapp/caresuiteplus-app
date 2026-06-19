import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { auroraGlass, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

type FormStepperProps = {
  steps: string[];
  currentStep: number;
};

export function FormStepper({ steps, currentStep }: FormStepperProps) {
  const { colors, typography } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing.xs,
          marginBottom: spacing.md,
        },
        step: {
          flex: 1,
          alignItems: 'center',
          gap: 4,
        },
        dot: {
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.borderSoft,
          backgroundColor: auroraActive ? auroraGlass.chip : colors.bgSurface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        dotActive: {
          borderColor: colors.orange,
          backgroundColor: auroraGlass.chipActive,
        },
        dotDone: {
          borderColor: colors.success,
          backgroundColor: 'rgba(34,197,94,0.2)',
        },
        dotText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.textMuted,
        },
        dotTextActive: {
          color: colors.textPrimary,
        },
        label: {
          ...typography.caption,
          fontSize: 10,
          textAlign: 'center',
          color: colors.textSecondary,
        },
        labelActive: {
          color: colors.orange,
          fontWeight: '700',
        },
      }),
    [auroraActive, colors, typography.caption],
  );

  return (
    <View style={styles.container}>
      {steps.map((label, index) => {
        const done = index < currentStep;
        const active = index === currentStep;
        return (
          <View key={label} style={styles.step}>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}
            >
              <Text style={[styles.dotText, (done || active) && styles.dotTextActive]}>
                {done ? '✓' : index + 1}
              </Text>
            </View>
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
