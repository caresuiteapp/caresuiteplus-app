import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { AccessShell } from '@/liquid-command/screens/AccessScreens';
import { LiquidButton, LiquidField, LiquidState, LiquidSurface } from '@/liquid-command/components/LiquidPrimitives';
import { completeBusinessPasswordReset, requestBusinessPasswordReset } from '@/lib/auth/passwordResetService.native';
import { extractNativeBusinessRecoveryToken } from '@/lib/auth/businessRecoveryToken';
import { signOut } from '@/lib/supabase/authService';

export function NativeBusinessPasswordRecoveryScreen() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const lock = useRef(false);
  const submit = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); setSuccess(''); try { const result = await requestBusinessPasswordReset(email); if (!result.ok) setError(result.error); else setSuccess(result.data.message); } catch { setError('Die Anfrage konnte nicht bestätigt werden. Bitte erneut versuchen.'); } finally { lock.current = false; setBusy(false); } };
  return <AccessShell eyebrow="VERWALTUNG · WIEDERHERSTELLUNG" title="Zugang sicher wiederherstellen" subtitle="Ein einmaliger Rücksetz-Link für Ihr aktives Verwaltungskonto. Portalzugänge werden durch die zuständige Verwaltung betreut." backRoute="/auth/business-login" backDisabled={busy}>
    <LiquidSurface active><View style={{ gap: 18 }}>{error ? <LiquidState kind="error" title="Versand nicht bestätigt" message={error} /> : null}{success ? <LiquidState kind="success" title="E-Mail geprüft" message={success} /> : null}
      <LiquidField label="Verwaltungs-E-Mail" value={email} onChangeText={value => { if (!lock.current) setEmail(value); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" required />
      <LiquidButton label={busy ? 'Link wird angefordert …' : 'Rücksetz-Link anfordern'} disabled={busy} loading={busy} onPress={() => void submit()} />
      <LiquidButton label="Rücksetz-Link aus E-Mail in der App öffnen" variant="secondary" disabled={busy} onPress={() => router.push('/auth/reset-password')} />
      <LiquidButton label="Ohne Anmeldung ein Support-Ticket einreichen" variant="ghost" disabled={busy} onPress={() => router.push('/support')} />
    </View></LiquidSurface>
  </AccessShell>;
}

export function NativeBusinessPasswordResetScreen() {
  const router = useRouter(); const url = Linking.useURL(); const [link, setLink] = useState(''); const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [completed, setCompleted] = useState(false); const lock = useRef(false);
  useEffect(() => { if (!url || lock.current || completed) return; const value = extractNativeBusinessRecoveryToken(url); if (value) { setToken(value); setLink(''); } }, [url, completed]);
  const capture = () => { const value = extractNativeBusinessRecoveryToken(link); if (!value) { setError('Kein gültiger CareSuite-Rücksetz-Link erkannt. Bitte den vollständigen Link aus der Systemmail einfügen.'); return; } setToken(value); setLink(''); setError(''); };
  const submit = async () => {
    if (lock.current || !token) return; lock.current = true; setBusy(true); setError('');
    try { const result = await completeBusinessPasswordReset(token, password, confirm); if (!result.ok) { setError(result.error); return; } setPassword(''); setConfirm(''); setToken(null); setCompleted(true); const session = await signOut().catch(() => ({ ok: false })); if (!session.ok) setError('Ihr Passwort wurde gespeichert. Die lokale Sitzung konnte noch nicht abgemeldet werden. Bitte schließen Sie die App und melden Sie sich erneut an.'); }
    catch { setError('Die Änderung konnte nicht bestätigt werden. Bitte fordern Sie einen neuen Link an.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <AccessShell eyebrow="VERWALTUNG · NEUES PASSWORT" title="Ihr Zugang bleibt Ihrer" subtitle="Der Rücksetz-Link gilt ausschließlich für Ihr Verwaltungskonto. Ein neues Passwort muss 10 bis 128 Zeichen haben." backRoute="/auth/business-login" backDisabled={busy}>
    <LiquidSurface active><View style={{ gap: 18 }}>
      {error ? <LiquidState kind="error" title="Wiederherstellung nicht bestätigt" message={error} /> : null}
      {completed ? <><LiquidState kind="success" title="Passwort geändert" message="Ihr neues Verwaltungspasswort wurde gespeichert. Melden Sie sich damit erneut an." /><LiquidButton label="Zur Verwaltungsanmeldung" onPress={() => router.replace('/auth/business-login')} /></> : token ? <>
        <LiquidField label="Neues Passwort" secureTextEntry value={password} onChangeText={value => { if (!lock.current) setPassword(value); }} maxLength={128} required />
        <LiquidField label="Passwort bestätigen" secureTextEntry value={confirm} onChangeText={value => { if (!lock.current) setConfirm(value); }} maxLength={128} required />
        <LiquidButton label={busy ? 'Passwort wird gespeichert …' : 'Neues Passwort speichern'} disabled={busy} loading={busy} onPress={() => void submit()} />
      </> : <><Text style={{ fontSize: 16, lineHeight: 25, color: '#36546f' }}>Öffnen Sie den App-Link aus Ihrer Systemmail. Falls Ihr Mailprogramm den Link nicht öffnet, können Sie ihn hier einfügen. Der Link wird nicht gespeichert.</Text><LiquidField label="Rücksetz-Link aus Systemmail" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} secureTextEntry maxLength={2048} /><LiquidButton label="Link in der App übernehmen" onPress={capture} /><LiquidButton label="Neuen Link anfordern" variant="secondary" onPress={() => router.push('/auth/forgot-password')} /></>}
    </View></LiquidSurface>
  </AccessShell>;
}
