import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PremiumButton, SectionPanel, SuccessState, ErrorState } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { careSpacing } from '@/design/tokens/spacing';
import { usePermissions } from '@/hooks/usePermissions';
import type { RoleKey } from '@/types';
import {
  wfmOfficeCheckInByToken,
  wfmOfficeCheckOut,
} from '@/lib/wfm/wfmCheckinService';
import { isWfmSessionActive } from '@/lib/wfm/wfmClockService';
import type { WfmWorkSession } from '@/types/modules/wfm';
import { typography } from '@/theme';

type WfmCheckinScanPanelProps = {
  tenantId: string;
  userId: string;
  roleKey: RoleKey | null;
  employeeId?: string | null;
  session: WfmWorkSession | null;
  onSuccess: () => void;
};

export function WfmCheckinScanPanel({
  tenantId,
  userId,
  roleKey,
  employeeId,
  session,
  onSuccess,
}: WfmCheckinScanPanelProps) {
  const text = useAuroraAdaptiveText();
  const { can } = usePermissions();
  const [tokenCode, setTokenCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canStart = can('time.tracking.own.start');
  const isOfficeActive = session?.workMode === 'office' && isWfmSessionActive(session);

  const handleCheckIn = useCallback(async () => {
    if (!tokenCode.trim()) {
      setError('Bitte geben Sie den Check-in-Code ein.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await wfmOfficeCheckInByToken(tenantId, userId, roleKey, tokenCode, { employeeId });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage('Büro-Check-in erfolgreich.');
    setTokenCode('');
    onSuccess();
  }, [tenantId, userId, roleKey, tokenCode, employeeId, onSuccess]);

  const handleCheckOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await wfmOfficeCheckOut(tenantId, userId, roleKey, { employeeId });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage('Büro-Check-out erfolgreich.');
    onSuccess();
  }, [tenantId, userId, roleKey, employeeId, onSuccess]);

  if (!canStart) return null;

  return (
    <SectionPanel title="Büro-Check-in" subtitle="Code am Empfang eingeben oder QR scannen">
      {isOfficeActive ? (
        <>
          <Text style={{ color: text.primary, ...typography.body, marginBottom: careSpacing.sm }}>
            Sie sind im Büro eingecheckt{session?.locationLabel ? ` (${session.locationLabel})` : ''}.
          </Text>
          <PremiumButton title="Büro verlassen (Check-out)" onPress={() => void handleCheckOut()} disabled={loading} />
        </>
      ) : (
        <>
          <TextInput
            style={[styles.input, { color: text.primary, borderColor: text.secondary }]}
            value={tokenCode}
            onChangeText={(v) => setTokenCode(v.toUpperCase())}
            placeholder="8-stelliger Code"
            placeholderTextColor={text.secondary}
            autoCapitalize="characters"
            maxLength={8}
          />
          <PremiumButton title="Im Büro einchecken" onPress={() => void handleCheckIn()} disabled={loading} />
        </>
      )}

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
    fontFamily: 'monospace',
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
});
