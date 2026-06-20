import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { careSpacing } from '@/design/tokens/spacing';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';

export function AssistSettingsScreen({ embeddedInModal = false }: ModuleNavModalComponentProps = {}) {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <SectionPanel title="Assist-Modul" subtitle="Konfiguration und Verknüpfungen">
        <View style={styles.actions}>
          <PremiumButton
            title="Signaturen & Nachweise"
            variant="secondary"
            onPress={() => router.push('/assist/signaturen' as never)}
          />
          <PremiumButton
            title="Abrechnungsquellen"
            variant="secondary"
            onPress={() => router.push('/assist/abrechnungsquellen' as never)}
          />
          <PremiumButton
            title="Mandant & Unternehmensdaten"
            variant="secondary"
            onPress={() => router.push('/settings/tenant' as never)}
          />
        </View>
      </SectionPanel>
      {embeddedInModal ? (
        <SectionPanel title="Hinweis" subtitle="Persistenz">
          <PremiumButton
            title="Assist-Dashboard"
            variant="ghost"
            onPress={() => router.push('/assist' as never)}
          />
        </SectionPanel>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
  actions: { gap: careSpacing.sm },
});
