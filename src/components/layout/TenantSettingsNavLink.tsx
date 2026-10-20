import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { usePermissions } from '@/hooks/usePermissions';
import { TENANT_SETTINGS_PERMISSION, TENANT_SETTINGS_ROUTE } from '@/lib/tenant/tenantSettingsRoute';
import { careLightColors } from '@/design/tokens/lightTheme';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import { colors, spacing, typography } from '@/theme';

type TenantSettingsNavLinkProps = {
  variant?: 'footer' | 'footerLight' | 'rail';
};

export function TenantSettingsNavLink({ variant = 'footer' }: TenantSettingsNavLinkProps) {
  const router = useRouter();
  const { can } = usePermissions();

  if (!can(TENANT_SETTINGS_PERMISSION)) {
    return null;
  }

  if (variant === 'rail') {
    return (
      <Pressable
        onPress={() => router.push(TENANT_SETTINGS_ROUTE as never)}
        style={styles.railItem}
        accessibilityRole="button"
        accessibilityLabel="Mandant bearbeiten"
      >
        <Text style={styles.railIcon}>🏢</Text>
      </Pressable>
    );
  }

  const isLight = variant === 'footerLight';

  return (
    <Pressable
      onPress={() => router.push(TENANT_SETTINGS_ROUTE as never)}
      style={isLight ? styles.footerBtnLight : styles.footerLink}
      accessibilityRole="button"
      accessibilityLabel="Mandant bearbeiten"
    >
      <Text style={isLight ? styles.footerBtnTextLight : styles.footerLinkText}>🏢 Mandant</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footerLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  footerLinkText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footerBtnLight: {
    paddingVertical: careSpacing.xs,
    paddingHorizontal: careSpacing.sm,
  },
  footerBtnTextLight: {
    ...careTypography.caption,
    color: careLightColors.muted,
    fontWeight: '600',
  },
  railItem: {
    width: 56,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  railIcon: {
    fontSize: 20,
  },
});
