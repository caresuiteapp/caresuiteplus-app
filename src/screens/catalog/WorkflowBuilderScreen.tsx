import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PreparedModeBanner } from '@/components/modules/PreparedModeBanner';
import { WorkflowBuilderHero } from '@/components/catalog/WorkflowBuilderHero';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';
import { WORKFLOW_BUILDER_PREPARED_MESSAGE } from '@/lib/workflow/workflowModuleConfig';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { spacing, typography } from '@/theme';

/** WP455 */
export function WorkflowBuilderScreen() {
  const [stepName, setStepName] = useState('');
  const [steps, setSteps] = useState<string[]>(['entwurf', 'aktiv']);

  return (
    <ScreenShell title="Workflow-Builder" subtitle="Katalog · WP 455" scroll>
      <WorkflowBuilderHero stepCount={steps.length} />
      <PreparedModeBanner hint={WORKFLOW_BUILDER_PREPARED_MESSAGE} />
      <PremiumCard>
        <Text style={styles.sectionTitle}>Status-Schritte konfigurieren</Text>
        <Text style={styles.hint}>Demo-Vorschau — Schritte werden nur lokal gehalten.</Text>
        {steps.map((s) => (
          <Text key={s} style={styles.stepRow}>
            · {WORKFLOW_STATUS_LABELS[s as keyof typeof WORKFLOW_STATUS_LABELS] ?? s}
          </Text>
        ))}
        <PremiumInput label="Neuer Schritt" value={stepName} onChangeText={setStepName} />
        <PremiumButton
          title="Schritt hinzufügen"
          onPress={() => stepName.trim() && setSteps((p) => [...p, stepName.trim()])}
        />
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.bodyStrong, marginBottom: spacing.xs },
  hint: { ...typography.caption, marginBottom: spacing.sm },
  stepRow: { ...typography.body, marginBottom: 4 },
});
