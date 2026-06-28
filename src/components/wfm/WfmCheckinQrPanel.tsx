import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton, SectionPanel, SuccessState, ErrorState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { usePermissions } from '@/hooks/usePermissions';
import {
  buildCheckinQrPayload,
  createWfmCheckinToken,
  listWfmCheckinTokens,
  type WfmCheckinToken,
} from '@/lib/wfm/wfmCheckinService';
import { typography } from '@/theme';

type WfmCheckinQrPanelProps = {
  tenantId: string;
  userId: string;
};

export function WfmCheckinQrPanel({ tenantId, userId }: WfmCheckinQrPanelProps) {
  const text = useAuroraAdaptiveText();
  const { roleKey } = usePermissions();
  const [tokens, setTokens] = useState<WfmCheckinToken[]>([]);
  const [locationLabel, setLocationLabel] = useState('Hauptstandort');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTokens = useCallback(async () => {
    const result = await listWfmCheckinTokens(tenantId, roleKey);
    if (result.ok) setTokens(result.data);
  }, [tenantId, roleKey]);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    const result = await createWfmCheckinToken(tenantId, userId, roleKey, {
      locationLabel,
      expiresInDays: 365,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(`Check-in-Code erstellt: ${result.data.tokenCode}`);
    await loadTokens();
  };

  return (
    <SectionPanel title="Büro-Check-in (QR/Code)" subtitle="Mitarbeitende scannen oder geben den Code ein">
      <Text style={{ color: text.secondary, ...typography.caption, marginBottom: careSpacing.sm }}>
        Drucken Sie den Code am Empfang aus oder zeigen Sie ihn auf einem Bildschirm. Mitarbeitende geben den
        8-stelligen Code unter Arbeitszeit → Büro-Check-in ein.
      </Text>

      <TextInput
        style={[styles.input, { color: text.primary, borderColor: text.secondary }]}
        value={locationLabel}
        onChangeText={setLocationLabel}
        placeholder="Standortbezeichnung"
        placeholderTextColor={text.secondary}
      />

      <PremiumButton title="Neuen Code erstellen" onPress={() => void handleCreate()} disabled={loading} />
      <PremiumButton title="Codes laden" variant="secondary" onPress={() => void loadTokens()} disabled={loading} />

      {tokens.map((token) => (
        <View key={token.id} style={styles.tokenBox}>
          <Text style={[styles.tokenCode, { color: text.primary }]}>{token.tokenCode}</Text>
          <Text style={{ color: text.secondary, ...typography.caption }}>{token.locationLabel}</Text>
          <Text style={[styles.qrPayload, { color: text.secondary }]} selectable>
            {buildCheckinQrPayload(token)}
          </Text>
        </View>
      ))}

      {message ? <SuccessState title="Erfolg" message={message} /> : null}
      {error ? <ErrorState title="Fehler" message={error} onRetry={() => setError(null)} /> : null}
    </SectionPanel>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: careSpacing.sm,
    marginBottom: careSpacing.sm,
    ...typography.body,
  },
  tokenBox: {
    marginTop: careSpacing.md,
    padding: careSpacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tokenCode: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  qrPayload: {
    marginTop: careSpacing.xs,
    fontFamily: 'monospace',
    fontSize: 11,
  },
});
