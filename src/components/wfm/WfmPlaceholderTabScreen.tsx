import { StyleSheet, Text, View } from 'react-native';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { InfoBanner, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { typography } from '@/theme';

type WfmPlaceholderTabScreenProps = {
  title: string;
  subtitle: string;
  message: string;
  phaseNote: string;
};

export function WfmPlaceholderTabScreen({
  title,
  subtitle,
  message,
  phaseNote,
}: WfmPlaceholderTabScreenProps) {
  const text = useAuroraAdaptiveText();

  return (
    <ScreenShell title={title} subtitle={subtitle} showBack={false} scroll>
      <SectionPanel title={title} subtitle={subtitle}>
        <Text style={[styles.body, { color: text.primary }]}>{message}</Text>
        <InfoBanner message={phaseNote} />
      </SectionPanel>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    marginBottom: careSpacing.md,
  },
});
