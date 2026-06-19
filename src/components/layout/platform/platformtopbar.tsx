import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTenantDisplayName } from '@/hooks/useTenantDisplayName';
import { NotificationBellWithCenter } from '@/components/notifications/notificationcenter';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION, TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glass as glassTokens } from '@/design/tokens/glass';
import { radius, spacing, typography } from '@/theme';
import type { MainModuleKey } from '@/types/navigation/platform';

type PlatformTopbarProps = {
  mainModule: MainModuleKey;
  accentColor?: string;
};

const SEARCH_PLACEHOLDERS: Record<MainModuleKey, string> = {
  zentrale: 'Suchen in Zentrale …',
  office: 'Suchen in Office …',
  assist: 'Suchen in Assist …',
  pflege: 'Suchen in Pflege …',
  stationaer: 'Suchen in Stationär …',
  beratung: 'Suchen in Beratung …',
  akademie: 'Suchen in Akademie …',
  admin: 'Suchen in Admin …',
};

/** Shared topbar control box — search, tenant chip, bell, profile. */
const TOPBAR_CONTROL_HEIGHT = 48;
/** Shared icon/avatar slot — building, bell, profile picture. */
const TOPBAR_ICON_SIZE = 32;

const webNoOutline =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
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
      borderColor: '#E2E8F0',
      backgroundColor: '#FFFFFF',
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
  const { profile, signOut } = useAuth();
  const { can } = usePermissions();
  const tenantName = useTenantDisplayName();
  const { colors, isDark } = useLegacyTheme();
  const accent = accentColor ?? colors.violet;
  const [query, setQuery] = useState('');
  const [tenantOpen, setTenantOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const styles = useMemo(() => createStyles(isDark, colors), [isDark, colors]);
  const displayName = profile?.displayName ?? 'CareSuite+';
  const avatarUrl = profile?.avatarUrl?.trim() || undefined;
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

  const profileMenuItems: { label: string; href?: string; action?: () => void }[] = [
    { label: 'Profil & Konto', href: '/settings' },
    { label: 'Benachrichtigungen', href: '/business/messages/settings' },
    { label: 'Abmelden', action: () => void signOut().then(() => router.replace('/' as never)) },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.start}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={SEARCH_PLACEHOLDERS[mainModule]}
            placeholderTextColor={isDark ? 'rgba(203,213,225,0.45)' : '#94A3B8'}
            style={[styles.searchInput, webNoOutline]}
          />
          <View style={styles.searchKbd}>
            <Text style={styles.searchKbdText}>⌘K</Text>
          </View>
        </View>
      </View>

      <View
        style={[styles.center, tenantOpen ? styles.centerElevated : null]}
        pointerEvents="box-none"
      >
        <View style={styles.tenantWrap}>
          <Pressable
            onPress={() => {
              setTenantOpen((v) => !v);
              setProfileOpen(false);
            }}
            style={[styles.tenantChip, webCursor]}
            accessibilityRole="button"
            accessibilityLabel={`Mandant: ${tenantName}`}
          >
            <View style={styles.iconSlot}>
              <Text style={styles.tenantIcon}>🏢</Text>
            </View>
            <View style={styles.tenantTextWrap}>
              <Text style={styles.tenantLabel}>Mandant</Text>
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

      <View style={styles.end}>
        <NotificationBellWithCenter size="topbar" variant="glass" />

        <View style={styles.profileWrap}>
          <View style={[styles.profileChip, webCursor]}>
            <TopbarProfileAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              accentColor={accent}
            />
            <Pressable
              onPress={() => {
                setProfileOpen((v) => !v);
                setTenantOpen(false);
              }}
              style={[styles.profileMenuTrigger, webCursor]}
              accessibilityRole="button"
              accessibilityLabel="Profilmenü"
            >
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.chevron}>{profileOpen ? '▴' : '▾'}</Text>
            </Pressable>
          </View>
          {profileOpen ? (
            <View style={[styles.dropdown, styles.profileDropdown]}>
              {profile?.email ? (
                <Text style={styles.dropdownMeta} numberOfLines={1}>
                  {profile.email}
                </Text>
              ) : null}
              {profileMenuItems.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    setProfileOpen(false);
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
    </View>
  );
}

function createStyles(isDark: boolean, colors: ReturnType<typeof useLegacyTheme>['colors']) {
  const glassBorder = isDark ? glassTokens.border : colors.borderSoft;
  const glass = glassSurface(isDark);

  const topbarControl: ViewStyle = {
    minHeight: TOPBAR_CONTROL_HEIGHT,
    maxHeight: TOPBAR_CONTROL_HEIGHT,
    height: TOPBAR_CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  };

  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: isDark ? 0 : 1,
      borderBottomColor: glassBorder,
      backgroundColor: isDark ? 'transparent' : colors.bgPremium,
      zIndex: 20,
    },
    start: {
      flex: 1,
      zIndex: 2,
    },
    center: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
      // Above start/end (zIndex 2) so the centered tenant chip receives clicks.
      zIndex: 3,
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
    searchWrap: {
      ...topbarControl,
      ...glass,
      flex: 1,
      maxWidth: 520,
      gap: spacing.sm,
      borderRadius: radius.capsule,
      backgroundColor: isDark ? glassTokens.input : '#FFFFFF',
    },
    searchIcon: {
      fontSize: 26,
      lineHeight: 28,
      color: colors.textMuted,
      alignSelf: 'center',
      marginTop: -1,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      paddingVertical: 0,
      height: TOPBAR_ICON_SIZE,
    },
    searchKbd: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: isDark ? glassTokens.innerBorder : colors.borderSoft,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    },
    searchKbdText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    tenantWrap: { position: 'relative', maxWidth: 520 },
    tenantChip: {
      ...topbarControl,
      ...glass,
      gap: spacing.sm,
      borderRadius: radius.capsule,
      paddingHorizontal: spacing.md,
    },
    iconSlot: {
      width: TOPBAR_ICON_SIZE,
      height: TOPBAR_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tenantIcon: { fontSize: 22, lineHeight: TOPBAR_ICON_SIZE },
    tenantTextWrap: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tenantLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
      textAlign: 'center',
    },
    tenantName: {
      ...typography.bodyStrong,
      color: isDark ? '#FFFFFF' : colors.textPrimary,
      fontWeight: '700',
      textAlign: 'center',
    },
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
      right: 0,
      marginTop: spacing.xs,
      minWidth: 240,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: isDark ? glassTokens.modal : '#FFFFFF',
      paddingVertical: spacing.xs,
      zIndex: 30,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.35)', ...webGlassBlur } as unknown as ViewStyle)
        : null),
    },
    profileDropdown: { right: 0 },
    dropdownItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dropdownText: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
    dropdownMeta: {
      ...typography.caption,
      color: colors.textMuted,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: glassBorder,
      marginBottom: spacing.xs,
    },
    profileWrap: { position: 'relative' },
    profileChip: {
      ...topbarControl,
      ...glass,
      gap: spacing.sm,
      borderRadius: radius.capsule,
      paddingHorizontal: spacing.sm,
      maxWidth: 220,
    },
    profileMenuTrigger: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    profileName: {
      ...typography.caption,
      color: isDark ? '#FFFFFF' : colors.textPrimary,
      fontWeight: '700',
      flex: 1,
      minWidth: 0,
    },
  });
}
