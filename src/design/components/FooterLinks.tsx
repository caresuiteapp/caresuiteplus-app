import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { galaxyPalette } from '@/design/tokens/galaxy';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';

const APP_VERSION = '1.0.0';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Central footer links for public/start screens — theme tokens only. */
export function FooterLinks() {
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.root}>
      <View style={styles.links}>
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
