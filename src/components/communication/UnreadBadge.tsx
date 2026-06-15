import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '@/theme';

type UnreadBadgeProps = { count: number };

export function UnreadBadge({ count }: UnreadBadgeProps) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.capsule,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  text: { ...typography.caption, color: colors.bgDeep, fontWeight: '700' },
});
