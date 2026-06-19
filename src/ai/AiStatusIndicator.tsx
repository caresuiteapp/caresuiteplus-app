import { StyleSheet, Text, View } from 'react-native';
import { auroraGlass } from '@/design/tokens/auroraGlass';
import { AI_STATUS_LABELS, type AiStatus } from './aiToolTypes';

type AiStatusIndicatorProps = {
  status: AiStatus;
  compact?: boolean;
};

const STATUS_COLORS: Record<AiStatus, string> = {
  ready: 'rgba(255,255,255,0.55)',
  listening: 'rgba(96, 220, 255, 0.95)',
  thinking: 'rgba(180, 140, 255, 0.95)',
  speaking: 'rgba(255,255,255,0.95)',
  tool_loading: 'rgba(255, 180, 80, 0.95)',
  pending: 'rgba(255, 210, 80, 0.95)',
  error: 'rgba(255, 90, 90, 0.95)',
};

export function AiStatusIndicator({ status, compact = false }: AiStatusIndicatorProps) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={[styles.dot, { backgroundColor: STATUS_COLORS[status] }]} />
      <Text style={[styles.label, compact && styles.labelCompact]}>{AI_STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: auroraGlass.chip,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: auroraGlass.border,
  },
  rowCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    color: auroraGlass.text.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 12,
  },
});
