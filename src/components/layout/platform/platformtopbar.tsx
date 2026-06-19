import { ReactNode, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
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
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION, TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { glassFx, withAlpha } from '@/design/tokens/motion';
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
const TOPBAR_CONTROL_HEIGHT = 44;
/** Shared icon/avatar slot — building, bell, profile picture. */
const TOPBAR_ICON_SIZE = 28;
const TOPBAR_CHIP_PADDING_H = spacing.md;

const webNoOutline =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

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

  const styles = useMemo(() => createStyles(isDark, colors, accent), [isDark, colors, accent]);
  const displayName = profile?.displayName ?? 'CareSuite+';
  const initial = (displayName[0] ?? 'C').toUpperCase();
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

      <View style={styles.center} pointerEvents="box-none">
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
            <Text style={styles.chevron}>{tenantOpen ? '▴' : '▾'}</Text>
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
        <NotificationBellWithCenter size="topbar" />

        <View style={styles.profileWrap}>
          <Pressable
            onPress={() => {
              setProfileOpen((v) => !v);
              setTenantOpen(false);
            }}
            style={[styles.profileChip, webCursor]}
            accessibilityRole="button"
            accessibilityLabel="Profilmenü"
          >
            <View style={[styles.avatar, { backgroundColor: withAlpha(accent, 0.85) }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.chevron}>{profileOpen ? '▴' : '▾'}</Text>
          </Pressable>
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

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  accent: string,
) {
  const glassBorder = isDark ? glassFx.border : colors.borderSoft;

  const topbarControl: ViewStyle = {
    minHeight: TOPBAR_CONTROL_HEIGHT,
    maxHeight: TOPBAR_CONTROL_HEIGHT,
    height: TOPBAR_CONTROL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TOPBAR_CHIP_PADDING_H,
  };

  return StyleSheet.create({
    root: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: glassBorder,
      backgroundColor: isDark ? 'rgba(11,16,32,0.55)' : colors.bgPremium,
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
      zIndex: 1,
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
      flex: 1,
      maxWidth: 520,
      gap: spacing.sm,
      borderRadius: radius.capsule,
      borderWidth: 1,
      borderColor: isDark ? glassFx.innerBorder : colors.borderSoft,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    },
    searchIcon: { fontSize: 16, lineHeight: TOPBAR_ICON_SIZE, color: colors.textMuted },
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
      borderColor: isDark ? glassFx.innerBorder : colors.borderSoft,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
    },
    searchKbdText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
    tenantWrap: { position: 'relative' },
    tenantChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(accent, 0.45),
      backgroundColor: isDark ? withAlpha(accent, 0.12) : withAlpha(accent, 0.08),
      maxWidth: 260,
    },
    tenantIcon: { fontSize: 18 },
    tenantTextWrap: { flex: 1, minWidth: 0 },
    tenantLabel: {
      ...typography.caption,
      color: colors.textMuted,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    tenantName: { ...typography.bodyStrong, color: colors.textPrimary, fontWeight: '700' },
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
      backgroundColor: isDark ? 'rgba(18,22,43,0.95)' : '#FFFFFF',
      paddingVertical: spacing.xs,
      zIndex: 30,
      ...(Platform.OS === 'web'
        ? ({ boxShadow: '0 12px 40px rgba(0,0,0,0.35)' } as unknown as ViewStyle)
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
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    },
    iconBtnText: { fontSize: 18 },
    profileWrap: { position: 'relative' },
    profileBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: glassBorder,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      maxWidth: 200,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
    profileName: {
      ...typography.caption,
      color: colors.textPrimary,
      fontWeight: '700',
      flex: 1,
      minWidth: 0,
    },
  });
}
