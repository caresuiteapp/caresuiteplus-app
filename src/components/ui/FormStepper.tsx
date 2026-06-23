import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { auroraGlass, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { spacing } from '@/theme';

export type FormStepStatus = 'pending' | 'active' | 'completed' | 'error';

type FormStepperProps = {
  steps: string[];
  currentStep: number;
  onStepPress?: (index: number) => void;
  stepStatuses?: FormStepStatus[];
};

export function FormStepper({
  steps,
  currentStep,
  onStepPress,
  stepStatuses,
}: FormStepperProps) {
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
        stepPressable: {
          alignItems: 'center',
          gap: 4,
          width: '100%',
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
        dotError: {
          borderColor: colors.danger,
          backgroundColor: 'rgba(239,68,68,0.15)',
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
        labelError: {
          color: colors.danger,
          fontWeight: '700',
        },
      }),
    [auroraActive, colors, typography.caption],
  );

  function resolveStatus(index: number): FormStepStatus {
    if (stepStatuses?.[index]) return stepStatuses[index];
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'active';
    return 'pending';
  }

  return (
    <View style={styles.container} accessibilityRole="tablist">
      {steps.map((label, index) => {
        const status = resolveStatus(index);
        const done = status === 'completed';
        const active = status === 'active';
        const errored = status === 'error';
        const content = (
          <>
            <View
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
                errored && styles.dotError,
              ]}
            >
              <Text style={[styles.dotText, (done || active || errored) && styles.dotTextActive]}>
                {done ? '✓' : errored ? '!' : index + 1}
              </Text>
            </View>
            <Text
              style={[
                styles.label,
                active && styles.labelActive,
                errored && styles.labelError,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </>
        );

        if (onStepPress) {
          return (
            <View key={`${label}-${index}`} style={styles.step}>
              <Pressable
                style={styles.stepPressable}
                onPress={() => onStepPress(index)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Schritt ${index + 1}: ${label}`}
              >
                {content}
              </Pressable>
            </View>
          );
        }

        return (
          <View key={`${label}-${index}`} style={styles.step}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
