import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from 'react-native';
import { careLightColors } from '@/design/tokens/lightTheme';
import { GradientModalHeader } from '@/components/layout/platform';
import { GlassSurface } from '@/components/ui/effects';
import { useAuroraGlassActive } from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careRadius } from '@/design/tokens/radius';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import type { DashboardTourStep } from '@/lib/onboarding/dashboardTourSteps';

const SPOTLIGHT_PADDING = 10;
const OVERLAY_COLOR = 'rgba(7, 18, 42, 0.72)';
const CARD_MAX_WIDTH = 360;

type GuidedTourOverlayProps = {
  visible: boolean;
  step: DashboardTourStep;
  stepIndex: number;
  totalSteps: number;
  targetLayout: LayoutRectangle | null;
  accentColor?: string;
  onNext: () => void;
  onSkip: () => void;
  onCta?: () => void;
};

export function GuidedTourOverlay({
  visible,
  step,
  stepIndex,
  totalSteps,
  targetLayout,
  accentColor = careLightColors.orange,
  onNext,
  onSkip,
  onCta,
}: GuidedTourOverlayProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isLight } = useLegacyTheme();
  const auroraActive = useAuroraGlassActive();
  const lightGlassCard = isLight && auroraActive;
  const [cardHeight, setCardHeight] = useState(220);
  const isLast = stepIndex >= totalSteps - 1;
  const showSpotlight = step.spotlight && targetLayout && targetLayout.width > 0;

  const hole = showSpotlight
    ? {
        x: Math.max(0, targetLayout.x - SPOTLIGHT_PADDING),
        y: Math.max(0, targetLayout.y - SPOTLIGHT_PADDING),
        width: targetLayout.width + SPOTLIGHT_PADDING * 2,
        height: targetLayout.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  const cardPlacement = (() => {
    if (step.placement === 'center') return 'center';
    if (step.placement === 'bottom') return 'bottom';
    if (!hole) return 'center';
    const belowY = hole.y + hole.height + careSpacing.md;
    if (belowY + cardHeight < screenHeight - careSpacing.lg) return 'below';
    return 'above';
  })();

  const cardStyle = (() => {
    if (cardPlacement === 'center') {
      return {
        top: (screenHeight - cardHeight) / 2,
        left: careSpacing.lg,
        right: careSpacing.lg,
      };
    }
    if (cardPlacement === 'bottom') {
      return {
        bottom: careSpacing.xl + 72,
        left: careSpacing.lg,
        right: careSpacing.lg,
      };
    }
    if (cardPlacement === 'below' && hole) {
      return {
        top: hole.y + hole.height + careSpacing.md,
        left: careSpacing.lg,
        right: careSpacing.lg,
      };
    }
    if (hole) {
      return {
        top: Math.max(careSpacing.lg, hole.y - cardHeight - careSpacing.md),
        left: careSpacing.lg,
        right: careSpacing.lg,
      };
    }
    return {
      top: screenHeight / 2 - cardHeight / 2,
      left: careSpacing.lg,
      right: careSpacing.lg,
    };
  })();

  useEffect(() => {
    if (!visible) setCardHeight(220);
  }, [visible, stepIndex]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View style={styles.root} accessibilityViewIsModal>
        {hole ? (
          <>
            <View style={[styles.overlay, { top: 0, left: 0, width: screenWidth, height: hole.y }]} />
            <View
              style={[
                styles.overlay,
                { top: hole.y, left: 0, width: hole.x, height: hole.height },
              ]}
            />
            <View
              style={[
                styles.overlay,
                {
                  top: hole.y,
                  left: hole.x + hole.width,
                  width: Math.max(0, screenWidth - hole.x - hole.width),
                  height: hole.height,
                },
              ]}
            />
            <View
              style={[
                styles.overlay,
                {
                  top: hole.y + hole.height,
                  left: 0,
                  width: screenWidth,
                  height: Math.max(0, screenHeight - hole.y - hole.height),
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.highlightRing,
                {
                  top: hole.y,
                  left: hole.x,
                  width: hole.width,
                  height: hole.height,
                  borderColor: accentColor,
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.overlay, StyleSheet.absoluteFillObject]} />
        )}

        <GlassSurface
          radius={careRadius.lg}
          elevated={lightGlassCard}
          style={{ ...(styles.card as import('react-native').ViewStyle), ...(lightGlassCard ? (styles.cardGlass as import('react-native').ViewStyle) : (styles.cardLegacy as import('react-native').ViewStyle)), ...cardStyle }}
        >
          <View onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>
            <GradientModalHeader title={step.title} onClose={onSkip} />
            <View style={styles.cardBody}>
              <Text style={styles.stepLabel}>
                Schritt {stepIndex + 1} von {totalSteps}
              </Text>
              <Text style={styles.body}>{step.body}</Text>

              <View style={styles.actions}>
                <Pressable
                  onPress={onSkip}
                  style={styles.skipBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Tour überspringen"
                >
                  <Text style={styles.skipText}>Überspringen</Text>
                </Pressable>

                <View style={styles.primaryActions}>
                  {step.ctaRoute && step.ctaLabel && onCta ? (
                    <Pressable
                      onPress={onCta}
                      style={[styles.secondaryBtn, { borderColor: accentColor }]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.secondaryText, { color: accentColor }]}>{step.ctaLabel}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={onNext}
                    style={[styles.nextBtn, { backgroundColor: accentColor }]}
                    accessibilityRole="button"
                    accessibilityLabel={isLast ? 'Tour abschließen' : 'Weiter'}
                  >
                    <Text style={styles.nextText}>{isLast ? 'Fertig' : 'Weiter'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </GlassSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  highlightRing: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: careRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  card: {
    position: 'absolute',
    maxWidth: CARD_MAX_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  cardGlass: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  cardLegacy: {
    backgroundColor: careLightColors.surface,
    borderRadius: careRadius.lg,
    borderWidth: 1,
    borderColor: careLightColors.borderStrong,
    shadowColor: careLightColors.navy,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardBody: {
    padding: careSpacing.lg,
  },
  stepLabel: {
    ...careTypography.caption,
    color: careLightColors.muted,
    marginBottom: careSpacing.xs,
    fontWeight: '600',
  },
  body: {
    ...careTypography.body,
    color: careLightColors.muted,
    marginBottom: careSpacing.md,
  },
  actions: {
    gap: careSpacing.sm,
  },
  skipBtn: {
    alignSelf: 'flex-start',
    paddingVertical: careSpacing.xs,
  },
  skipText: {
    ...careTypography.caption,
    color: careLightColors.muted,
    fontWeight: '600',
  },
  primaryActions: {
    flexDirection: 'row',
    gap: careSpacing.sm,
    flexWrap: 'wrap',
  },
  nextBtn: {
    borderRadius: careRadius.md,
    paddingHorizontal: careSpacing.lg,
    paddingVertical: careSpacing.sm + 2,
    minWidth: 100,
    alignItems: 'center',
  },
  nextText: {
    ...careTypography.bodyStrong,
    color: careLightColors.surface,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: careRadius.md,
    borderWidth: 1,
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm + 2,
    alignItems: 'center',
  },
  secondaryText: {
    ...careTypography.bodyStrong,
    fontWeight: '700',
  },
});
