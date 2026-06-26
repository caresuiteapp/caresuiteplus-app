import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import type { PortalRequestType } from '@/types/portal/assist';

export type PortalQuickAction = {
  key: PortalRequestType | 'nav_messages' | 'nav_documents';
  label: string;
  icon: string;
};

const DEFAULT_ACTIONS: PortalQuickAction[] = [
  { key: 'nav_messages', label: 'Nachricht', icon: '💬' },
  { key: 'termin_aendern', label: 'Einsatzänderung', icon: '📅' },
  { key: 'zusatztermin', label: 'Zusatzeinsatz', icon: '➕' },
  { key: 'upload', label: 'Upload', icon: '📎' },
  { key: 'rueckruf', label: 'Rückruf', icon: '📞' },
  { key: 'nachweise', label: 'Nachweise', icon: '📋' },
];

type PortalQuickActionsProps = {
  onAction: (action: PortalQuickAction) => void;
  actions?: PortalQuickAction[];
};

/** Horizontal quick-action chips — each triggers a real workflow. */
export function PortalQuickActions({ onAction, actions = DEFAULT_ACTIONS }: PortalQuickActionsProps) {
  const text = useAuroraAdaptiveText();
  const { width, isPhone } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  const chips = actions.map((action) => (
    <Pressable
      key={action.key}
      onPress={() => onAction(action)}
      style={styles.chip}
      accessibilityRole="button"
    >
      <Text style={styles.icon}>{action.icon}</Text>
      <Text style={[type.caption, { color: text.primary }]} numberOfLines={1}>
        {action.label}
      </Text>
    </Pressable>
  ));

  return (
    <View style={styles.section}>
      {isPhone ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {chips}
        </ScrollView>
      ) : (
        <View style={styles.wrapGrid}>{chips}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: careSpacing.sm,
    width: '100%',
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    gap: careSpacing.xs,
    paddingRight: careSpacing.md,
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: careSpacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: careSpacing.sm,
    paddingVertical: careSpacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  icon: {
    fontSize: 16,
  },
});
