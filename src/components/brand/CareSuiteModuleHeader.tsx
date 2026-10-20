import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { careModuleTokens, type CareModuleKey } from '@/design/tokens/modules';
import { colors, radius, spacing, typography } from '@/theme';

type CareSuiteModuleHeaderProps = {
  moduleKey: CareModuleKey;
  subtitle?: string;
  style?: ViewStyle;
};

export function CareSuiteModuleHeader({ moduleKey, subtitle, style }: CareSuiteModuleHeaderProps) {
  const mod = careModuleTokens[moduleKey];
  return (
    <View style={[styles.root, style]}>
      <View style={[styles.iconBadge, { backgroundColor: `${mod.color}22` }]}>
        <Text style={styles.icon}>{mod.icon}</Text>
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: mod.color }]}>{mod.label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.h2,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
