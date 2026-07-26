import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { BodyMap3DViewer } from '@/components/pflege/bodyMap3d/BodyMap3DViewer';
import {
  PlatformConfirmModal,
  PlatformReadOnlyBanner,
  PlatformShellLayout,
  PLATFORM_COLORS,
} from '@/components/platformConsole';
import { ErrorState, LoadingState } from '@/components/ui';
import {
  approveBodyMapMedicalReview,
  listBodyMapMedicalReviews,
  platformRoleHasCapability,
  revokeBodyMapMedicalReview,
  saveBodyMapMedicalReview,
  startBodyMapMedicalReview,
} from '@/lib/platformConsole';
import { usePlatformAuth } from '@/lib/platformConsole/PlatformAuthProvider';
import {
  BODYMAP_MEDICAL_CATEGORY_LABELS,
  bodyMapVariantLabel,
  evaluateBodyMapMedicalApproval,
  getBodyMapMedicalCriteria,
  selectionFromBodyMapVariantId,
} from '@/lib/pflege/bodyMap3d/medicalReviewCatalog';
import {
  REAL_HUMAN_VISUAL_VARIANTS,
  type RealHumanVisualDefinition,
} from '@/lib/pflege/bodyMap3d/medicalMeshCatalog';
import type {
  BodyMapMedicalReviewIssue,
  BodyMapMedicalReviewResult,
  BodyMapMedicalReviewRun,
  BodyMapMedicalReviewStatus,
} from '@/types/platformConsole';
import type { BodyMapSurfacePoint } from '@/types/modules/bodyMap';
import { spacing } from '@/theme';

const STATUS_LABELS: Record<BodyMapMedicalReviewStatus | 'not_reviewed' | 'stale', string> = {
  not_reviewed: 'Nicht geprüft',
  draft: 'Entwurf',
  in_review: 'In Prüfung',
  changes_required: 'Änderungen erforderlich',
  approved: 'Freigegeben',
  revoked: 'Widerrufen',
  superseded: 'Ersetzt',
  stale: 'Asset geändert',
};

const RESULT_LABELS: Record<BodyMapMedicalReviewResult, string> = {
  pending: 'Offen',
  pass: 'Bestanden',
  minor: 'Geringe Abweichung',
  major: 'Wesentlich',
  blocker: 'Blockierend',
  not_applicable: 'Nicht anwendbar',
};

type ConfirmAction =
  | { type: 'save'; status: 'in_review' | 'changes_required' }
  | { type: 'approve' }
  | { type: 'revoke' };

function latestReviewForVariant(
  variant: RealHumanVisualDefinition,
  reviews: BodyMapMedicalReviewRun[],
) {
  return reviews
    .filter((review) => review.variantId === variant.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

function effectiveStatus(
  variant: RealHumanVisualDefinition,
  review: BodyMapMedicalReviewRun | null,
): BodyMapMedicalReviewStatus | 'not_reviewed' | 'stale' {
  if (!review) return 'not_reviewed';
  if (review.assetSha256 !== variant.assetSha256) return 'stale';
  return review.status;
}

export function PlatformBodyMapReviewScreen() {
  const { width } = useWindowDimensions();
  const { platformUser } = usePlatformAuth();
  const canWrite = platformRoleHasCapability(platformUser?.role, 'bodymap.review.write');
  const canApprove = platformRoleHasCapability(platformUser?.role, 'bodymap.review.approve');
  const [reviews, setReviews] = useState<BodyMapMedicalReviewRun[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState(
    'body-erwachsener-maennlich',
  );
  const [draft, setDraft] = useState<BodyMapMedicalReviewRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'approved' | 'issues'>('all');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [surfacePoint, setSurfacePoint] = useState<{
    zoneId: string;
    point: BodyMapSurfacePoint;
  } | null>(null);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issueSeverity, setIssueSeverity] =
    useState<BodyMapMedicalReviewIssue['severity']>('minor');
  const [viewerFocusMode, setViewerFocusMode] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listBodyMapMedicalReviews();
    if (!result.ok) setError(result.error);
    else setReviews(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedVariant =
    REAL_HUMAN_VISUAL_VARIANTS.find((variant) => variant.id === selectedVariantId) ??
    REAL_HUMAN_VISUAL_VARIANTS[0];
  const storedReview = latestReviewForVariant(selectedVariant, reviews);

  useEffect(() => {
    setDraft(storedReview ? structuredClone(storedReview) : null);
    setSurfacePoint(null);
  }, [selectedVariantId, storedReview?.id, storedReview?.updatedAt]);

  const rows = useMemo(
    () =>
      REAL_HUMAN_VISUAL_VARIANTS.filter((variant) => {
        const review = latestReviewForVariant(variant, reviews);
        const status = effectiveStatus(variant, review);
        const matchesQuery = bodyMapVariantLabel(variant.id)
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        if (!matchesQuery) return false;
        if (filter === 'approved') return status === 'approved';
        if (filter === 'open')
          return !['approved', 'revoked', 'superseded'].includes(status);
        if (filter === 'issues')
          return Boolean(review?.issues.some((issue) => issue.status === 'open'));
        return true;
      }),
    [filter, query, reviews],
  );

  const summary = useMemo(() => {
    const states = REAL_HUMAN_VISUAL_VARIANTS.map((variant) => {
      const review = latestReviewForVariant(variant, reviews);
      return { status: effectiveStatus(variant, review), review };
    });
    return {
      approved: states.filter((item) => item.status === 'approved').length,
      inReview: states.filter((item) =>
        ['draft', 'in_review', 'changes_required'].includes(item.status),
      ).length,
      stale: states.filter((item) => item.status === 'stale').length,
      openIssues: states.reduce(
        (sum, item) =>
          sum +
          (item.review?.issues.filter((issue) => issue.status === 'open').length ?? 0),
        0,
      ),
    };
  }, [reviews]);

  const criteria = getBodyMapMedicalCriteria(selectedVariant.id);
  const approval = draft
    ? evaluateBodyMapMedicalApproval(selectedVariant.id, draft.items, draft.issues)
    : { allowed: false, reasons: ['Prüfung wurde noch nicht gestartet.'], completed: 0, total: criteria.length };
  const selectedStatus = effectiveStatus(selectedVariant, draft);

  function updateItem(
    criterionId: string,
    patch: Partial<BodyMapMedicalReviewRun['items'][number]>,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.criterionId === criterionId ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
  }

  async function startReview() {
    if (selectedVariant.visualReviewStatus !== 'qa-ready') {
      setError(
        'Medizinische Prüfung gesperrt: Der Körper hat die vollständige visuelle 3D-Qualitätsprüfung noch nicht bestanden.',
      );
      return;
    }
    setSaving(true);
    const result = await startBodyMapMedicalReview({
      variantId: selectedVariant.id,
      assetPath: selectedVariant.visualAssetPath,
      assetSha256: selectedVariant.assetSha256,
      sourceCommitSha:
        process.env.EXPO_PUBLIC_GIT_COMMIT_SHA ?? 'phase12-local-build',
      reviewerName: platformUser?.fullName || platformUser?.email || '',
      reviewerQualification: '',
      reviewScope: 'Vollständige medizinische und funktionale 3D-Prüfung',
    });
    setSaving(false);
    if (!result.ok) return setError(result.error);
    setReviews((current) => [result.data, ...current]);
    setDraft(result.data);
  }

  async function executeConfirmed(reason: string) {
    if (!confirm || !draft) return;
    setSaving(true);
    let result:
      | Awaited<ReturnType<typeof saveBodyMapMedicalReview>>
      | Awaited<ReturnType<typeof approveBodyMapMedicalReview>>
      | Awaited<ReturnType<typeof revokeBodyMapMedicalReview>>;
    if (confirm.type === 'save') {
      result = await saveBodyMapMedicalReview(draft, confirm.status, reason);
    } else if (confirm.type === 'approve') {
      result = await approveBodyMapMedicalReview(
        draft,
        selectedVariant.assetSha256,
        reason,
      );
    } else {
      result = await revokeBodyMapMedicalReview(draft, reason);
    }
    setSaving(false);
    setConfirm(null);
    if (!result.ok) return setError(result.error);
    const savedReview = result.data;
    setReviews((current) => [
      savedReview,
      ...current.filter((item) => item.id !== savedReview.id),
    ]);
    setDraft(savedReview);
  }

  function addIssue() {
    if (!draft || !surfacePoint || issueTitle.trim().length < 3) return;
    const position =
      surfacePoint.point.modelPosition ?? surfacePoint.point.localPosition;
    const issue: BodyMapMedicalReviewIssue = {
      id: crypto.randomUUID(),
      anatomicalZoneId: surfacePoint.zoneId,
      viewId: null,
      severity: issueSeverity,
      status: 'open',
      title: issueTitle.trim(),
      description: issueDescription.trim(),
      surfacePoint: position,
      evidence: [],
      resolution: null,
      createdAt: new Date().toISOString(),
    };
    setDraft({ ...draft, issues: [...draft.issues, issue] });
    setIssueTitle('');
    setIssueDescription('');
    setSurfacePoint(null);
  }

  return (
    <PlatformShellLayout
      title="Bodymap-Prüfung"
      subtitle="Medizinische Einzelprüfung aller 30 Real-Human-3D-Varianten"
    >
      {!canWrite ? (
        <PlatformReadOnlyBanner message="Lesemodus — Änderungen erfordern bodymap.review.write; finale Freigaben sind ausschließlich dem Platform Owner vorbehalten." />
      ) : null}
      {loading ? (
        <LoadingState message="Medizinische Prüfmatrix wird geladen…" />
      ) : error ? (
        <ErrorState
          title="Prüfzentrum nicht verfügbar"
          message={error}
          onRetry={() => void load()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          {!viewerFocusMode ? (
            <View style={styles.kpiRow}>
              <Kpi label="Varianten" value="30" tone="neutral" />
              <Kpi label="Freigegeben" value={`${summary.approved}/30`} tone="success" />
              <Kpi label="In Prüfung" value={String(summary.inReview)} tone="warning" />
              <Kpi label="Offene Probleme" value={String(summary.openIssues)} tone="danger" />
              <Kpi label="Asset geändert" value={String(summary.stale)} tone="danger" />
            </View>
          ) : null}

          <View
            style={[
              styles.workspace,
              width < 1180 && styles.workspaceNarrow,
              viewerFocusMode && styles.workspaceFocus,
            ]}
          >
            {!viewerFocusMode ? (
            <View style={[styles.matrixPanel, width < 1180 && styles.matrixPanelNarrow]}>
              <Text style={styles.panelTitle}>Variantenmatrix</Text>
              <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder="Alter, Geschlecht oder Anatomie suchen"
                placeholderTextColor={PLATFORM_COLORS.muted}
              />
              <View style={styles.filterRow}>
                {([
                  ['all', 'Alle'],
                  ['open', 'Offen'],
                  ['approved', 'Freigegeben'],
                  ['issues', 'Probleme'],
                ] as const).map(([id, label]) => (
                  <Chip
                    key={id}
                    selected={filter === id}
                    label={label}
                    onPress={() => setFilter(id)}
                  />
                ))}
              </View>
              <ScrollView style={styles.variantList} nestedScrollEnabled>
                {rows.map((variant) => {
                  const review = latestReviewForVariant(variant, reviews);
                  const status = effectiveStatus(variant, review);
                  return (
                    <Pressable
                      key={variant.id}
                      style={[
                        styles.variantRow,
                        variant.id === selectedVariant.id && styles.variantRowActive,
                      ]}
                      onPress={() => setSelectedVariantId(variant.id)}
                    >
                      <View style={styles.variantCopy}>
                        <Text style={styles.variantName}>
                          {bodyMapVariantLabel(variant.id)}
                        </Text>
                        <Text style={styles.hash}>
                          SHA-256 {variant.assetSha256.slice(0, 12)}…
                        </Text>
                      </View>
                      <StatusPill status={status} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            ) : null}

            <View style={[styles.detailPanel, viewerFocusMode && styles.detailPanelFocus]}>
              <View style={styles.detailHeader}>
                <View style={styles.flex}>
                  <Text style={styles.title}>{bodyMapVariantLabel(selectedVariant.id)}</Text>
                  <Text style={styles.meta}>
                    {selectedVariant.vertices.toLocaleString('de-DE')} Vertices ·{' '}
                    {selectedVariant.triangles.toLocaleString('de-DE')} Dreiecke ·{' '}
                    {(selectedVariant.fileSizeBytes / 1024 / 1024).toFixed(2)} MB
                  </Text>
                  <Text selectable style={styles.fullHash}>
                    Asset SHA-256: {selectedVariant.assetSha256}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  style={styles.focusButton}
                  onPress={() => setViewerFocusMode((current) => !current)}
                >
                  <Text style={styles.focusButtonText}>
                    {viewerFocusMode ? 'Prüfzentrum anzeigen' : '3D-Großansicht'}
                  </Text>
                </Pressable>
                <StatusPill status={selectedStatus} />
              </View>

              <View style={styles.viewer}>
                <BodyMap3DViewer
                  selection={selectionFromBodyMapVariantId(selectedVariant.id)}
                  markers={[]}
                  allowTechnicalMeshPreview
                  presentationMode="review"
                  onSurfacePress={(hit) =>
                    setSurfacePoint({
                      zoneId: hit.anatomicalZoneId,
                      point: hit.surfacePoint,
                    })
                  }
                />
              </View>
              {selectedVariant.visualReviewStatus !== 'qa-ready' ? (
                <View style={styles.visualBlocker}>
                  <Text style={styles.visualBlockerTitle}>
                    Medizinische Prüfung derzeit gesperrt
                  </Text>
                  <Text style={styles.bodyText}>
                    Dieses Modell befindet sich noch im visuellen Körperaufbau. Erst
                    nach bestandener Vierseiten-, Detail-, Naht- und
                    Interaktionsprüfung wird die medizinische Prüfliste aktiviert.
                  </Text>
                </View>
              ) : null}
              <Text style={styles.hint}>
                Modell drehen und zoomen. Eine fehlerhafte Stelle direkt anklicken, um
                ein positionsgebundenes Prüfproblem anzulegen.
              </Text>

              {!draft ? (
                <View style={styles.startPanel}>
                  <Text style={styles.panelTitle}>Noch keine Prüfung für dieses Asset</Text>
                  <Text style={styles.bodyText}>
                    Die Prüfung wird an den oben angezeigten SHA-256-Hash gebunden.
                    Eine spätere Änderung der GLB-Datei macht die Freigabe automatisch
                    ungültig.
                  </Text>
                  {canWrite ? (
                    <ActionButton
                      label={saving ? 'Wird gestartet…' : 'Medizinische Prüfung starten'}
                      disabled={
                        saving ||
                        selectedVariant.visualReviewStatus !== 'qa-ready'
                      }
                      onPress={() => void startReview()}
                    />
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={styles.formGrid}>
                    <LabeledInput
                      label="Prüfende Person"
                      value={draft.reviewerName}
                      editable={canWrite}
                      onChangeText={(reviewerName) => setDraft({ ...draft, reviewerName })}
                    />
                    <LabeledInput
                      label="Qualifikation / Funktion"
                      value={draft.reviewerQualification}
                      editable={canWrite}
                      placeholder="z. B. Pflegefachkraft, Arzt/Ärztin"
                      onChangeText={(reviewerQualification) =>
                        setDraft({ ...draft, reviewerQualification })
                      }
                    />
                    <LabeledInput
                      label="Prüfumfang"
                      value={draft.reviewScope}
                      editable={canWrite}
                      onChangeText={(reviewScope) => setDraft({ ...draft, reviewScope })}
                    />
                  </View>

                  {surfacePoint && canWrite ? (
                    <View style={styles.issueComposer}>
                      <Text style={styles.panelTitle}>
                        Problem an „{surfacePoint.zoneId}“ erfassen
                      </Text>
                      <View style={styles.filterRow}>
                        {(['minor', 'major', 'blocker'] as const).map((severity) => (
                          <Chip
                            key={severity}
                            selected={issueSeverity === severity}
                            label={
                              severity === 'minor'
                                ? 'Gering'
                                : severity === 'major'
                                  ? 'Wesentlich'
                                  : 'Blockierend'
                            }
                            onPress={() => setIssueSeverity(severity)}
                          />
                        ))}
                      </View>
                      <TextInput
                        style={styles.input}
                        value={issueTitle}
                        onChangeText={setIssueTitle}
                        placeholder="Kurztitel des anatomischen Problems"
                        placeholderTextColor={PLATFORM_COLORS.muted}
                      />
                      <TextInput
                        style={[styles.input, styles.multiline]}
                        value={issueDescription}
                        onChangeText={setIssueDescription}
                        placeholder="Was muss am 3D-Modell korrigiert werden?"
                        placeholderTextColor={PLATFORM_COLORS.muted}
                        multiline
                      />
                      <View style={styles.actionRow}>
                        <ActionButton label="Problem übernehmen" onPress={addIssue} />
                        <ActionButton
                          secondary
                          label="Abbrechen"
                          onPress={() => setSurfacePoint(null)}
                        />
                      </View>
                    </View>
                  ) : null}

                  {draft.issues.length ? (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        Positionsgebundene Probleme ({draft.issues.length})
                      </Text>
                      {draft.issues.map((issue) => (
                        <View key={issue.id} style={styles.issueRow}>
                          <View style={styles.flex}>
                            <Text style={styles.criterionLabel}>{issue.title}</Text>
                            <Text style={styles.criterionGuidance}>
                              {issue.anatomicalZoneId ?? 'Ohne Zone'} ·{' '}
                              {issue.description || 'Keine Beschreibung'}
                            </Text>
                          </View>
                          <StatusPill
                            status={
                              issue.status === 'resolved'
                                ? 'approved'
                                : issue.severity === 'minor'
                                  ? 'in_review'
                                  : 'changes_required'
                            }
                          />
                          {canWrite && issue.status === 'open' ? (
                            <Pressable
                              onPress={() =>
                                setDraft({
                                  ...draft,
                                  issues: draft.issues.map((entry) =>
                                    entry.id === issue.id
                                      ? {
                                          ...entry,
                                          status: 'resolved',
                                          resolution: 'In Prüfung als erledigt markiert',
                                        }
                                      : entry,
                                  ),
                                })
                              }
                            >
                              <Text style={styles.link}>Als erledigt markieren</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.progressPanel}>
                    <Text style={styles.panelTitle}>Prüffortschritt</Text>
                    <Text style={styles.progressValue}>
                      {approval.completed} von {approval.total} Kriterien
                    </Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${approval.total ? (approval.completed / approval.total) * 100 : 0}%`,
                          },
                        ]}
                      />
                    </View>
                    {approval.reasons.map((reason) => (
                      <Text key={reason} style={styles.warningText}>• {reason}</Text>
                    ))}
                  </View>

                  {Object.entries(BODYMAP_MEDICAL_CATEGORY_LABELS).map(
                    ([category, label]) => {
                      const categoryCriteria = criteria.filter(
                        (criterion) => criterion.category === category,
                      );
                      if (!categoryCriteria.length) return null;
                      return (
                        <View key={category} style={styles.section}>
                          <Text style={styles.sectionTitle}>{label}</Text>
                          {categoryCriteria.map((criterion) => {
                            const item = draft.items.find(
                              (entry) => entry.criterionId === criterion.id,
                            );
                            if (!item) return null;
                            return (
                              <View key={criterion.id} style={styles.criterion}>
                                <Text style={styles.criterionLabel}>{criterion.label}</Text>
                                <Text style={styles.criterionGuidance}>
                                  {criterion.guidance}
                                </Text>
                                <View style={styles.resultRow}>
                                  {(
                                    ['pass', 'minor', 'major', 'blocker', 'not_applicable'] as const
                                  ).map((result) => (
                                    <Chip
                                      key={result}
                                      selected={item.result === result}
                                      label={RESULT_LABELS[result]}
                                      disabled={!canWrite || draft.status === 'approved'}
                                      onPress={() => updateItem(criterion.id, { result })}
                                    />
                                  ))}
                                </View>
                                <TextInput
                                  style={styles.input}
                                  value={item.notes}
                                  editable={canWrite && draft.status !== 'approved'}
                                  onChangeText={(notes) =>
                                    updateItem(criterion.id, { notes })
                                  }
                                  placeholder="Medizinische Prüfnotiz (optional)"
                                  placeholderTextColor={PLATFORM_COLORS.muted}
                                />
                              </View>
                            );
                          })}
                        </View>
                      );
                    },
                  )}

                  <View style={styles.stickyActions}>
                    {canWrite && !['approved', 'revoked', 'superseded'].includes(draft.status) ? (
                      <>
                        <ActionButton
                          secondary
                          label="Zwischenstand speichern"
                          onPress={() => setConfirm({ type: 'save', status: 'in_review' })}
                        />
                        <ActionButton
                          danger
                          label="Änderungen erforderlich"
                          onPress={() =>
                            setConfirm({ type: 'save', status: 'changes_required' })
                          }
                        />
                      </>
                    ) : null}
                    {canApprove && approval.allowed && draft.status !== 'approved' ? (
                      <ActionButton
                        label="Medizinisch final freigeben"
                        onPress={() => setConfirm({ type: 'approve' })}
                      />
                    ) : null}
                    {canApprove && draft.status === 'approved' ? (
                      <ActionButton
                        danger
                        label="Freigabe widerrufen"
                        onPress={() => setConfirm({ type: 'revoke' })}
                      />
                    ) : null}
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <PlatformConfirmModal
        visible={Boolean(confirm)}
        title={
          confirm?.type === 'approve'
            ? 'Medizinische Freigabe erteilen'
            : confirm?.type === 'revoke'
              ? 'Medizinische Freigabe widerrufen'
              : confirm?.status === 'changes_required'
                ? 'Korrekturen anfordern'
                : 'Prüfung speichern'
        }
        description={
          confirm?.type === 'approve'
            ? `Die Freigabe gilt ausschließlich für ${selectedVariant.id} mit SHA-256 ${selectedVariant.assetSha256}.`
            : 'Diese Entscheidung wird unveränderlich im Audit-Trail protokolliert.'
        }
        confirmLabel={
          confirm?.type === 'approve'
            ? 'Final freigeben'
            : confirm?.type === 'revoke'
              ? 'Freigabe widerrufen'
              : 'Speichern'
        }
        requireTypedConfirmation={
          confirm?.type === 'approve' ? 'FREIGEBEN' : undefined
        }
        danger={confirm?.type === 'revoke' || confirm?.type === 'save' && confirm.status === 'changes_required'}
        loading={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={(reason) => void executeConfirmed(reason)}
      />
    </PlatformShellLayout>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const color =
    tone === 'success'
      ? PLATFORM_COLORS.success
      : tone === 'warning'
        ? PLATFORM_COLORS.warning
        : tone === 'danger'
          ? PLATFORM_COLORS.danger
          : PLATFORM_COLORS.accent;
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({
  status,
}: {
  status: BodyMapMedicalReviewStatus | 'not_reviewed' | 'stale';
}) {
  const color =
    status === 'approved'
      ? PLATFORM_COLORS.success
      : ['changes_required', 'revoked', 'stale'].includes(status)
        ? PLATFORM_COLORS.danger
        : ['in_review', 'draft'].includes(status)
          ? PLATFORM_COLORS.warning
          : PLATFORM_COLORS.muted;
  return (
    <View style={[styles.statusPill, { borderColor: color }]}>
      <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.chip,
        selected && styles.chipActive,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function LabeledInput({
  label,
  ...inputProps
}: {
  label: string;
  value: string;
  editable: boolean;
  placeholder?: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        style={styles.input}
        placeholderTextColor={PLATFORM_COLORS.muted}
      />
    </View>
  );
}

function ActionButton({
  label,
  secondary,
  danger,
  disabled,
  onPress,
}: {
  label: string;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[
        styles.actionButton,
        secondary && styles.actionButtonSecondary,
        danger && styles.actionButtonDanger,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.md, paddingBottom: 80 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    flexGrow: 1,
    minWidth: 145,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 12,
    padding: spacing.md,
  },
  kpiValue: { fontSize: 24, fontWeight: '900' },
  kpiLabel: { color: PLATFORM_COLORS.muted, fontSize: 12, marginTop: 3 },
  workspace: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  workspaceFocus: { alignItems: 'stretch' },
  workspaceNarrow: { flexDirection: 'column' },
  matrixPanel: {
    width: 360,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  matrixPanelNarrow: { width: '100%' },
  detailPanel: {
    flex: 1,
    minWidth: 0,
    backgroundColor: PLATFORM_COLORS.panel,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.md,
  },
  detailPanelFocus: {
    width: '100%',
    borderRadius: 0,
    padding: spacing.sm,
  },
  panelTitle: { color: PLATFORM_COLORS.text, fontSize: 16, fontWeight: '800' },
  title: { color: PLATFORM_COLORS.text, fontSize: 21, fontWeight: '900' },
  meta: { color: PLATFORM_COLORS.muted, fontSize: 12, marginTop: 5 },
  fullHash: { color: PLATFORM_COLORS.muted, fontSize: 10, marginTop: 5 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  focusButton: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    backgroundColor: PLATFORM_COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusButtonText: {
    color: PLATFORM_COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  flex: { flex: 1, minWidth: 0 },
  input: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 8,
    backgroundColor: PLATFORM_COLORS.bg,
    color: PLATFORM_COLORS.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    fontSize: 13,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: PLATFORM_COLORS.panelSoft,
  },
  chipActive: { borderColor: PLATFORM_COLORS.accent, backgroundColor: PLATFORM_COLORS.accentSoft },
  chipText: { color: PLATFORM_COLORS.muted, fontSize: 11, fontWeight: '600' },
  chipTextActive: { color: PLATFORM_COLORS.text },
  variantList: { maxHeight: 680 },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: PLATFORM_COLORS.border,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  variantRowActive: {
    backgroundColor: PLATFORM_COLORS.accentSoft,
    borderRadius: 8,
    borderBottomColor: 'transparent',
  },
  variantCopy: { flex: 1, minWidth: 0 },
  variantName: { color: PLATFORM_COLORS.text, fontSize: 12, fontWeight: '700' },
  hash: { color: PLATFORM_COLORS.muted, fontSize: 9, marginTop: 3 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  statusText: { fontSize: 9, fontWeight: '800' },
  viewer: { minHeight: 670, borderRadius: 10, overflow: 'hidden' },
  hint: { color: PLATFORM_COLORS.muted, fontSize: 12 },
  startPanel: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.warning,
    backgroundColor: PLATFORM_COLORS.panelSoft,
  },
  visualBlocker: {
    padding: spacing.md,
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.danger,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  visualBlockerTitle: {
    color: PLATFORM_COLORS.danger,
    fontSize: 14,
    fontWeight: '900',
  },
  bodyText: { color: PLATFORM_COLORS.muted, fontSize: 13, lineHeight: 19 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { flex: 1, minWidth: 230, gap: 5 },
  fieldLabel: { color: PLATFORM_COLORS.muted, fontSize: 11, fontWeight: '700' },
  issueComposer: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.warning,
    backgroundColor: PLATFORM_COLORS.panelSoft,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  issueRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: PLATFORM_COLORS.border,
    paddingVertical: spacing.sm,
  },
  link: { color: PLATFORM_COLORS.accent, fontSize: 11, fontWeight: '700' },
  progressPanel: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    backgroundColor: PLATFORM_COLORS.panelSoft,
    borderRadius: 10,
    padding: spacing.md,
    gap: 7,
  },
  progressValue: { color: PLATFORM_COLORS.text, fontSize: 13, fontWeight: '700' },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: PLATFORM_COLORS.bg,
  },
  progressFill: { height: '100%', backgroundColor: PLATFORM_COLORS.accent },
  warningText: { color: PLATFORM_COLORS.warning, fontSize: 11 },
  section: {
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: PLATFORM_COLORS.text,
    fontSize: 15,
    fontWeight: '800',
    padding: spacing.md,
    backgroundColor: PLATFORM_COLORS.panelSoft,
  },
  criterion: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: PLATFORM_COLORS.border,
  },
  criterionLabel: { color: PLATFORM_COLORS.text, fontSize: 13, fontWeight: '700' },
  criterionGuidance: { color: PLATFORM_COLORS.muted, fontSize: 12, lineHeight: 18 },
  resultRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stickyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.borderStrong,
    borderRadius: 10,
    backgroundColor: PLATFORM_COLORS.panelSoft,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: {
    backgroundColor: PLATFORM_COLORS.accent,
    borderWidth: 1,
    borderColor: PLATFORM_COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: PLATFORM_COLORS.borderStrong,
  },
  actionButtonDanger: {
    backgroundColor: PLATFORM_COLORS.danger,
    borderColor: PLATFORM_COLORS.danger,
  },
  actionText: { color: '#06111f', fontSize: 12, fontWeight: '800' },
  actionTextSecondary: { color: PLATFORM_COLORS.text },
  disabled: { opacity: 0.45 },
});
