import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthFlowTypography } from '@/design/tokens/authTypography';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';

const APP_VERSION = '1.0.0';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

/** Central footer links for public/start screens — theme tokens only. */
export function FooterLinks() {
  const type = useAuthFlowTypography();
  const text = useAuroraAdaptiveText();

  return (
    <View style={[styles.root, { borderTopColor: text.border }]}>
      <View style={styles.links}>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} accessibilityRole="link">
          <Text style={[type.caption, styles.link, { color: text.muted }]}>Hilfe & Support</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} accessibilityRole="link">
          <Text style={[type.caption, styles.link, { color: text.muted }]}>Datenschutz</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} accessibilityRole="link">
          <Text style={[type.caption, styles.link, { color: text.muted }]}>Impressum</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.terms)} accessibilityRole="link">
          <Text style={[type.caption, styles.link, { color: text.muted }]}>Nutzungsbedingungen</Text>
        </Pressable>
      </View>
      <Text style={[type.caption, styles.version, { color: text.muted }]}>Version {APP_VERSION}</Text>
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
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: careSpacing.sm,
  },
  link: {
    textAlign: 'center',
  },
  version: {
    opacity: 0.72,
    textAlign: 'center',
  },
});
