import { StaticLightPaperBackground, type StaticLightPaperBackgroundProps } from './StaticLightPaperBackground';

export type OfficePremiumGlassBackgroundProps = StaticLightPaperBackgroundProps;

/** Legacy alias — delegates to the static light paper background. */
export function OfficePremiumGlassBackground(props: OfficePremiumGlassBackgroundProps) {
  return <StaticLightPaperBackground {...props} testID="office-premium-glass-background" />;
}
