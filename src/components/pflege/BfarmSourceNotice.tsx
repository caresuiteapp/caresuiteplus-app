import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, useLegacyTheme } from '@/theme';
import { BFARM_SOURCE_URL, bfarmReferenceIsStale } from '@/lib/pflege/bfarmReference';

export function BfarmSourceNotice({ sourceVersion, stale = false }: { sourceVersion: string; stale?: boolean }) {
  const { colors } = useLegacyTheme();
  const styles = useMemo(() => StyleSheet.create({
    box: { gap: spacing.xs, borderTopWidth: 1, borderColor: colors.borderStrong, paddingTop: spacing.sm },
    text: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
    status: { ...typography.label, color: colors.textPrimary },
    link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', maxWidth: '100%' },
    linkText: { ...typography.caption, color: colors.primary, textDecorationLine: 'underline', flexShrink: 1 },
  }), [colors]);
  const outOfDate = stale || bfarmReferenceIsStale(sourceVersion);
  const displayDate = /^\d{4}-\d{2}-\d{2}$/.test(sourceVersion) ? sourceVersion.split('-').reverse().join('.') : sourceVersion;
  return <View style={styles.box}>
    <Text style={styles.text}>Quelle: Bundesinstitut für Arzneimittel und Medizinprodukte (BfArM), Referenzdatenbank nach § 31b SGB V.</Text>
    <Text style={styles.status}>Datenstand: {displayDate}{outOfDate ? ' · Datenstand überholt' : ''}</Text>
    {outOfDate ? <Text style={styles.text}>Die nächste reguläre Lieferung ist fällig. Die angezeigten Angaben stammen weiterhin aus dem genannten Datenstand.</Text> : null}
    <Text style={styles.text}>Bitte informiere dich möglichst auch direkt bei der Originalquelle.</Text>
    <Pressable accessibilityRole="link" style={styles.link} onPress={() => { void Linking.openURL(BFARM_SOURCE_URL).catch(() => undefined); }}>
      <Text style={styles.linkText}>Originalquelle beim BfArM öffnen</Text>
    </Pressable>
  </View>;
}
