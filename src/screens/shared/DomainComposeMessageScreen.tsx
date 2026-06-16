import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareLightPageShell } from '@/components/layout';
import { PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
import { isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { spacing, typography } from '@/theme';

type DomainComposeMessageScreenProps = {
  wpNumber: number;
  domain: string;
  title: string;
};

export function DomainComposeMessageScreen({
  wpNumber,
  domain,
  title,
}: DomainComposeMessageScreenProps) {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <CareLightPageShell title={title} subtitle={`WP ${wpNumber}`}>
        <SuccessState
          message={
            isLiveServiceMode()
              ? 'Nachricht wurde gespeichert.'
              : 'Nachricht wurde in der Demo-Warteschlange gespeichert.'
          }
        />
        <PremiumButton title="Zurück" onPress={() => router.back()} />
      </CareLightPageShell>
    );
  }

  return (
    <CareLightPageShell title={title} subtitle={`${domain} · Kommunikation`}>
      <PremiumCard>
        {!isLiveServiceMode() ? (
          <Text style={styles.hint}>Arbeitspaket {wpNumber} — Demo-Versand ohne externen Provider.</Text>
        ) : null}
        <PremiumInput label="Betreff" value={subject} onChangeText={setSubject} />
        <PremiumInput
          label="Nachricht"
          value={body}
          onChangeText={setBody}
          multiline
          hint="Mindestens 10 Zeichen"
        />
        <PremiumButton
          title="Senden"
          fullWidth
          onPress={() => {
            if (subject.trim() && body.trim().length >= 10) setSent(true);
          }}
        />
      </PremiumCard>
    </CareLightPageShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.md },
});
