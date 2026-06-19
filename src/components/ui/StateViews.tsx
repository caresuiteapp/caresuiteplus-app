import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { auroraGlass, useAuroraAdaptiveText, useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { careRadius } from '@/design/tokens/radius';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { spacing } from '@/theme';
import { PremiumButton } from './PremiumButton';

function useStateTextColors() {
  const auroraActive = useAuroraGlassActive();
  const adaptive = useAuroraAdaptiveText();
  const { colors } = useLegacyTheme();

  return useMemo(
    () => ({
      primary: auroraActive ? adaptive.primary : colors.textPrimary,
      secondary: auroraActive ? adaptive.secondary : colors.textSecondary,
    }),
    [adaptive.primary, adaptive.secondary, auroraActive, colors.textPrimary, colors.textSecondary],
  );
}

function useStateContainerStyle() {
  const auroraActive = useAuroraGlassActive();

  return useMemo(
    () =>
      auroraActive
        ? {
            backgroundColor: auroraGlass.panel,
            borderWidth: 1,
            borderColor: auroraGlass.border,
            borderRadius: careRadius.lg,
          }
        : { backgroundColor: 'transparent' as const },
    [auroraActive],
  );
}

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = 'Wird geladen…' }: LoadingStateProps) {
  const { colors, typography } = useLegacyTheme();
  const textColors = useStateTextColors();
  const containerSurface = useStateContainerStyle();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.sm,
          ...containerSurface,
        },
        message: {
          ...typography.body,
          textAlign: 'center',
          color: textColors.secondary,
        },
      }),
    [containerSurface, textColors.secondary, typography.body],
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { typography } = useLegacyTheme();
  const textColors = useStateTextColors();
  const containerSurface = useStateContainerStyle();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.sm,
          ...containerSurface,
        },
        title: {
          ...typography.h3,
          textAlign: 'center',
          color: textColors.primary,
        },
        message: {
          ...typography.body,
          textAlign: 'center',
          color: textColors.secondary,
        },
      }),
    [containerSurface, textColors.primary, textColors.secondary, typography.body, typography.h3],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <PremiumButton title={actionLabel} onPress={onAction} size="sm" />
      ) : null}
    </View>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = 'Fehler',
  message,
  onRetry,
}: ErrorStateProps) {
  const { colors, typography } = useLegacyTheme();
  const textColors = useStateTextColors();
  const containerSurface = useStateContainerStyle();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.sm,
          ...containerSurface,
        },
        title: {
          ...typography.h3,
          textAlign: 'center',
          color: colors.danger,
        },
        message: {
          ...typography.body,
          textAlign: 'center',
          color: textColors.secondary,
        },
      }),
    [colors.danger, containerSurface, textColors.secondary, typography.body, typography.h3],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <PremiumButton title="Erneut versuchen" onPress={onRetry} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
}

type SuccessStateProps = {
  title?: string;
  message: string;
};

export function SuccessState({
  title = 'Erfolgreich',
  message,
}: SuccessStateProps) {
  const { colors, typography } = useLegacyTheme();
  const textColors = useStateTextColors();
  const containerSurface = useStateContainerStyle();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.sm,
          ...containerSurface,
        },
        title: {
          ...typography.h3,
          textAlign: 'center',
          color: colors.success,
        },
        message: {
          ...typography.body,
          textAlign: 'center',
          color: textColors.secondary,
        },
      }),
    [colors.success, containerSurface, textColors.secondary, typography.body, typography.h3],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}
