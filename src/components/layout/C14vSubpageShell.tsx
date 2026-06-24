import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { PremiumButton } from '@/components/ui';
import { auroraGlass, useAuroraGlassPanelStyle } from '@/design/tokens/auroraGlass';
import { useShellHostsAurora } from '@/hooks/useshellhostsaurora';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, radius, spacing, typography } from '@/theme';

type ActionItem = {
  key: string;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
};

type C14vSubpageShellProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  moduleLabel?: string;
  children: ReactNode;
  scroll?: boolean;
  showBack?: boolean;
  actions?: ActionItem[];
  rightSlot?: ReactNode;
  accentColor?: string;
};

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

/**
 * C14v unified subpage shell — enforces consistent header, action bar, and
 * glass panel structure across Office, Assist, Employee/Client portal pages.
 */
export function C14vSubpageShell({
  title,
  subtitle,
  eyebrow,
  moduleLabel,
  children,
  scroll = true,
  showBack = true,
  actions,
  rightSlot,
  accentColor,
}: C14vSubpageShellProps) {
  const { isReadOnly, roleLabel } = usePermissions();
  const shellHostsAurora = useShellHostsAurora();
  const panelStyle = useAuroraGlassPanelStyle();

  const resolvedSubtitle = subtitle ?? (moduleLabel
    ? `${moduleLabel}${isReadOnly ? ' · Lesemodus' : ''} · ${roleLabel ?? 'Demo'}`
    : undefined);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        actionBar: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.sm,
          paddingBottom: spacing.sm,
        },
        eyebrow: {
          ...typography.caption,
          color: accentColor ?? colors.cyan,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        },
        contentPanel: {
          flex: 1,
          minHeight: 0,
        },
        contentPanelAurora: {
          borderRadius: radius.lg,
          overflow: 'hidden',
          ...webGlassBlur,
        },
      }),
    [accentColor],
  );

  const actionBar = actions && actions.length > 0 ? (
    <View style={styles.actionBar}>
      {actions.map((action) => (
        <PremiumButton
          key={action.key}
          title={action.label}
          variant={action.variant ?? 'secondary'}
          size="sm"
          onPress={action.onPress}
        />
      ))}
    </View>
  ) : null;

  return (
    <ScreenShell
      title={title}
      subtitle={resolvedSubtitle}
      showBack={showBack}
      scroll={scroll}
      rightSlot={rightSlot}
    >
      {/* eyebrow labels removed per user request — prop kept for backward compat */}
      {actionBar}
      <View
        style={[
          styles.contentPanel,
          shellHostsAurora ? styles.contentPanelAurora : null,
          shellHostsAurora ? panelStyle : null,
        ]}
      >
        {children}
      </View>
    </ScreenShell>
  );
}
