import { StyleSheet, Text, View } from 'react-native';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { resolveGalaxyTypography } from '@/design/tokens/responsiveTypography';
import { useDeviceClass } from '@/hooks/useDeviceClass';

type PortalProfileInfoRowProps = {
  label: string;
  value: string;
};

export function PortalProfileInfoRow({ label, value }: PortalProfileInfoRowProps) {
  const text = useAuroraAdaptiveText();
  const { width } = useDeviceClass();
  const type = resolveGalaxyTypography(width);

  return (
    <View style={styles.row}>
      <Text style={[type.caption, { color: text.muted }]}>{label}</Text>
      <Text style={[type.body, { color: text.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 2,
    marginBottom: careSpacing.sm,
  },
});
