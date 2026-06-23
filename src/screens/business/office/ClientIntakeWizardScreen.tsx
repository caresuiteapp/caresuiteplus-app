import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ClientIntakeWizardForm } from '@/components/office/clientintakewizardform';
import { ScreenShell } from '@/components/layout';
import { clientRecordRoute } from '@/lib/navigation/clientRoutes';
import { spacing } from '@/theme';

export function ClientIntakeWizardScreen() {
  const router = useRouter();
  const styles = StyleSheet.create({
    content: { flex: 1 },
    hero: { paddingHorizontal: spacing.md },
  });

  return (
    <ScreenShell
      title="Klient:in aufnehmen"
      subtitle="Leistungsart wählen"
      onBack={() => router.back()}
    >
      <View style={styles.hero}>
        <FormScreenHero
          eyebrow="OFFICE · KLIENT:INNEN"
          title="Klient:in aufnehmen"
          meta="Schrittweise Aufnahme · Entwurf jederzeit speicherbar"
        />
      </View>
      <View style={styles.content}>
        <ClientIntakeWizardForm
          onCancel={() => router.back()}
          onCreated={(id) => router.replace(clientRecordRoute(id) as never)}
        />
      </View>
    </ScreenShell>
  );
}
