import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
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
      <ScreenShell title={title} subtitle={`WP ${wpNumber}`}>
        <SuccessState message="Nachricht wurde in der Demo-Warteschlange gespeichert." />
        <PremiumButton title="Zurück" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={title} subtitle={`${domain} · Kommunikation`}>
      <PremiumCard>
        <Text style={styles.hint}>Arbeitspaket {wpNumber} — Demo-Versand ohne externen Provider.</Text>
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.md },
});
