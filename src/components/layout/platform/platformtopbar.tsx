import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION, TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { lightLiquidGlass, lightLiquidGlassWebFx } from '@/design/tokens/auroraGlass';
import { glass as glassTokens } from '@/design/tokens/glass';
import { withAlpha } from '@/design/tokens/motion';
import {
  PLATFORM_CONTEXT_PANEL_BREAKPOINT,
  PLATFORM_SHELL_HEADER_TOP_INSET,
  PLATFORM_TOPBAR_CONTROL_HEIGHT,
  PLATFORM_TOPBAR_PROFILE_ROW_TOP,
  resolveTopbarCenterZoneInsets,
  resolveTopbarEndZoneInsets,
} from '@/lib/platform/shellLayoutMetrics';
import { PlatformContextSearch } from '@/components/layout/platform/PlatformContextSearch';
import { PlatformProfileMenu } from '@/components/layout/platform/PlatformProfileMenu';
import { SpaceMandantIcon } from '@/components/icons/space';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';

type PlatformTopbarProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

/** Shared topbar control box — tenant chip, profile (compact). */
const TOPBAR_CONTROL_HEIGHT = PLATFORM_TOPBAR_CONTROL_HEIGHT;
/** Shared icon/avatar slot — building. */
const TOPBAR_ICON_SIZE = 32;

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${glassTokens.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${glassTokens.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

function glassSurface(isDark: boolean): ViewStyle {
  if (!isDark) {
    return {
      borderWidth: 1,
      borderColor: lightLiquidGlass.borderAccent,
      backgroundColor: lightLiquidGlass.chip,
      ...lightLiquidGlassWebFx(lightLiquidGlass.blur.light),
    };
  }
  return {
    borderWidth: 1,
    borderColor: glassTokens.border,
    backgroundColor: glassTokens.panel,
    ...webGlassBlur,
  };
}

export function PlatformTopbar({ mainModule, accentColor }: PlatformTopbarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { signOut } = useAuth();
  const { can } = usePermissions();
  const tenantName = useTenantDisplayName();
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const [tenantOpen, setTenantOpen] = useState(false);
  const showCompactTopbarControls = width < PLATFORM_CONTEXT_PANEL_BREAKPOINT;
  const alignTenantWithContextPanel = !showCompactTopbarControls;

  const centerZoneInsets = useMemo(
    () => resolveTopbarCenterZoneInsets(width, mainModule, spacing.lg),
    [mainModule, width],
  );
  const endZoneInsets = useMemo(
    () => resolveTopbarEndZoneInsets(width, mainModule, spacing.lg),
    [mainModule, width],
  );
  const styles = useMemo(() => createStyles(isDark, colors), [isDark, colors]);
  const canManageTenant = can(TENANT_SETTINGS_PERMISSION);

  const tenantMenuItems: { label: string; href?: string; action?: () => void }[] = [
    ...(canManageTenant
      ? [{ label: 'Mandant & Unternehmensdaten', href: TENANT_SETTINGS_ROUTE }]
      : []),
    { label: 'Module & Lizenzen', href: '/business/modules' },
    { label: 'Benutzer & Zugänge', href: '/business/office/access' },
    { label: 'Einstellungen', href: '/settings' },
    { label: 'Mandant wechseln', action: () => router.push('/auth/business-login' as never) },
    { label: 'Abmelden', action: () => void signOut().then(() => router.replace('/' as never)) },
  ];

  return (
    <View style={[styles.root, alignTenantWithContextPanel ? styles.rootWithContextPanelAlign : null]}>
      {showCompactTopbarControls ? (
        <View style={styles.start}>
          <PlatformContextSearch mainModule={mainModule} />
        </View>
      ) : (
        <View style={styles.start} />
      )}

      <View
        style={[
          styles.center,
          {
            left: centerZoneInsets.left,
            right: centerZoneInsets.right,
          },
          alignTenantWithContextPanel ? styles.centerAlignedWithContextPanel : null,
          tenantOpen ? styles.centerElevated : null,
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.tenantWrap}>
          <Pressable
            onPress={() => setTenantOpen((v) => !v)}
            style={[
              styles.tenantChip,
              {
                borderColor: tenantOpen ? withAlpha(accent, 0.95) : withAlpha(accent, 0.5),
              },
              webCursor,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Mandant: ${tenantName}`}
          >
            <View style={styles.iconSlot}>
              <SpaceMandantIcon accentColor={accent} size={TOPBAR_ICON_SIZE - 4} active={tenantOpen} />
            </View>
            <View style={styles.tenantTextWrap}>
              <Text style={[styles.tenantLabel, { color: withAlpha(accent, 0.85) }]}>Mandant</Text>
              <Text style={styles.tenantName} numberOfLines={1}>
                {tenantName}
              </Text>
            </View>
            <View style={styles.chevronSlot}>
              <Text style={styles.chevron}>{tenantOpen ? '▴' : '▾'}</Text>
            </View>
          </Pressable>
          {tenantOpen ? (
            <View style={styles.dropdown}>
              {tenantMenuItems.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    setTenantOpen(false);
                    if (item.action) item.action();
                    else if (item.href) router.push(item.href as never);
                  }}
                  style={[styles.dropdownItem, webCursor]}
                  accessibilityRole="button"
                >
                  <Text style={styles.dropdownText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.end, { marginRight: endZoneInsets.marginRight }]}>
        {showCompactTopbarControls ? <PlatformProfileMenu accentColor={accent} /> : null}
      </View>
    </View>
  );
}

function createStyles(isDark: boolean, colors: ReturnType<typeof useLegacyTheme>['colors']) {
  const glassBorder = isDark ? glassTokens.border : colors.borderSoft;
  const glass = glassSurface(isDark);

  const topbarPrimaryNameText: TextStyle = {
    ...typography.bodyStrong,
    color: isDark ? '#FFFFFF' : colors.textPrimary,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 0,
  };

  const topbarControl: ViewStyle = {
    minHeight: TOPBAR_CONTROL_HEIGHT,
    maxHeight: TOPBAR_CONTROL_HEIGHT,
    height: TOPBAR_CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  };

  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      paddingHorizontal: spacing.lg,
      paddingTop: PLATFORM_SHELL_HEADER_TOP_INSET,
      paddingBottom: PLATFORM_SHELL_HEADER_TOP_INSET,
      borderBottomWidth: isDark ? 0 : 0,
      borderBottomColor: glassBorder,
      backgroundColor: 'transparent',
      zIndex: 20,
    },
    rootWithContextPanelAlign: {
      paddingTop: 0,
      minHeight:
        PLATFORM_TOPBAR_PROFILE_ROW_TOP +
        TOPBAR_CONTROL_HEIGHT +
        PLATFORM_SHELL_HEADER_TOP_INSET,
    },
    start: {
      flex: 1,
      zIndex: 2,
    },
    center: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3,
    },
    centerAlignedWithContextPanel: {
      top: PLATFORM_TOPBAR_PROFILE_ROW_TOP,
      bottom: undefined,
      height: TOPBAR_CONTROL_HEIGHT,
      justifyContent: 'center',
    },
    centerElevated: {
      zIndex: 10,
    },
    end: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 0,
      zIndex: 2,
    },
    tenantWrap: { position: 'relative', maxWidth: 520, alignItems: 'center' },
    tenantChip: {
      ...topbarControl,
      ...glass,
      gap: spacing.sm,
      borderRadius: radius.capsule,
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconSlot: {
      width: TOPBAR_ICON_SIZE,
      height: TOPBAR_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tenantIcon: { fontSize: 22, lineHeight: TOPBAR_ICON_SIZE },
    tenantTextWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 0,
    },
    tenantLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
      textAlign: 'center',
      paddingVertical: 0,
    },
    tenantName: topbarPrimaryNameText,
    chevronSlot: {
      width: TOPBAR_ICON_SIZE,
      height: TOPBAR_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: { fontSize: 10, color: colors.textMuted },
    dropdown: {
      position: 'absolute',
      top: '100%',
      alignSelf: 'center',
      marginTop: spacing.xs,
      minWidth: 240,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: glassTokens.modal,
      paddingVertical: spacing.xs,
      zIndex: 30,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.35)', ...webGlassBlur } as unknown as ViewStyle)
        : null),
    },
    dropdownItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
    },
  });
}
