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
import { auroraGlass, useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { useAuth } from '@/lib/auth/context';
import { usePortalActor } from '@/hooks/usePortalActor';
import { usePortalContext } from '@/hooks/usePortalContext';
import { resolveCombinedModuleLabel } from '@/lib/portal/engine/portalTerminology';

type PortalTopBarProps = {
  accentColor?: string;
  /** Compact mobile header — brand row only, no breadcrumb block. */
  compact?: boolean;
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
export function PortalTopBar({ accentColor = '#FF9500', compact = false }: PortalTopBarProps) {
  const router = useRouter();
  const text = useAuroraAdaptiveText();
  const { profile, signOut } = useAuth();
  const { displayName } = usePortalActor();
  const { context } = usePortalContext();
  const [query, setQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  const moduleSubtitle = useMemo(() => {
    if (!context?.hasModuleAssignments) return 'Ihr persönlicher Portalbereich';
    return resolveCombinedModuleLabel(context.activeModuleKeys);
  }, [context]);

  const avatarUrl = profile?.avatarUrl?.trim() || undefined;

  const profileMenuItems = [
    { label: 'Profil', href: '/portal/client/profile' },
    {
      label: 'Abmelden',
      action: () => void signOut().then(() => router.replace('/' as never)),
    },
  ];

  if (compact) {
    return (
      <View style={[styles.compactRoot, webGlassBlur]}>
        <View style={styles.compactBrand}>
          <Text style={[styles.compactTitle, { color: text.primary }]}>CareSuite+</Text>
          <Text style={[styles.compactPortal, { color: text.muted }]}>Klient:innenportal</Text>
        </View>
        <View style={styles.compactActions}>
          <View style={styles.compactProfileChip}>
            <TopbarProfileAvatar
              name={displayName}
              avatarUrl={avatarUrl}
              accentColor={accentColor}
            />
            <Pressable
              onPress={() => setProfileOpen((v) => !v)}
              style={[styles.compactProfileMenuTrigger, webCursor]}
              accessibilityRole="button"
              accessibilityLabel="Profilmenü"
            >
              <Text style={[styles.chevron, { color: text.muted }]}>{profileOpen ? '▴' : '▾'}</Text>
            </Pressable>
          </View>
        </View>
        {profileOpen ? (
          <View style={styles.dropdown}>
            <Text style={[styles.dropdownMeta, { color: text.muted }]} numberOfLines={1}>
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
                <Text style={[styles.dropdownText, { color: text.primary }]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, webGlassBlur]}>
      <View style={styles.leading}>
        <View style={styles.breadcrumb}>
          <Pressable onPress={() => router.push('/' as never)} style={webCursor}>
            <Text style={[styles.crumbLink, { color: text.muted }]}>Start</Text>
          </Pressable>
          <Text style={[styles.crumbSep, { color: text.muted }]}> › </Text>
          <Text style={[styles.crumbLink, { color: text.muted }]}>Portal</Text>
          <Text style={[styles.crumbSep, { color: text.muted }]}> › </Text>
          <Text style={[styles.crumbCurrent, { color: text.primary }]}>Klient:innenportal</Text>
        </View>
        <Text style={[styles.title, { color: text.primary }]}>Klient:innenportal</Text>
        <Text style={[styles.subtitle, { color: text.secondary }]}>{moduleSubtitle}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={[styles.searchIcon, { color: text.muted }]}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Im Portal suchen…"
          placeholderTextColor={text.muted}
          style={[styles.searchInput, { color: text.primary }, webNoOutline]}
        />
      </View>

      <View style={styles.actions}>
        <View style={styles.profileWrap}>
          <View style={styles.profileChip}>
            <TopbarProfileAvatar
              name={displayName}
              avatarUrl={avatarUrl}
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
            <View style={styles.dropdown}>
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
                  <Text style={[styles.dropdownText, { color: text.primary }]}>{item.label}</Text>
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
    borderBottomColor: auroraGlass.border,
    backgroundColor: auroraGlass.panel,
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
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.input,
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
    borderColor: auroraGlass.border,
    backgroundColor: auroraGlass.chip,
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
    borderWidth: 1,
    borderColor: auroraGlass.borderStrong,
    backgroundColor: auroraGlass.modal,
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
    borderBottomColor: auroraGlass.border,
    marginBottom: careSpacing.xs,
  },
  compactRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: careSpacing.md,
    paddingVertical: careSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: auroraGlass.border,
    backgroundColor: auroraGlass.panel,
    zIndex: 10,
  },
  compactBrand: {
    flex: 1,
    gap: 2,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    paddingHorizontal: careSpacing.xs,
  },
  compactProfileMenuTrigger: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: careSpacing.xs,
  },
});
