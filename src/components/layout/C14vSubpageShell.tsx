import { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { PremiumButton } from '@/components/ui';
import { usePermissions } from '@/hooks/usePermissions';
import { colors, spacing, typography } from '@/theme';

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
  /** Content already renders a complete portal detail hero. */
  contentOwnsHero?: boolean;
};

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
  contentOwnsHero = false,
}: C14vSubpageShellProps) {
  const { isReadOnly, roleLabel } = usePermissions();
  const pathname = usePathname();
  const isEmployeePortal = pathname.startsWith('/portal/employee');

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

  const content = <View style={styles.contentPanel}>{children}</View>;

  if (isEmployeePortal) {
    return (
      <PortalTabScreen
        title={title}
        subtitle={resolvedSubtitle}
        eyebrow={eyebrow}
        scroll={scroll}
        actionsSlot={actionBar}
        contentOwnsHero={contentOwnsHero}
      >
        {content}
      </PortalTabScreen>
    );
  }

  return (
    <ScreenShell
      title={title}
      subtitle={resolvedSubtitle}
      showBack={showBack}
      scroll={scroll}
      rightSlot={rightSlot}
      actionsSlot={actionBar}
    >
      {content}
    </ScreenShell>
  );
}
