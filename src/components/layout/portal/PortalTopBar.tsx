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
import { TopbarProfileAvatar } from '@/components/layout/TopbarProfileAvatar';
import {
  auroraGlass,
  lightLiquidGlass,
  lightLiquidGlassWebFx,
  surfaceContrastText,
  useAuroraAdaptiveText,
  useAuroraGlassActive,
  useShellGlassSurfaceStyle,
} from '@/design/tokens/auroraGlass';
import { useLegacyTheme } from '@/design/tokens/themeBridge';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalProfileAvatar } from '@/hooks/usePortalProfileAvatar';
import { usePortalContext } from '@/hooks/usePortalContext';
import { resolveCombinedModuleLabel } from '@/lib/portal/engine/portalTerminology';
import { MOBILE_EDGE_INSET, MOBILE_MIN_TOUCH_TARGET } from '@/lib/platform/webSafeArea';
import type { PortalShellKind } from '@/components/layout/portal/PortalShellLayout';

type PortalTopBarProps = {
  accentColor?: string;
  /** Compact mobile/tablet header — hamburger + brand row. */
  compact?: boolean;
  showHamburger?: boolean;
  onMenuPress?: () => void;
  portalLabel?: string;
  portalKind?: PortalShellKind;
};

const webNoOutline =
  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as unknown as ViewStyle) : null;

const webGlassBlur =
  Platform.OS === 'web'
    ? ({
        backdropFilter: `blur(${auroraGlass.blur.medium}px)`,
        WebkitBackdropFilter: `blur(${auroraGlass.blur.medium}px)`,
      } as unknown as ViewStyle)
    : null;

