import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { PremiumButton } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { enrollMfaFactor, readMfaFactors, verifyMfaFactor } from '@/lib/auth/accountSecurityService';
import { accountSecurityStyles as styles } from './accountSecurityStyles';
const message = (error: unknown) => error instanceof Error ? error.message : 'Die Aktion konnte nicht bestätigt werden. Bitte erneut versuchen.';

export function MfaSettingsCard({ required = false, onVerified }: { required?: boolean; onVerified?: () => void }) {
  const { user } = useAuth();
  return user ? <MfaContent key={user.id} userId={user.id} required={required} onVerified={onVerified} /> : null;
}
function MfaContent({ userId, required, onVerified }: { userId: string; required: boolean; onVerified?: () => void }) {
  const { width } = useWindowDimensions();
  const qrSize = Math.max(120, Math.min(200, width - 140));
  const active = useRef(true), lock = useRef(false);
  const [factors, setFactors] = useState<Awaited<ReturnType<typeof readMfaFactors>>>([]);
  const [selectedFactorId, setSelectedFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Awaited<ReturnType<typeof enrollMfaFactor>> | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const value = await readMfaFactors(userId); if (active.current) { setFactors(value); setSelectedFactorId(previous => value.some(factor => factor.id === previous) ? previous : value[0]?.id ?? null); setError(null); } }
    catch (cause) { if (active.current) setError(message(cause)); }
  }, [userId]);
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; }; }, [refresh]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null); setFeedback(null);
    try { await action(); } catch (cause) { if (active.current) setError(message(cause)); }
    finally { lock.current = false; if (active.current) setBusy(false); }
  };
  return <View style={styles.card}>
    <Text style={styles.title}>Zusätzliche Anmeldesicherheit</Text>
    <Text style={styles.text}>{required
      ? 'Für diesen Zugang ist eine zusätzliche Bestätigung mit einer Authenticator-App erforderlich.'
      : 'Schützen Sie Ihre Anmeldung zusätzlich mit einem sechsstelligen Authenticator-Code. Gesicht oder Fingerabdruck entsperren das Gerät und ersetzen diesen Kontoschutz nicht.'}</Text>
    <Text style={styles.label}>{factors.length ? `${factors.length} bestätigte Authenticator-Verknüpfung${factors.length === 1 ? '' : 'en'}` : 'Noch kein Authenticator bestätigt'}</Text>
    {!enrollment && factors.length > 1 ? <View style={styles.stack}>
      <Text style={styles.label}>Authenticator auswählen</Text>
      {factors.map((factor, index) => <PremiumButton key={factor.id}
        title={`${factor.friendly_name || `Authenticator ${index + 1}`}${selectedFactorId === factor.id ? ' · Ausgewählt' : ''}`}
        variant={selectedFactorId === factor.id ? 'primary' : 'secondary'} disabled={busy} onPress={() => setSelectedFactorId(factor.id)} />)}
    </View> : null}
    {enrollment ? <View style={styles.stack}>
      <Text style={styles.text}>Scannen Sie den QR-Code mit Ihrer Authenticator-App oder übernehmen Sie den Einrichtungsschlüssel. Geben Sie anschließend den dort angezeigten Code ein.</Text>
      <View style={styles.qr}><SvgXml xml={enrollment.totp.qr_code} width={qrSize} height={qrSize} /></View>
      <Text selectable style={styles.secret} accessibilityLabel="Authenticator-Einrichtungsschlüssel">{enrollment.totp.secret.match(/.{1,4}/g)?.join(' ')}</Text>
    </View> : <PremiumButton title={factors.length ? 'Zweiten Authenticator als Absicherung einrichten' : 'Authenticator einrichten'} variant="secondary" loading={busy} onPress={() => void run(async () => {
      const result = await enrollMfaFactor(userId); if (active.current) { setEnrollment(result); setCode(''); }
    })} />}
    {(enrollment || factors.length > 0) ? <View style={styles.stack}>
      <TextInput accessibilityLabel="Sechsstelliger Authenticator-Code" placeholder="Sechsstelliger Code" value={code}
        onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code"
        textContentType="oneTimeCode" maxLength={6} style={styles.input} editable={!busy} />
      <PremiumButton title="Authenticator-Code bestätigen" loading={busy} disabled={code.length !== 6} onPress={() => void run(async () => {
        await verifyMfaFactor(userId, enrollment?.id ?? selectedFactorId ?? factors[0]!.id, code);
        if (!active.current) return;
        setEnrollment(null); setCode(''); setFeedback('Zusätzliche Anmeldung bestätigt.'); await refresh(); onVerified?.();
      })} />
    </View> : null}
    {!enrollment && factors.length > 0 ? <Text style={styles.text}>Eine zweite Verknüpfung auf einem getrennten Gerät hilft, wenn der erste Authenticator verloren geht.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {feedback ? <Text accessibilityLiveRegion="polite" style={styles.text}>{feedback}</Text> : null}
  </View>;
}

