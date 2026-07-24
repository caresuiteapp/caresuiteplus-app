import { Linking, StyleSheet, Text, View } from 'react-native';
import { InfoBanner, PremiumButton, PremiumCard } from '@/components/ui';
import type { ZoomJoinContext } from '@/lib/zoom/zoomService';
import { colors, spacing, typography } from '@/theme';

type Props = {
  context: ZoomJoinContext;
  onLeave: () => void;
};

export function ZoomMeetingRoom({ context, onLeave }: Props) {
  return (
    <PremiumCard variant="elevated" accentColor={colors.cyanSoft}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>SICHERER MOBILER VIDEOTERMIN</Text>
        <Text style={styles.title}>{context.topic}</Text>
        <InfoBanner
          title="Zoom auf diesem Gerät"
          message="Das Meeting wird im installierten Zoom-Client oder in der sicheren mobilen Zoom-Webansicht geöffnet. Nach dem Gespräch kehren Sie automatisch zu CareSuite zurück."
        />
        <View style={styles.actions}>
          <PremiumButton title="Zoom-Meeting öffnen" onPress={() => void Linking.openURL(context.joinUrl)} />
          <PremiumButton title="Zurück zu CareSuite" variant="ghost" onPress={onLeave} />
        </View>
      </View>
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  eyebrow: { ...typography.caption, color: colors.cyanSoft, fontWeight: '800', letterSpacing: 1.2 },
  title: { ...typography.h2, color: colors.textPrimary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
