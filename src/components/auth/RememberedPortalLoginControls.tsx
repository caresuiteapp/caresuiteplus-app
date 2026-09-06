import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PremiumButton } from '@/components/ui';
import { portalPremium } from '@/design/tokens/portalPremium';
import { getRememberedPortalMetadata, unlockRememberedPortalLogin, forgetRememberedPortalLogin, supportsRememberedPortalLogin, type RememberedPortalKind, type RememberedPortalLogin, type RememberedPortalMetadata } from '@/lib/auth/rememberedPortalLogin';

export function RememberedPortalLoginControls({ kind, remember, onRememberChange, onLogin, busy }: {
  kind: RememberedPortalKind; remember: boolean; onRememberChange: (value: boolean) => void;
  onLogin: (login: RememberedPortalLogin) => Promise<void>; busy: boolean;
}) {
  const [saved, setSaved] = useState<RememberedPortalMetadata | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void getRememberedPortalMetadata(kind).then(value => { if (active) setSaved(value); }).catch(() => { if (active) setError('Gespeicherte Anmeldung konnte nicht gelesen werden. Sie können sich normal anmelden.'); });
    return () => { active = false; };
  }, [kind]);
  if (!supportsRememberedPortalLogin()) return null;
  const unlock = async () => {
    if (busy || lock.current) return;
    lock.current = true; setWorking(true); setError(null);
    try { await onLogin(await unlockRememberedPortalLogin(kind)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Bitte normal anmelden.'); }
    finally { lock.current = false; setWorking(false); }
  };
  return <View style={{ gap: 8 }}>
    {saved ? <>
      <PremiumButton title={`Gespeicherte Anmeldung: ${saved.username}`} variant="secondary" onPress={() => void unlock()} loading={working} disabled={busy} fullWidth />
      <Text style={{ color: portalPremium.text.secondary }}>Mit Gesicht, Fingerabdruck oder Gerätecode bestätigen.</Text>
      <PremiumButton title="Gespeicherte Anmeldung entfernen" variant="secondary" disabled={busy || working} onPress={() => { void forgetRememberedPortalLogin(kind).then(() => setSaved(null)).catch(() => setError('Entfernen fehlgeschlagen. Bitte erneut versuchen.')); }} />
    </> : null}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember, disabled: busy }} disabled={busy} onPress={() => onRememberChange(!remember)} style={{ minHeight: 48, justifyContent: 'center', paddingVertical: 8 }}>
      <Text style={{ color: portalPremium.text.primary, fontSize: 16, lineHeight: 24 }}>{remember ? '☑' : '☐'} Anmeldung auf diesem Gerät geschützt speichern</Text>
    </Pressable>
    {error ? <Text accessibilityLiveRegion="polite" style={{ color: '#9D2424' }}>{error}</Text> : null}
  </View>;
}
