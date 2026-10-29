import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LiquidButton } from '@/liquid-command/components/LiquidPrimitives';
import { portalPremium } from '@/design/tokens/portalPremium';
import { getPortalFaceAvailability } from '@/lib/auth/portalBiometricService';
import {
  getRememberedPortalMetadata,
  unlockRememberedPortalLogin,
  forgetRememberedPortalLogin,
  supportsRememberedPortalLogin,
  type RememberedPortalKind,
  type RememberedPortalLogin,
  type RememberedPortalMetadata,
} from '@/lib/auth/rememberedPortalLogin';

export function RememberedPortalLoginControls({
  kind,
  remember,
  onRememberChange,
  onLogin,
  onUnlock,
  active = true,
  busy,
}: {
  kind: RememberedPortalKind;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  onLogin?: (login: RememberedPortalLogin) => Promise<void>;
  /** Active login forms own the entire request, including the device prompt. */
  onUnlock?: () => Promise<void>;
  active?: boolean;
  busy: boolean;
}) {
  const [saved, setSaved] = useState<RememberedPortalMetadata | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [methodLabel, setMethodLabel] = useState('Gerätebestätigung');
  const generation = useRef({ active, kind, value: 0, mounted: true });
  if (generation.current.active !== active || generation.current.kind !== kind) {
    generation.current = { active, kind, value: generation.current.value + 1, mounted: true };
  }
  useEffect(() => {
    generation.current.mounted = true;
    return () => { generation.current.mounted = false; generation.current.value++; };
  }, []);
  useEffect(() => {
    let active = true;
    void getPortalFaceAvailability().then(value => { if (active) setMethodLabel(value.methodLabel); }).catch(() => {});
    void getRememberedPortalMetadata(kind)
      .then((value) => {
        if (active) setSaved(value);
      })
      .catch(() => {
        if (active)
          setError(
            'Gespeicherte Anmeldung konnte nicht gelesen werden. Sie können sich normal anmelden.',
          );
      });
    return () => {
      active = false;
    };
  }, [kind]);
  if (!supportsRememberedPortalLogin()) return null;
  const unlock = async () => {
    if (busy || !active || lock.current) return;
    const attempt = generation.current.value;
    const isCurrent = () => generation.current.mounted && generation.current.active && generation.current.value === attempt;
    lock.current = true;
    setWorking(true);
    setError(null);
    try {
      if (onUnlock) await onUnlock();
      else {
        const login = await unlockRememberedPortalLogin(kind);
        if (isCurrent()) await onLogin?.(login);
      }
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Bitte normal anmelden.');
    } finally {
      lock.current = false;
      if (generation.current.mounted) setWorking(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {saved ? (
        <>
          <LiquidButton
            label={`Mit ${methodLabel} anmelden`}
            variant="secondary"
            onPress={() => void unlock()}
            loading={working}
            disabled={busy || !active}
            fullWidth
          />
          <Text style={{ color: portalPremium.text.secondary }}>
            Gespeicherte Anmeldung: {saved.username}. Mit Gesicht, Fingerabdruck oder Gerätecode bestätigen.
          </Text>
          <LiquidButton
            label="Gespeicherte Anmeldung entfernen"
            variant="secondary"
            disabled={busy || working}
            onPress={() => {
              void forgetRememberedPortalLogin(kind, saved.accountId)
                .then(() => setSaved(null))
                .catch(() => setError('Entfernen fehlgeschlagen. Bitte erneut versuchen.'));
            }}
          />
        </>
      ) : null}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: remember, disabled: busy }}
        disabled={busy}
        onPress={() => onRememberChange(!remember)}
        style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 8 }}
      >
        <Text style={{ color: portalPremium.text.primary, fontSize: 16, lineHeight: 24 }}>
          {remember ? '☑' : '☐'} Anmeldung auf diesem Gerät geschützt speichern
        </Text>
      </Pressable>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: '#9D2424' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
