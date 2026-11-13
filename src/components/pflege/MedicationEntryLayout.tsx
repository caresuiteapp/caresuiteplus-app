import { useMemo, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SectionPanel } from '@/components/ui';
import { radius, spacing, typography, useLegacyTheme } from '@/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];

function useStyles() {
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => StyleSheet.create({
    box: { gap: spacing.sm },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    cell: { flexBasis: 152, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 4, padding: spacing.sm,
      borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, backgroundColor: colors.bgElevated },
    identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
    label: { ...typography.label, color: colors.textPrimary, flexShrink: 1 },
    value: { ...typography.body, color: colors.textPrimary },
    caption: { ...typography.caption, color: colors.textSecondary },
    footer: { borderTopWidth: 1, borderColor: colors.borderStrong, paddingTop: spacing.md, gap: spacing.sm },
  }), [colors]);
  return { styles, accent: colors.primary };
}

export function MedicationEntryOverview({ client, product, physician }: { client?: string; product?: string; physician?: string }) {
  const { styles, accent } = useStyles();
  const entries: { title: string; icon: Icon; value?: string }[] = [
    { title: 'Klientenakte', icon: 'person-circle-outline', value: client },
    { title: 'Präparat', icon: 'medical-outline', value: product },
    { title: 'Verordnende Person', icon: 'people-outline', value: physician },
  ];
  return <SectionPanel title="Neue Verordnung" subtitle="Akte wählen, Präparat und verordnende Person erfassen, dann die Gabe festlegen.">
    <View style={styles.row}>
      {entries.map(({ title, icon, value }) => <View key={title} style={styles.cell}>
        <View style={styles.identity}>
          <Ionicons name={icon} size={18} color={accent} accessible={false} />
          <Text style={styles.label}>{title}</Text>
        </View>
        <Text style={value ? styles.value : styles.caption}>{value || 'Noch nicht angegeben'}</Text>
      </View>)}
    </View>
    <Text style={styles.caption}>Mit * gekennzeichnete Angaben sind Pflichtfelder. Das Speichern bestätigt weder eine ärztliche Freigabe noch die Durchführung.</Text>
  </SectionPanel>;
}

export function MedicationSelectedPackage({ pzn, brand, manufacturer, onClear, disabled }: {
  pzn: string; brand: string; manufacturer: string; onClear: ReactNode; disabled?: boolean;
}) {
  const { styles, accent } = useStyles();
  return <View style={styles.box}>
    <View style={styles.identity}>
      <Ionicons name="checkmark-circle-outline" size={20} color={accent} accessible={false} />
      <Text accessibilityRole="header" style={styles.label}>Packung übernommen</Text>
    </View>
    <View style={styles.row}>
      {([['PZN', pzn], ['Marke', brand], ['Hersteller', manufacturer]] as const).map(([label, value]) => <View key={label} style={styles.cell}>
        <Text style={styles.label}>{label}</Text>
        <Text selectable={Boolean(value)} style={value ? styles.value : styles.caption}>{value || 'Im Verzeichnis nicht hinterlegt'}</Text>
      </View>)}
    </View>
    {!disabled ? onClear : null}
  </View>;
}

export function MedicationEntryFooter({ children, detail }: { children: ReactNode; detail: string }) {
  const { styles } = useStyles();
  return <View style={styles.footer}>
    <Text style={styles.caption}>{detail}</Text>
    <View style={styles.row}>{children}</View>
  </View>;
}
