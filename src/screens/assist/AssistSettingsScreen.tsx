import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { PremiumButton, SectionPanel } from '@/components/ui';
import { moduleColor } from '@/design/tokens/modules';
import { careSpacing } from '@/design/tokens/spacing';
import type { ModuleNavModalComponentProps } from '@/lib/navigation/modulenav/modalscreens';

export function AssistSettingsScreen({ embeddedInModal = false }: ModuleNavModalComponentProps = {}) {
  const router = useRouter();
  const assistAccent = moduleColor('assist');

  return (
    <C14vSubpageShell
      title="Assist-Einstellungen"
      eyebrow="ASSIST · KONFIGURATION"
      subtitle="Modul & Verknüpfungen"
      moduleLabel="Assist"
      showBack={false}
      accentColor={assistAccent}
    >
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
    </C14vSubpageShell>
  );
}

const styles = StyleSheet.create({
  root: { gap: careSpacing.md },
  actions: { gap: careSpacing.sm },
});
