import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { hasPermission } from '@/lib/permissions';
import { advanceCareShift } from '@/lib/pflege/shiftScheduleService';
import type { ShiftScheduleListItem } from '@/lib/pflege/shiftScheduleDemo';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function ShiftScheduleActions({ item, onSaved }: { item: ShiftScheduleListItem; onSaved?: () => void | Promise<unknown> }) {
  const { profile } = useAuth(); const tenant = useServiceTenantId(); const { c } = useCareLightPalette();
  const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function run(status: 'published' | 'confirmed' | 'cancelled') {
    if (!tenant || lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const result = await advanceCareShift(tenant, item, status, reason, profile?.roleKey); if (!result.ok) setError(result.error); else await onSaved?.(); }
    catch { setError('Verbindung unterbrochen. Bitte aktualisieren.'); } finally { lock.current = false; setBusy(false); }
  }
  const writable = hasPermission(profile?.roleKey, 'pflege.plans.manage');
  return <View style={{ gap: 8, marginTop: 8 }}>
    <Text style={{ color: c.muted }}>Pause: {item.breakMinutes ?? 0} Minuten{item.breakStart ? ` ab ${item.breakStart}` : ''}</Text>
    {item.cancellationReason ? <Text style={{ color: c.text }}>Absage: {item.cancellationReason}</Text> : null}
    {error ? <ErrorState message={error} /> : null}
    {writable && ['entwurf', 'geplant', 'bestaetigt'].includes(item.status) ? <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{item.status === 'entwurf' ? <PremiumButton title="Schicht freigeben" loading={busy} disabled={busy} onPress={() => void run('published')} /> : item.status === 'geplant' ? <PremiumButton title="Planbestätigung erfassen" loading={busy} disabled={busy} onPress={() => void run('confirmed')} /> : null}</View>
      <PremiumInput label="Absagegrund" value={reason} onChangeText={setReason} editable={!busy} />
      <PremiumButton title="Schicht absagen" variant="secondary" disabled={busy || !reason.trim()} onPress={() => void run('cancelled')} />
    </> : null}
  </View>;
}
