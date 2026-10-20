import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
import { colors, spacing, typography } from '@/theme';

const APP_VERSION = '1.0.0';

function openExternal(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function AppStartFooter() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <View style={styles.links}>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.help)} accessibilityRole="link">
          <Text style={styles.link}>Hilfe & Support</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.privacy)} accessibilityRole="link">
          <Text style={styles.link}>Datenschutz</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings/data-request' as never)}
          accessibilityRole="button"
        >
          <Text style={styles.link}>Betroffenenrechte</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.imprint)} accessibilityRole="link">
          <Text style={styles.link}>Impressum</Text>
        </Pressable>
        <Pressable onPress={() => openExternal(SUPPORT_LINKS.terms)} accessibilityRole="link">
          <Text style={styles.link}>Nutzungsbedingungen</Text>
        </Pressable>
      </View>
      <Text style={styles.version}>Version {APP_VERSION}</Text>
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