/** Client-facing portal top bar — no office/admin tenant menu. */
export function PortalTopBar({
  accentColor = '#FF9500',
  compact = false,
  showHamburger = false,
  onMenuPress,
  portalLabel = 'Klient:innenportal',
  portalKind = 'client',
}: PortalTopBarProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const auroraActive = useAuroraGlassActive();
  const { isLight } = useLegacyTheme();
  const useLightBar = auroraActive && isLight;
  const barSurface = useLightBar ? lightLiquidGlass.panel : auroraGlass.panel;
  const barBorder = useLightBar ? lightLiquidGlass.borderAccent : auroraGlass.border;
  const barGlassFx = useLightBar ? lightLiquidGlassWebFx(lightLiquidGlass.blur.light) : webGlassBlur;
  const menuInk = surfaceContrastText(!useLightBar);
  const dropdownGlass = useShellGlassSurfaceStyle('modal');
  const profileChipSurface = useLightBar
    ? { borderColor: lightLiquidGlass.borderAccent, backgroundColor: lightLiquidGlass.chip }
    : { borderColor: auroraGlass.border, backgroundColor: auroraGlass.chip };
  const { profile, signOut } = useAuth();
  const { displayName } = usePortalActor();
  const { avatarUrl, avatarVersion } = usePortalProfileAvatar();
  const { context } = usePortalContext();
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const moduleSubtitle = useMemo(() => {
    if (!context?.hasModuleAssignments) return 'Ihr persönlicher Portalbereich';
    return resolveCombinedModuleLabel(context.activeModuleKeys);
  }, [context]);

  const profilePath =
    portalKind === 'employee' ? '/portal/employee/profile' : '/portal/client/profile';

  const portalBasePath = portalKind === 'employee' ? '/portal/employee' : '/portal/client';

  const handleSearchSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`${portalBasePath}/documents` as never);
  };

  const profileMenuItems = compact
    ? [{ label: 'Profil', href: profilePath }]
    : [
        { label: 'Profil', href: profilePath },
        {
          label: 'Abmelden',
          action: () => void signOut().then(() => router.replace('/' as never)),
        },
      ];

  if (compact) {
    return (
      <View style={[styles.compactRoot, { backgroundColor: barSurface, borderBottomColor: barBorder }, barGlassFx]}>
        {showHamburger ? (
          <Pressable
            onPress={onMenuPress}
            style={[styles.hamburgerBtn, webCursor]}
            accessibilityRole="button"
            accessibilityLabel="Menü öffnen"
            testID="portal-hamburger"
          >
            <Text style={[styles.hamburgerIcon, { color: text.primary }]}>☰</Text>
          </Pressable>
        ) : null}
        <View style={styles.compactBrand}>
          <Text style={[styles.compactTitle, { color: text.primary }]} numberOfLines={1}>
            CareSuite+
          </Text>
          <Text style={[styles.compactPortal, { color: text.muted }]} numberOfLines={1}>
            {portalLabel}
          </Text>
        </View>
        <View style={styles.compactActions}>
          <Pressable
            onPress={() => setProfileOpen((v) => !v)}
            style={[styles.compactProfileChip, webCursor]}
            accessibilityRole="button"
            accessibilityLabel="Profilmenü"
          >
            <TopbarProfileAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              avatarVersion={avatarVersion}
              accentColor={accentColor}
              size="sm"
            />
          </Pressable>
        </View>
        {profileOpen ? (
          <View style={[styles.dropdown, dropdownGlass]}>
            <Text style={[styles.dropdownMeta, { color: menuInk.muted, borderBottomColor: barBorder }]} numberOfLines={1}>
              {displayName}
            </Text>
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
                <Text style={[styles.dropdownText, { color: menuInk.primary }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: barSurface, borderBottomColor: barBorder }, barGlassFx]}>
      <View style={styles.leading}>
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => router.push('/' as never)} style={webCursor}>
            <Text style={[styles.crumbLink, { color: text.muted }]}>Start</Text>
          </Pressable>
          <Text style={[styles.crumbSep, { color: text.muted }]}> › </Text>
          <Text style={[styles.crumbLink, { color: text.muted }]}>{portalLabel}</Text>
          <Text style={[styles.crumbSep, { color: text.muted }]}> › </Text>
          <Text style={[styles.crumbCurrent, { color: text.primary }]}>{portalLabel}</Text>
        </View>
        <Text style={[styles.title, { color: text.primary }]}>{portalLabel}</Text>
        <Text style={[styles.subtitle, { color: text.secondary }]}>{moduleSubtitle}</Text>
      </View>

      {!compact ? (
        <View
          style={[
            styles.searchWrap,
            {
              borderColor: useLightBar ? lightLiquidGlass.borderAccent : auroraGlass.border,
              backgroundColor: useLightBar ? lightLiquidGlass.input : auroraGlass.input,
            },
          ]}
        >
          <Text style={[styles.searchIcon, { color: menuInk.muted }]}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            placeholder="Im Portal suchen…"
            placeholderTextColor={menuInk.muted}
            accessibilityLabel="Im Portal suchen"
            accessibilityHint="Enter öffnet die Dokumente"
            style={[styles.searchInput, { color: menuInk.primary }, webNoOutline]}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.profileWrap}>
          <View style={[styles.profileChip, profileChipSurface]}>
            <TopbarProfileAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              avatarVersion={avatarVersion}
              accentColor={accentColor}
            />
            <Pressable
              onPress={() => setProfileOpen((v) => !v)}
              style={[styles.profileMenuTrigger, webCursor]}
              accessibilityRole="button"
              accessibilityLabel="Profilmenü"
            >
              <Text style={[styles.profileName, { color: text.primary }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.chevron, { color: text.muted }]}>{profileOpen ? '▴' : '▾'}</Text>
            </Pressable>
          </View>
          {profileOpen ? (
            <View style={[styles.dropdown, dropdownGlass]}>
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
                  <Text style={[styles.dropdownText, { color: menuInk.primary }]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.md,
    paddingHorizontal: careSpacing.lg,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  leading: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  breadcrumb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  crumbLink: {
    ...careTypography.caption,
    fontWeight: '600',
  },
  crumbSep: {
    ...careTypography.caption,
  },
  crumbCurrent: {
    ...careTypography.caption,
    fontWeight: '700',
  },
  title: {
    ...careTypography.h3,
    fontWeight: '800',
  },
  subtitle: {
    ...careTypography.caption,
    fontWeight: '600',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    flex: 1,
    maxWidth: 360,
    minHeight: 48,
    paddingHorizontal: careSpacing.md,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchIcon: {
    fontSize: 24,
  },
  searchInput: {
    flex: 1,
    ...careTypography.body,
    paddingVertical: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    flexShrink: 0,
  },
  profileWrap: {
    position: 'relative',
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
    minHeight: 48,
    paddingHorizontal: careSpacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 200,
  },
  profileMenuTrigger: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.xs,
  },
  profileName: {
    ...careTypography.caption,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  chevron: {
    fontSize: 10,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: careSpacing.xs,
    minWidth: 180,
    borderRadius: 12,
    paddingVertical: careSpacing.xs,
    zIndex: 30,
  },
  dropdownItem: {
    paddingVertical: careSpacing.sm,
    paddingHorizontal: careSpacing.md,
  },
  dropdownText: {
    ...careTypography.body,
    fontWeight: '600',
  },
  dropdownMeta: {
    ...careTypography.caption,
    paddingHorizontal: careSpacing.md,
    paddingBottom: careSpacing.xs,
    borderBottomWidth: 1,
    marginBottom: careSpacing.xs,
  },
  compactRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: MOBILE_EDGE_INSET,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: 1,
    zIndex: 10,
    minHeight: MOBILE_MIN_TOUCH_TARGET + careSpacing.sm,
  },
  hamburgerBtn: {
    width: MOBILE_MIN_TOUCH_TARGET,
    height: MOBILE_MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hamburgerIcon: {
    fontSize: 22,
    fontWeight: '700',
  },
  compactBrand: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: careSpacing.xs,
  },
  compactTitle: {
    ...careTypography.body,
    fontWeight: '800',
    fontSize: 18,
  },
  compactPortal: {
    ...careTypography.caption,
    letterSpacing: 0.2,
    fontWeight: '600',
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: careSpacing.sm,
  },
  compactProfileChip: {
    minWidth: MOBILE_MIN_TOUCH_TARGET,
    minHeight: MOBILE_MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: careSpacing.xs,
  },
});
