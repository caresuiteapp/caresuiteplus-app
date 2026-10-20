import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { colors, spacing, typography } from '@/theme';

const APP_VERSION = '1.0.0';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

type FooterLinksProps = {
  showVersion?: boolean;
};

/** Compact legal and help links for public surfaces. */
export function FooterLinks({ showVersion = true }: FooterLinksProps) {
  return (
    <View style={styles.root}>
      <View style={styles.links}>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} accessibilityRole="link">
          <Text style={styles.link}>Hilfe</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} accessibilityRole="link">
          <Text style={styles.link}>Datenschutz</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} accessibilityRole="link">
          <Text style={styles.link}>Impressum</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.terms)} accessibilityRole="link">
          <Text style={styles.link}>AGB</Text>
        </Pressable>
      </View>
      {showVersion ? <Text style={styles.version}>Version {APP_VERSION}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  link: {
    ...typography.caption,
    color: colors.textMuted,
  },
  version: {
    ...typography.caption,
    color: colors.textDisabled,
  },
});
