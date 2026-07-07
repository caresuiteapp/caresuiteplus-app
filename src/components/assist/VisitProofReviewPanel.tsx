import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DetailInfoRow } from '@/components/detail';
import { VisitProofPdfPreviewPanel } from '@/components/assist/VisitProofPdfPreviewPanel';
import {
  EmptyState,
  FilterChipGroup,
  InfoBanner,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import type { RoleKey } from '@/types';
import type { AssistVisitProofRow } from '@/types/assistExecutionPersistence';
import {
  ASSIST_PROOF_PORTAL_RELEASE_LABELS,
  ASSIST_PROOF_STATUS_LABELS,
} from '@/lib/assist/assistProofLabels';
import {
  approveAndReleaseAssistProof,
  approveAssistProof,
  rejectAssistProof,
  releaseAssistProofToPortal,
  revokeAssistProofPortalRelease,
  submitProofForReview,
} from '@/lib/assist/assistProofApprovalService';
import {
  buildVisitProofPreviewFromProof,
  proofHasClientSignature,
} from '@/lib/assist/visitProofSnapshotPreviewService';
import {
  downloadAssistProofPdfInBrowser,
  generateAssistProofPdf,
} from '@/lib/assist/assistProofPdfService';
import { useVisitProofReviewPreview } from '@/hooks/useVisitProofReviewPreview';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type VisitProofReviewPanelProps = {
  proof: AssistVisitProofRow;
  tenantId: string;
  actorProfileId?: string | null;
  actorRoleKey?: RoleKey | null;
  onUpdated?: () => void;
};

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'Alle' },
  { key: 'draft', label: 'Entwurf' },
  { key: 'pending_review', label: 'Prüfung' },
  { key: 'approved', label: 'Freigegeben' },
  { key: 'exported', label: 'Exportiert' },
  { key: 'rejected', label: 'Abgelehnt' },
] as const;

export { STATUS_FILTER_OPTIONS as VISIT_PROOF_STATUS_FILTER_OPTIONS };

