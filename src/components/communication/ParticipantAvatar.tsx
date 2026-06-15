import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '@/theme';

type ParticipantAvatarProps = { name: string; size?: number };

export function ParticipantAvatar({ name, size = 40 }: ParticipantAvatarProps) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initial}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { ...typography.bodyStrong, color: colors.cyan },
});
