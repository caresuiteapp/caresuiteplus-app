import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import { useAuth } from '@/lib/auth/context';
import { USER_PROFILE_ROUTE } from '@/lib/auth/userprofileroute';
import { APPEARANCE_SETTINGS_ROUTE } from '@/lib/screensaver/appearanceSettingsRoute';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { useAuroraAdaptiveText, useShellGlassSurfaceStyle } from '@/design/tokens/auroraGlass';
import { llgsTypography } from '@/design/tokens/lightLiquidGlassSpace';
import { radius, spacing, typography } from '@/theme';

type PlatformProfileMenuProps = {
  accentColor?: string;
  /** Full width of the parent column (e.g. right context panel). */
  fullWidth?: boolean;
};

const TOPBAR_CONTROL_HEIGHT = 48;
const TOPBAR_SEARCH_WIDTH = 260;
const TOPBAR_ICON_SIZE = 32;

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

/** Business / Verwaltung profile chip with dropdown — topbar or right panel. */
export function PlatformProfileMenu({ accentColor, fullWidth = false }: PlatformProfileMenuProps) {
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { colors, isDark } = useLegacyTheme();
  const text = useAuroraAdaptiveText();
  const chipGlass = useShellGlassSurfaceStyle('chip');
  const modalGlass = useShellGlassSurfaceStyle('modal');
  const accent = accentColor ?? colors.violet;
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = profile?.displayName ?? 'CareSuite+';
  const avatarUrl = profile?.avatarUrl?.trim() || undefined;

  const profileMenuItems: { label: string; href?: string; action?: () => void }[] = [
    { label: 'Profil & Konto', href: USER_PROFILE_ROUTE },
    { label: 'Darstellung & Oberfläche', href: APPEARANCE_SETTINGS_ROUTE },
    { label: 'Benachrichtigungen', href: '/business/messages/settings' },
    { label: 'Abmelden', action: () => void signOut().then(() => router.replace('/' as never)) },
  ];

  const styles = useMemo(
    () => createStyles(isDark, colors, text, fullWidth),
    [colors, fullWidth, isDark, text],
  );

  return (
    <View style={styles.profileWrap}>
      <View style={[styles.profileChip, chipGlass]}>
        <TopbarProfileAvatar
          name={displayName}
          avatarUrl={avatarUrl}
          accentColor={accent}
          style={styles.profileAvatarSlot}
        />
        <Pressable
          onPress={() => setProfileOpen((v) => !v)}
          style={[styles.profileMenuTrigger, webCursor]}
          accessibilityRole="button"
          accessibilityLabel="Profilmenü"
        >
          <Text style={styles.profileName} numberOfLines={1}>
            {displayName}
          </Text>
          <View style={styles.chevronSlot}>
            <Text style={styles.chevron}>{profileOpen ? '▴' : '▾'}</Text>
          </View>
        </Pressable>
      </View>
      {profileOpen ? (
        <View style={[styles.dropdown, modalGlass]}>
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
  );
}

function createStyles(
  isDark: boolean,
  colors: ReturnType<typeof useLegacyTheme>['colors'],
  text: ReturnType<typeof useAuroraAdaptiveText>,
  fullWidth: boolean,
) {
  const topbarPrimaryNameText: TextStyle = {
    ...typography.bodyStrong,
    color: isDark ? '#FFFFFF' : llgsTypography.primary,
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
    profileWrap: {
      position: 'relative',
      alignSelf: fullWidth ? 'stretch' : 'flex-end',
      width: fullWidth ? '100%' : undefined,
      zIndex: 12,
    },
    profileChip: {
      ...topbarControl,
      width: fullWidth ? '100%' : TOPBAR_SEARCH_WIDTH,
      maxWidth: fullWidth ? undefined : TOPBAR_SEARCH_WIDTH,
      gap: spacing.xs,
      borderRadius: radius.capsule,
      paddingLeft: spacing.xs,
      paddingRight: spacing.sm,
      justifyContent: 'flex-start',
    },
    profileAvatarSlot: {
      flexShrink: 0,
    },
    profileMenuTrigger: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
    },
    profileName: {
      ...topbarPrimaryNameText,
      flex: 1,
      minWidth: 0,
    },
    chevronSlot: {
      width: TOPBAR_ICON_SIZE,
      height: TOPBAR_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: { fontSize: 10, color: text.muted },
    dropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: spacing.xs,
      minWidth: fullWidth ? '100%' : TOPBAR_SEARCH_WIDTH,
      borderRadius: radius.lg,
      paddingVertical: spacing.xs,
      zIndex: 30,
    },
    dropdownItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dropdownText: {
      ...typography.body,
      color: text.primary,
      fontWeight: '600',
      textAlign: 'center',
      width: '100%',
    },
    dropdownMeta: {
      ...typography.caption,
      color: text.muted,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(120,160,255,0.18)',
      marginBottom: spacing.xs,
      textAlign: 'center',
      width: '100%',
    },
  });
}
