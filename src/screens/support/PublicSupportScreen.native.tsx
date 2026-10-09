import { useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { AccessShell } from '@/liquid-command/screens/AccessScreens';
import { LiquidButton, LiquidField, LiquidSurface } from '@/liquid-command/components/LiquidPrimitives';
import { submitPublicSupportTicket, type PublicSupportInput } from '@/lib/support/publicSupportService';
import { SUPPORT_LINKS } from '@/lib/platform/supportLinks';
const initial = { name: '', email: '', organization: '', subject: '', category: 'technical' as PublicSupportInput['category'], message: '', privacyAccepted: false, website: '' };
export default function PublicSupportScreen() {
  const router = useRouter(); const [form, setForm] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [receipt, setReceipt] = useState('');
  const nonce = useRef(Crypto.randomUUID()); const lock = useRef(false);
  const update = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) => { if (lock.current) return; nonce.current = Crypto.randomUUID(); setForm(current => ({ ...current, [key]: value })); };
  const submit = async () => {
    if (lock.current) return;
    if (form.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.subject.trim().length < 3 || form.message.trim().length < 20 || !form.privacyAccepted) { setError('Bitte Name, gültige E-Mail-Adresse, Betreff und mindestens 20 Zeichen Nachricht eingeben und die Datenschutzhinweise bestätigen.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { const result = await submitPublicSupportTicket({ ...form, nonce: nonce.current }); if (!result.ok) { setError(result.error); return; } setReceipt(result.data.reference); setForm(initial); }
    catch { setError('Der Eingang konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte erneut versuchen.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <AccessShell eyebrow="SUPPORT & HILFE" title={receipt ? 'Ihr Ticket ist eingegangen' : 'Wie können wir Ihnen helfen?'} subtitle="Kontakt zum CareSuite-Support" backRoute="/" backDisabled={busy}>
    <LiquidSurface active>
      <View style={{ gap: 18 }}>
        {receipt ? <><Text selectable style={{ fontSize: 22, lineHeight: 32, color: '#153855', fontWeight: '700' }}>Ihre Ticketnummer: {receipt}</Text><Text style={{ fontSize: 16, lineHeight: 25, color: '#36546f' }}>Bewahren Sie diese Nummer für Rückfragen auf. Unser Support meldet sich über die angegebene E-Mail-Adresse.</Text><LiquidButton label="Weitere Anfrage einreichen" onPress={() => { setReceipt(''); nonce.current = Crypto.randomUUID(); }} /></> : <>
          <Text style={{ fontSize: 16, lineHeight: 25, color: '#36546f' }}>Pflichtfelder sind mit * markiert. Für Probleme mit der Anmeldung wählen Sie „Zugang & Anmeldung“.</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: '#9c1936', fontSize: 16, lineHeight: 24 }}>{error}</Text> : null}
          <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 18 }}>
            <LiquidField label="Ihr Name" required value={form.name} onChangeText={value => update('name', value)} maxLength={100} autoComplete="name" />
            <LiquidField label="Ihre E-Mail-Adresse" required value={form.email} onChangeText={value => update('email', value)} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <LiquidField label="Unternehmen / Organisation" value={form.organization} onChangeText={value => update('organization', value)} maxLength={200} />
            <Text style={{ fontSize: 16, lineHeight: 24, color: '#153855', fontWeight: '600' }}>Thema *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{([{ key: 'technical', label: 'Technisches Problem' }, { key: 'account', label: 'Zugang & Anmeldung' }, { key: 'general', label: 'Allgemeine Frage' }] as const).map(item => <LiquidButton key={item.key} label={`${item.key === form.category ? '✓ ' : ''}${item.label}`} variant={item.key === form.category ? 'primary' : 'secondary'} onPress={() => update('category', item.key)} />)}</View>
            <LiquidField label="Betreff" required value={form.subject} onChangeText={value => update('subject', value)} maxLength={180} />
            <LiquidField label="Was können wir für Sie tun?" required value={form.message} onChangeText={value => update('message', value)} maxLength={6000} multiline hint={`Mindestens 20 Zeichen · ${form.message.length}/6000. Bitte keine Passwörter, Gesundheitsdaten oder Klientenunterlagen einfügen.`} />
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.privacyAccepted, disabled: busy }} disabled={busy} onPress={() => update('privacyAccepted', !form.privacyAccepted)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', minHeight: 48, paddingVertical: 12 }}><Text style={{ fontSize: 25, color: '#1266cb' }}>{form.privacyAccepted ? '☑' : '☐'}</Text><Text style={{ flex: 1, fontSize: 16, lineHeight: 25, color: '#153855' }}>Ich habe die Datenschutzhinweise zur Bearbeitung meiner Anfrage gelesen. *</Text></Pressable>
            <LiquidButton label="Datenschutzhinweise lesen" variant="ghost" onPress={() => router.push('/datenschutz')} />
          </View>
          <LiquidButton label={busy ? 'Ticket wird eingereicht …' : 'Support-Ticket einreichen'} disabled={busy} onPress={() => void submit()} />
          <LiquidButton label="Zur Verwaltungsanmeldung" variant="secondary" disabled={busy} onPress={() => router.push('/auth/business-login')} />
        </>}
      </View>
    </LiquidSurface>
  </AccessShell>;
}
