import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { GlassCard } from '@/design/components/GlassCard';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { PortalTabScreen } from '@/screens/portal/PortalTabScreen';
import { colors } from '@/theme';

export default function EmployeePortalExecutionHubRoute() {
  const text = useAuroraAdaptiveText();

  return (
    <PortalTabScreen title="Durchführung">
      <GlassCard style={styles.card}>
        <Text style={[styles.title, { color: text.primary }]}>Einsatzdurchführung</Text>
        <Text style={{ color: text.muted, marginBottom: careSpacing.md }}>
          Starten Sie die Durchführung über einen zugewiesenen Einsatz — Aufgaben, Dokumentation,
          Signatur und Nachweis ohne Budget- oder Rechnungsdetails.
        </Text>
        <Link href="/portal/employee/assignments" asChild>
          <Text style={[styles.link, { color: colors.cyan }]}>→ Meine Einsätze öffnen</Text>
        </Link>
      </GlassCard>
    </PortalTabScreen>
  );
}

const styles = StyleSheet.create({
  card: { padding: careSpacing.lg },
  title: { fontSize: 18, fontWeight: '700', marginBottom: careSpacing.sm },
  link: { fontWeight: '600' },
});
