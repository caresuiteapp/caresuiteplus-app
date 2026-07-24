import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CareSuiteLoadingIndicator } from '@/components/brand/CareSuiteLoadingIndicator';
import {
  useActiveGlassTokens,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useLightLiquidGlassShell,
  lightLiquidGlassWebFx,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careRadius } from '@/design/tokens/radius';
import { spacing } from '@/theme';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { sanitizeUiText } from '@/lib/ui/uiVisibility';
import { PremiumButton } from './PremiumButton';
import { CareLightButton } from './CareLightButton';
import { useWorkflowFeedback } from './GlobalWorkflowFeedback';

type StatePresentation = 'overlay' | 'inline';

function useStateTextColors() {
  const auroraActive = useAuroraGlassActive();
  const adaptive = useAuroraAdaptiveText();
  const { colors, isLight } = useLegacyTheme();

  return useMemo(
    () => ({
      primary: auroraActive ? adaptive.primary : colors.textPrimary,
      secondary: auroraActive && isLight ? adaptive.primary : auroraActive ? adaptive.secondary : isLight ? colors.textPrimary : colors.textSecondary,
    }),
    [adaptive.primary, adaptive.secondary, auroraActive, colors.textPrimary, colors.textSecondary, isLight],
  );
}

function useStateContainerStyle() {
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const glass = useActiveGlassTokens();

  return useMemo(
    () =>
      auroraActive
        ? {
            backgroundColor: glass.panel,
            borderWidth: 1,
            borderColor: isLight && 'borderAccent' in glass ? glass.borderAccent : glass.border,
            borderRadius: careRadius.lg,
            ...(isLight ? lightLiquidGlassWebFx() : {}),
          }
        : { backgroundColor: 'transparent' as const },
    [auroraActive, glass, isLight],
  );
}

type LoadingStateProps = {
  message?: string;
  presentation?: StatePresentation;
};

export function LoadingState({ message, presentation = 'overlay' }: LoadingStateProps) {
  const feedback = useWorkflowFeedback();
  const { typography } = useLegacyTheme();
  const textColors = useStateTextColors();
  const { isPhone } = useDeviceClass();
  const loaderWidth = isPhone ? 280 : 420;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
          gap: spacing.md,
          backgroundColor: 'transparent',
        },
        loader: {
          width: loaderWidth,
          backgroundColor: 'transparent',
        },
        message: {
          ...typography.body,
          textAlign: 'center',
          color: textColors.secondary,
          maxWidth: loaderWidth + 80,
        },
      }),
    [loaderWidth, textColors.secondary, typography.body],
  );

  useEffect(() => {
    if (presentation !== 'overlay') return;
    const id = feedback.showLoading(message);
    return () => feedback.dismiss(id);
  }, [feedback, message, presentation]);

  if (presentation === 'overlay') return null;

  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <View style={styles.loader}>
        <CareSuiteLoadingIndicator width={loaderWidth} />
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { typography, isLight } = useLegacyTheme();
  const textColors = useStateTextColors();
  const containerSurface = useStateContainerStyle();
  const useLightGlass = useLightLiquidGlassShell();
  const useLightUi = useLightGlass || isLight;
  const displayTitle = sanitizeUiText(title);
  const displayMessage = message ? sanitizeUiText(message) : undefined;
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
      <Text style={styles.title}>{displayTitle}</Text>
      {displayMessage ? <Text style={styles.message}>{displayMessage}</Text> : null}
      {actionLabel && onAction ? (
        useLightUi ? (
          <CareLightButton title={actionLabel} onPress={onAction} />
        ) : (
          <PremiumButton title={actionLabel} onPress={onAction} size="sm" />
        )
      ) : null}
    </View>
  );
}

type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  presentation?: StatePresentation;
};

export function ErrorState({
  title = 'Fehler',
  message,
  onRetry,
  presentation = 'overlay',
}: ErrorStateProps) {
  const feedback = useWorkflowFeedback();
  const onRetryRef = useRef(onRetry);
  onRetryRef.current = onRetry;
  const hasRetry = Boolean(onRetry);
  const { colors, typography } = useLegacyTheme();
  const textColors = useStateTextColors();
  const containerSurface = useStateContainerStyle();
  const useLightGlass = useLightLiquidGlassShell();
  const { isLight } = useLegacyTheme();
  const useLightUi = useLightGlass || isLight;
  const displayTitle = sanitizeUiText(title);
  const displayMessage = sanitizeUiText(message);
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

  useEffect(() => {
    if (presentation !== 'overlay') return;
    const id = feedback.showError(
      displayMessage,
      displayTitle,
      hasRetry ? () => onRetryRef.current?.() : undefined,
    );
    return () => feedback.dismiss(id);
  }, [displayMessage, displayTitle, feedback, hasRetry, presentation]);

  if (presentation === 'overlay') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      {onRetry ? (
        useLightUi ? (
          <CareLightButton title="Erneut versuchen" onPress={onRetry} variant="secondary" />
        ) : (
          <PremiumButton title="Erneut versuchen" onPress={onRetry} variant="secondary" size="sm" />
        )
      ) : null}
    </View>
  );
}

type SuccessStateProps = {
  title?: string;
  message: string;
  presentation?: StatePresentation;
};

export function SuccessState({
  title = 'Erfolgreich',
  message,
  presentation = 'overlay',
}: SuccessStateProps) {
  const feedback = useWorkflowFeedback();
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

  useEffect(() => {
    if (presentation !== 'overlay') return;
    const id = feedback.showSuccess(sanitizeUiText(message), sanitizeUiText(title));
    return () => feedback.dismiss(id);
  }, [feedback, message, presentation, title]);

  if (presentation === 'overlay') return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}