export function VisitProofReviewPanel({
  proof,
  tenantId,
  actorProfileId,
  actorRoleKey,
  onUpdated,
}: VisitProofReviewPanelProps) {
  const text = useAuroraAdaptiveText();
  const snapshotPreview = useMemo(() => buildVisitProofPreviewFromProof(proof), [proof]);
  const {
    preview: enrichedPreview,
    loading: previewLoading,
    error: previewError,
  } = useVisitProofReviewPreview(tenantId, proof);
  const preview = enrichedPreview ?? snapshotPreview;
  const pdfEnrichment = useMemo(
    () => ({
      employeeName: preview?.employeeName,
      serviceName: preview?.serviceName,
      location: preview?.location,
      scheduledStart: preview?.scheduledStart,
      scheduledEnd: preview?.scheduledEnd,
      documentationNote: preview?.documentationNote,
      visitTimes: preview?.visitTimes ?? null,
      signatureImageUrl: preview?.signatureImageUrl ?? null,
      signature: preview?.signature ?? null,
      tasks: preview?.tasks,
    }),
    [preview],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const snapshot = proof.payloadSnapshot ?? {};
  const clientName = preview?.clientName ?? String(snapshot.clientName ?? '—');
  const employeeName = preview?.employeeName ?? String(snapshot.employeeName ?? '—');
  const serviceName =
    preview?.serviceName ??
    String(snapshot.serviceName ?? snapshot.title ?? 'Leistungsnachweis');
  const hasSignature = preview ? !preview.fields.find((f) => f.label === 'Unterschrift')?.missing : proofHasClientSignature(proof);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        header: { gap: spacing.xs, marginBottom: spacing.sm },
        title: { ...typography.h3, color: text.primary },
        actions: { gap: spacing.sm, marginTop: spacing.md },
        row: { gap: spacing.xs },
      }),
    [text],
  );

  const runAction = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Aktion fehlgeschlagen.');
      return;
    }
    onUpdated?.();
  };

  return (
    <SectionPanel
      title={serviceName}
      subtitle={`Nachweis ${proof.proofNumber ?? proof.id.slice(0, 8)} · ${ASSIST_PROOF_STATUS_LABELS[proof.status]}`}
    >
      {error ? <InfoBanner variant="danger" title="Fehler" message={error} /> : null}

      <View style={styles.header}>
        <Text style={styles.title}>{clientName}</Text>
        <PremiumBadge
          label={ASSIST_PROOF_STATUS_LABELS[proof.status]}
          variant={proof.status === 'approved' || proof.status === 'exported' ? 'green' : 'orange'}
          dot
        />
        <PremiumBadge
          label={ASSIST_PROOF_PORTAL_RELEASE_LABELS[proof.portalReleaseStatus]}
          variant={proof.portalVisible ? 'green' : 'orange'}
        />
      </View>

      <View style={styles.row}>
        <DetailInfoRow label="Mitarbeitende:r" value={employeeName} />
        <DetailInfoRow label="Visit-ID" value={proof.visitId} />
        <DetailInfoRow
          label="Portal"
          value={
            proof.portalVisible
              ? `Veröffentlicht · ${proof.releasedToPortalAt ?? '—'}`
              : 'Nicht veröffentlicht'
          }
        />
        {proof.rejectionReason ? (
          <DetailInfoRow label="Ablehnungsgrund" value={proof.rejectionReason} />
        ) : null}
        {proof.approvalNote ? <DetailInfoRow label="Freigabe-Notiz" value={proof.approvalNote} /> : null}
      </View>

      {previewError ? (
        <InfoBanner
          variant="warning"
          title="Vorschau ergänzen fehlgeschlagen"
          message={`${previewError} — Snapshot-Daten werden angezeigt.`}
        />
      ) : null}

      <VisitProofPdfPreviewPanel
        tenantId={tenantId}
        proof={proof}
        enrichment={pdfEnrichment}
        htmlPreview={preview}
        htmlPreviewLoading={previewLoading && !enrichedPreview}
      />

      {(proof.status === 'pending_review' || proof.status === 'rejected') && (
        <PremiumInput
          label="Freigabe-Notiz (optional)"
          value={approvalNote}
          onChangeText={setApprovalNote}
          editable={!busy}
        />
      )}

      {proof.status === 'pending_review' && (
        <PremiumInput
          label="Ablehnungsgrund"
          value={rejectionReason}
          onChangeText={setRejectionReason}
          editable={!busy}
        />
      )}

      <View style={styles.actions}>
        {(proof.status === 'draft' || proof.status === 'rejected') && (
          <PremiumButton
            title="Zur Prüfung einreichen"
            disabled={busy}
            onPress={() =>
              runAction(() =>
                submitProofForReview(tenantId, proof.id, actorProfileId, actorRoleKey),
              )
            }
          />
        )}

        {proof.status === 'pending_review' && (
          <>
            <PremiumButton
              title="Freigeben (ohne Portal)"
              disabled={busy}
              onPress={() =>
                runAction(() =>
                  approveAssistProof(
                    tenantId,
                    proof.id,
                    actorProfileId,
                    actorRoleKey,
                    approvalNote,
                  ),
                )
              }
            />
            {hasSignature ? (
              <PremiumButton
                title="Freigeben & ins Portal veröffentlichen"
                disabled={busy}
                onPress={() =>
                  runAction(() =>
                    approveAndReleaseAssistProof(
                      tenantId,
                      proof.id,
                      actorProfileId,
                      actorRoleKey,
                      { approvalNote, releaseMode: 'full' },
                    ),
                  )
                }
              />
            ) : (
              <PremiumButton
                title="Eingeschränkt freigeben (Klient:in unterschreibt)"
                disabled={busy}
                onPress={() =>
                  runAction(() =>
                    approveAndReleaseAssistProof(
                      tenantId,
                      proof.id,
                      actorProfileId,
                      actorRoleKey,
                      { approvalNote, releaseMode: 'restricted' },
                    ),
                  )
                }
              />
            )}
            <PremiumButton
              title="Ablehnen"
              variant="secondary"
              disabled={busy || !rejectionReason.trim()}
              onPress={() =>
                runAction(() =>
                  rejectAssistProof(
                    tenantId,
                    proof.id,
                    rejectionReason,
                    actorProfileId,
                    actorRoleKey,
                  ),
                )
              }
            />
          </>
        )}

        {(proof.status === 'approved' || proof.status === 'exported') && (
          <>
            <PremiumButton
              title={proof.pdfStoragePath ? 'PDF erneut erzeugen' : 'PDF erzeugen'}
              disabled={busy}
              onPress={() => runAction(() => generateAssistProofPdf(tenantId, proof.id, pdfEnrichment))}
            />
            <PremiumButton
              title="PDF herunterladen"
              variant="secondary"
              disabled={busy}
              onPress={() => runAction(() => downloadAssistProofPdfInBrowser(tenantId, proof.id, pdfEnrichment))}
            />
          </>
        )}

        {(proof.status === 'approved' || proof.status === 'exported') && !proof.portalVisible && (
          <>
            <PremiumButton
              title={
                hasSignature
                  ? 'Ins Klientenportal freigeben'
                  : 'Eingeschränkt ins Portal (Unterschrift ausstehend)'
              }
              disabled={busy}
              onPress={() =>
                runAction(() =>
                  releaseAssistProofToPortal(
                    tenantId,
                    proof.id,
                    actorProfileId,
                    actorRoleKey,
                    hasSignature ? 'full' : 'restricted',
                  ),
                )
              }
            />
          </>
        )}

        {proof.portalVisible &&
          (proof.portalReleaseStatus === 'released' ||
            proof.portalReleaseStatus === 'pending_client_signature') && (
          <PremiumButton
            title="Portal-Freigabe zurückziehen"
            variant="secondary"
            disabled={busy}
            onPress={() =>
              runAction(() =>
                revokeAssistProofPortalRelease(tenantId, proof.id, actorProfileId, actorRoleKey),
              )
            }
          />
        )}
      </View>
    </SectionPanel>
  );
}

