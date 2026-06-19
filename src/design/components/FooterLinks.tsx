import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { DEMO_START_PATH } from '@/data/landing/appStartEntries';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { isDemoMode } from '@/lib/supabase/config';

const APP_VERSION = '1.0.0';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Central footer links for public/start screens — theme tokens only. */
export function FooterLinks() {
  const router = useRouter();
  const demoMode = isDemoMode();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.root}>
      <View style={styles.links}>
        {!demoMode ? (
          <Pressable
            onPress={() => router.push(DEMO_START_PATH as never)}
            accessibilityRole="button"
          >
            <Text style={[type.caption, styles.link]}>Demo ansehen</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} accessibilityRole="link">
          <Text style={[type.caption, styles.link]}>Hilfe & Support</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} accessibilityRole="link">
          <Text style={[type.caption, styles.link]}>Datenschutz</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} accessibilityRole="link">
          <Text style={[type.caption, styles.link]}>Impressum</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.terms)} accessibilityRole="link">
          <Text style={[type.caption, styles.link]}>Nutzungsbedingungen</Text>
        </Pressable>
      </View>
      <Text style={[type.caption, styles.version]}>Version {APP_VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
    gap: careSpacing.sm,
    paddingTop: careSpacing.md,
    borderTopWidth: 1,
    borderTopColor: galaxyPalette.borderGlass,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: careSpacing.sm,
  },
  link: {
    color: galaxyPalette.textMuted,
    textAlign: 'center',
  },
  version: {
    color: galaxyPalette.textMuted,
    opacity: 0.72,
    textAlign: 'center',
  },
});
