import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { ScreenShell } from '@/components/layout';
import { ErrorState, LoadingState, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import { fetchPflegeServiceProofs, advancePflegeServiceProof } from '@/lib/pflege/careBillingLiveService';
import { capturePflegeProofSignature, fetchPflegeProofSignature } from '@/lib/pflege/careTourPlanningService';
import { formatDate, formatTime } from '@/lib/formatters/dateTimeFormatters';
import { downloadCareProofPdf } from '@/lib/pflege/careProofPdfService';
const labels: Record<string, string> = { draft: 'Entwurf', submitted: 'Eingereicht', signed: 'Unterschrieben', approved: 'Freigegeben', rejected: 'Zurückgewiesen', cancelled: 'Storniert' };

export function PflegeProofWorkflowScreen() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  return <PflegeProofWorkflow key={`${tenantId}:${profile?.id}:${id}`} id={id} />;
}
function PflegeProofWorkflow({ id }: { id: string }) {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { c } = useCareLightPalette();
  const router = useRouter();
  const query = useAsyncQuery(() => tenantId ? fetchPflegeServiceProofs(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey, id], { enabled: !!tenantId, queryKey: `${tenantId}:${profile?.id}:${id}` });
  const proof = query.data?.find((p) => p.id === id);
  const signature = useAsyncQuery(() => tenantId ? fetchPflegeProofSignature(tenantId, id, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.roleKey, id, proof?.status], { enabled: !!tenantId && ['signed', 'approved', 'rejected'].includes(proof?.status ?? ''), queryKey: `${tenantId}:${profile?.id}:${id}:signature` });
  const [signer, setSigner] = useState('');
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const lock = useRef(false);
  async function execute(action: 'submit' | 'approve' | 'reject') {
    if (!tenantId || lock.current) return;
    lock.current = true; setBusy(true); setError(null); setSuccess(null);
    try {
      const result = await advancePflegeServiceProof(tenantId, profile?.roleKey, id, action, { reason });
      if (!result.ok) { setError(result.error); return; }
      setSuccess('Prüfentscheidung und Verlauf gespeichert.'); await query.refresh();
    } catch { setError('Verbindung unterbrochen. Bitte den Nachweis erneut laden.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function confirmSignature(dataUrl: string) {
    if (!tenantId || lock.current) return;
    lock.current = true; setBusy(true); setError(null); setSuccess(null);
    try {
      const result = await capturePflegeProofSignature(tenantId, id, signer, dataUrl, profile?.roleKey);
      if (!result.ok) { setError(result.error); throw new Error(result.error); }
      setSignatureOpen(false); setSuccess('Unterschrift und Leistungsnachweis wurden gemeinsam gespeichert.'); await query.refresh();
    } finally { lock.current = false; setBusy(false); }
  }
  if (query.loading && !proof) return <ScreenShell title="Leistungsnachweis"><LoadingState message="Nachweis wird geladen…" /></ScreenShell>;
  if (!proof) return <ScreenShell title="Leistungsnachweis"><ErrorState message={query.error ?? 'Nachweis nicht gefunden.'} onRetry={query.refresh} /></ScreenShell>;
  const unsigned = proof.status === 'draft' || proof.status === 'submitted';
  return <ScreenShell title="Leistungsnachweis" subtitle={`${proof.clientName} · ${labels[proof.status] ?? proof.status}`}>
    <View style={styles.stack}>
      <PremiumButton title="Leistungsnachweis als PDF herunterladen" variant="secondary" disabled={busy || signature.loading || (['signed', 'approved'].includes(proof.status) && !signature.data)} onPress={() => {
        if (lock.current) return; lock.current = true; setBusy(true); setError(null);
        void downloadCareProofPdf(proof, signature.data ?? null).catch((err: unknown) => setError(err instanceof Error ? err.message : 'PDF konnte nicht erstellt werden.')).finally(() => { lock.current = false; setBusy(false); });
      }} />
      <SectionPanel title={proof.serviceLabel}>
        <Text style={{ color: c.text }}>{formatDate(proof.serviceDate)} · {formatTime(proof.startedAt)}–{formatTime(proof.endedAt)} · {proof.durationMinutes} Minuten</Text>
        <Text style={{ color: c.text }}>{proof.serviceCode} · {proof.legalBasis.toUpperCase().replace('_', ' ')} · {(proof.grossAmountCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</Text>
        <Text style={{ color: c.text }}>{proof.performanceNote}</Text>
        <Text style={{ color: c.muted }}>Kostenträger: {proof.costCarrierName || 'Privat'} · Erfasst von: {proof.employeeName}</Text>
        {proof.clientSignatureName ? <Text style={{ color: c.text }}>Unterschrieben von: {proof.clientSignatureName}</Text> : null}
        {proof.rejectionReason ? <ErrorState message={proof.rejectionReason} /> : null}
      </SectionPanel>
      {signature.data ? <SectionPanel title="Erfasste Unterschrift"><Image accessibilityLabel={`Unterschrift von ${signature.data.signerName}`} source={{ uri: signature.data.dataUrl }} style={styles.signature} resizeMode="contain" /><Text style={{ color: c.muted }}>{signature.data.signerName} · {formatDate(signature.data.capturedAt)} · {formatTime(signature.data.capturedAt)}</Text></SectionPanel> : null}
      {signature.error ? <ErrorState message={signature.error} onRetry={signature.refresh} /> : null}
      {query.refreshError ? <ErrorState message={query.refreshError} onRetry={query.refresh} /> : null}
      {error ? <ErrorState message={error} /> : null}
      {success ? <Text accessibilityRole="alert" style={{ color: c.text }}>{success}</Text> : null}
      {proof.status === 'draft' && hasPermission(profile?.roleKey, 'pflege.proofs.create') ? <PremiumButton title="Zur Prüfung einreichen" loading={busy} disabled={busy} onPress={() => void execute('submit')} /> : null}
      {unsigned && hasPermission(profile?.roleKey, 'pflege.proofs.sign') ? <SectionPanel title="Unterschrift erfassen">
        <PremiumInput label="Name der unterzeichnenden Person" value={signer} onChangeText={setSigner} />
        <Text style={{ color: c.muted }}>Die unterzeichnende Person bestätigt die aufgeführten Leistungen mit ihrer Unterschrift.</Text>
        <PremiumButton title="Unterschrift im Vollbild erfassen" disabled={busy || !signer.trim()} onPress={() => setSignatureOpen(true)} />
      </SectionPanel> : null}
      {proof.status === 'signed' && hasPermission(profile?.roleKey, 'pflege.proofs.review') ? <SectionPanel title="Fachliche Prüfung durch zweite Person">
        <Text style={{ color: c.muted }}>Leistung, Zeiten, Kostenträger und Verordnungsbezug vor der Freigabe prüfen. Eigene Nachweise dürfen nicht selbst freigegeben werden.</Text>
        <PremiumInput label="Begründung bei Zurückweisung" value={reason} onChangeText={setReason} multiline />
        <View style={styles.actions}><PremiumButton title="Nachweis freigeben" loading={busy} disabled={busy} onPress={() => void execute('approve')} /><PremiumButton title="Begründet zurückweisen" variant="secondary" disabled={busy || !reason.trim()} onPress={() => void execute('reject')} /></View>
      </SectionPanel> : null}
      {proof.status === 'approved' && hasPermission(profile?.roleKey, 'pflege.billing.view') ? <PremiumButton title="Abrechnungsfreigabe öffnen" onPress={() => router.push('/pflege/abrechnung' as never)} /> : null}
      <PremiumButton title="Zur Nachweisliste" variant="secondary" onPress={() => router.replace('/pflege/leistungsnachweise' as never)} />
    </View>
    <CareSignatureModal visible={signatureOpen} forceFullscreen label={`${proof.clientName} · ${proof.serviceLabel} · ${formatDate(proof.serviceDate)}`} dismissScope={`pflege-proof-${id}`} disabled={busy} onConfirm={confirmSignature} onClose={() => setSignatureOpen(false)} />
  </ScreenShell>;
}
const styles = StyleSheet.create({ signature: { width: '100%', height: 150, backgroundColor: '#fff', borderRadius: 12 }, stack: { gap: 16, paddingBottom: 32 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } });
