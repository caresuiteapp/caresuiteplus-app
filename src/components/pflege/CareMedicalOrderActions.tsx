import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorState, PremiumButton, PremiumInput } from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { hasPermission } from '@/lib/permissions';
import { advanceCareMedicalOrder } from '@/lib/pflege/careClinicalCoreService';
import type { CareMedicalOrder } from '@/types/modules/pflege';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
export function CareMedicalOrderActions({ order, onSaved }: { order: CareMedicalOrder; onSaved: () => void | Promise<unknown> }) {
  const { profile } = useAuth(); const tenant = useServiceTenantId(); const { c } = useCareLightPalette();
  const [reason, setReason] = useState(''); const [reference, setReference] = useState(order.insurerApprovalReference ?? ''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function run(payload: Record<string, unknown>) {
    if (!tenant || lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const result = await advanceCareMedicalOrder(tenant, profile?.roleKey, order, { ...payload, reason, approvalReference: reference }); if (!result.ok) setError(result.error); else await onSaved(); }
    catch { setError('Verbindung unterbrochen. Bitte aktualisieren.'); } finally { lock.current = false; setBusy(false); }
  }
  if (!hasPermission(profile?.roleKey, 'pflege.orders.manage') || !['active', 'paused'].includes(order.status)) return null;
  return <View style={{ gap: 8 }}>
    <Text style={{ color: c.muted }}>Bescheid und Verordnungsänderungen mit Begründung dokumentieren.</Text>
    <PremiumInput label="Begründung / Bescheidfundstelle" value={reason} onChangeText={setReason} editable={!busy} />
    {order.insurerApprovalRequired ? <>
      <PremiumInput label="Kostenträger-Genehmigungsreferenz" value={reference} onChangeText={setReference} editable={!busy} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[['approved', 'Genehmigung erfassen'], ['rejected', 'Ablehnung erfassen'], ['pending', 'Erneute Prüfung'], ['expired', 'Genehmigung abgelaufen']].map(([approvalStatus, title]) => <PremiumButton key={approvalStatus} title={title} variant={approvalStatus === 'approved' ? 'primary' : 'secondary'} disabled={busy || !reason.trim() || (approvalStatus === 'approved' && !reference.trim())} onPress={() => void run({ action: 'approval', approvalStatus })} />)}</View>
    </> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[[order.status === 'active' ? 'paused' : 'active', order.status === 'active' ? 'Verordnung pausieren' : 'Verordnung fortsetzen'], ['completed', 'Verordnung abschließen'], ['cancelled', 'Verordnung stornieren']].map(([status, title]) => <PremiumButton key={status} title={title} variant="secondary" disabled={busy || !reason.trim()} onPress={() => void run({ action: 'status', status })} />)}</View>
    {error ? <ErrorState message={error} /> : null}
  </View>;
}