type VisitProofReviewListProps = {
  items: AssistVisitProofRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function VisitProofReviewList({ items, selectedId, onSelect }: VisitProofReviewListProps) {
  const text = useAuroraAdaptiveText();

  if (items.length === 0) {
    return (
      <EmptyState
        title="Keine Nachweise"
        message="Es liegen keine Leistungsnachweise zur Prüfung vor."
      />
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((proof) => {
        const snapshot = proof.payloadSnapshot ?? {};
        const clientName = String(snapshot.clientName ?? '—');
        const selected = selectedId === proof.id;
        return (
          <Pressable key={proof.id} onPress={() => onSelect(proof.id)}>
            <View
              style={{
                padding: spacing.md,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selected ? '#62F3FF' : 'rgba(255,255,255,0.12)',
                backgroundColor: selected ? 'rgba(98,243,255,0.08)' : 'rgba(255,255,255,0.04)',
                gap: spacing.xs,
              }}
            >
              <Text style={{ ...typography.body, fontWeight: '600', color: text.primary }}>{clientName}</Text>
              <Text style={{ color: text.secondary }}>
                {ASSIST_PROOF_STATUS_LABELS[proof.status]} ·{' '}
                {String(snapshot.serviceName ?? snapshot.title ?? 'Leistungsnachweis')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function VisitProofStatusFilterBar(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterChipGroup
      options={STATUS_FILTER_OPTIONS.map((option) => ({ key: option.key, label: option.label }))}
      value={props.value}
      onChange={props.onChange}
    />
  );
}
