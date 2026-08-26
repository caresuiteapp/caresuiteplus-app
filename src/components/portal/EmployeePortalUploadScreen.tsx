import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { careSpacing } from '@/design/tokens/spacing';
import { careTypography } from '@/design/tokens/typography';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumInput,
  PremiumListRow,
  SegmentedTabs,
} from '@/components/ui';
import { useEmployeePortalUploads } from '@/hooks/useEmployeePortalUploads';
import { useEmployeePortalClientRecords } from '@/hooks/useEmployeePortalClientRecords';
import { usePortalActor } from '@/hooks/usePortalActor';
import {
  EMPLOYEE_CLIENT_UPLOAD_CATEGORIES,
  EMPLOYEE_PORTAL_UPLOAD_STATUS_LABELS,
  EMPLOYEE_SELF_UPLOAD_CATEGORIES,
  uploadEmployeePortalDocument,
  type EmployeePortalUploadContext,
} from '@/lib/portal/employeePortalUploadService';
import { portalPremium } from '@/design/tokens/portalPremium';
import {
  openEmployeePortalCamera,
  openEmployeePortalDocumentPicker,
  openEmployeePortalMediaLibrary,
  readEmployeePortalMediaBytes,
  recoverEmployeePortalPendingCameraMedia,
  type EmployeePortalMediaPickerResult,
} from '@/lib/portal/employeePortalMediaPicker';
import {
  formatEmployeePortalMediaSize,
  validateEmployeePortalPickedMedia,
  type EmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';

function formatCategoryLabel(value: string): string {
  const label = value.replace(/_/g, ' ').trim();
  return label ? `${label.charAt(0).toLocaleUpperCase('de-DE')}${label.slice(1)}` : value;
}

export function EmployeePortalUploadScreen() {
  const text = portalText;
  const { tenantId, employeeId } = usePortalActor();
  const { uploads, loading, error, refresh } = useEmployeePortalUploads();
  const { records: clients } = useEmployeePortalClientRecords();

  const [uploadContext, setUploadContext] = useState<EmployeePortalUploadContext>('mitarbeiter');
  const [clientId, setClientId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('sonstiges');
  const [comment, setComment] = useState('');
  const [pickedFile, setPickedFile] = useState<EmployeePortalPickedMedia | null>(null);
  const [picking, setPicking] = useState(false);
  const [settingsRequired, setSettingsRequired] = useState(false);
  const [permissionHelp, setPermissionHelp] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const categories = useMemo(
    () => (uploadContext === 'mitarbeiter' ? EMPLOYEE_SELF_UPLOAD_CATEGORIES : EMPLOYEE_CLIENT_UPLOAD_CATEGORIES),
    [uploadContext],
  );

  const acceptPickerResult = useCallback((result: EmployeePortalMediaPickerResult) => {
    setPicking(false);
    if (!result.ok) {
      setSubmitError(result.error);
      setSettingsRequired(Boolean(result.settingsRequired));
      setPermissionHelp(result.permissionHelp ?? null);
      return;
    }
    if (!result.media) return;
    const validation = validateEmployeePortalPickedMedia(result.media, 'portal-upload');
    if (!validation.ok) {
      setSubmitError(validation.error);
      return;
    }
    setSettingsRequired(false);
    setPermissionHelp(null);
    setSubmitError(null);
    setPickedFile(result.media);
  }, []);

  const pickFrom = useCallback(async (source: 'camera' | 'library' | 'document') => {
    setPicking(true);
    setSubmitError(null);
    const result =
      source === 'camera'
        ? await openEmployeePortalCamera()
        : source === 'library'
          ? await openEmployeePortalMediaLibrary()
          : await openEmployeePortalDocumentPicker({ includeMediaFallback: true });
    acceptPickerResult(result);
  }, [acceptPickerResult]);

  useEffect(() => {
    let cancelled = false;
    void recoverEmployeePortalPendingCameraMedia().then((result) => {
      if (!cancelled && (result.ok ? Boolean(result.media) : true)) acceptPickerResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [acceptPickerResult]);

  const canSubmit = Boolean(pickedFile) && (uploadContext === 'mitarbeiter' || clientId);

  const submit = useCallback(async () => {
    if (!tenantId || !employeeId || !pickedFile || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    let bytes: Uint8Array;
    try {
      bytes = await readEmployeePortalMediaBytes(pickedFile.uri);
    } catch {
      setSubmitting(false);
      setSubmitError('Die ausgewählte Datei konnte nicht gelesen werden. Bitte wählen Sie sie erneut aus.');
      return;
    }
    const validated = validateEmployeePortalPickedMedia(
      { ...pickedFile, sizeBytes: bytes.length },
      'portal-upload',
    );
    if (!validated.ok) {
      setSubmitting(false);
      setSubmitError(validated.error);
      return;
    }
    const result = await uploadEmployeePortalDocument({
      tenantId,
      employeeId,
      uploadContext,
      clientId: uploadContext === 'klient' ? clientId : null,
      fileName: pickedFile.fileName,
      mimeType: pickedFile.mimeType,
      sizeBytes: bytes.length,
      bytes,
      category,
      message: comment.trim() || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    setSubmitSuccess(true);
    setPickedFile(null);
    setComment('');
    await refresh();
    setTimeout(() => setSubmitSuccess(false), 3000);
  }, [tenantId, employeeId, pickedFile, canSubmit, uploadContext, clientId, category, comment, refresh]);

  if (loading && uploads.length === 0) {
    return <LoadingState message="Uploads werden geladen…" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.infoCard}>
      <Text style={[styles.hint, { color: text.muted }]}>
        Eingereichte Dokumente landen zur Prüfung im Office — nicht direkt in der Klientenakte.
      </Text>
      </View>

      <View style={styles.form}>
        <Text style={[styles.sectionTitle, { color: text.primary }]}>Neues Dokument</Text>

        <SegmentedTabs
          tabs={[
            { key: 'mitarbeiter', label: 'Für mich selbst' },
            { key: 'klient', label: 'Für Klient:in' },
          ]}
          activeKey={uploadContext}
          onSelect={(value) => {
            setUploadContext(value as EmployeePortalUploadContext);
            setCategory('sonstiges');
            setClientId(null);
          }}
          layout="wrap"
        />

        {uploadContext === 'klient' ? (
          <View style={styles.clientPicker}>
            <Text style={[styles.label, { color: text.secondary }]}>Klient:in</Text>
            {clients.length === 0 ? (
              <Text style={[styles.meta, { color: text.muted }]}>Keine zugeordneten Klient:innen</Text>
            ) : (
              clients.map((client) => (
                <PremiumListRow
                  key={client.clientId}
                  title={client.displayName}
                  multiline
                  showChevron={false}
                  trailing={clientId === client.clientId ? <Text>✓</Text> : undefined}
                  onPress={() => setClientId(client.clientId)}
                />
              ))
            )}
          </View>
        ) : null}

        <SegmentedTabs
          tabs={categories.map((cat) => ({ key: cat, label: formatCategoryLabel(cat) }))}
          activeKey={category}
          onSelect={setCategory}
          layout="wrap"
          rows={2}
        />

        <View style={styles.mediaPicker}>
          <Text style={[styles.label, { color: text.secondary }]}>Foto, Video oder Dokument hinzufügen</Text>
          <View style={styles.mediaPickerActions}>
            <View style={styles.mediaPickerAction}>
              <PremiumButton
                title="📷 Kamera"
                variant="secondary"
                onPress={() => void pickFrom('camera')}
                disabled={picking || submitting}
              />
            </View>
            <View style={styles.mediaPickerAction}>
              <PremiumButton
                title="🖼️ Galerie"
                variant="secondary"
                onPress={() => void pickFrom('library')}
                disabled={picking || submitting}
              />
            </View>
            <View style={styles.mediaPickerAction}>
              <PremiumButton
                title="📎 Datei"
                variant="secondary"
                onPress={() => void pickFrom('document')}
                disabled={picking || submitting}
              />
            </View>
          </View>
          {pickedFile ? (
            <View style={styles.pickedCard}>
              <Text style={[styles.pickedName, { color: text.primary }]} numberOfLines={2}>
                {pickedFile.fileName}
              </Text>
              <Text style={[styles.meta, { color: text.muted }]}>
                {pickedFile.kind === 'image' ? 'Foto' : pickedFile.kind === 'video' ? 'Video' : 'Dokument'} · {formatEmployeePortalMediaSize(pickedFile.sizeBytes)}
              </Text>
              <Text style={styles.notSavedYet}>Ausgewählt – noch nicht hochgeladen</Text>
            </View>
          ) : null}
          {settingsRequired && Platform.OS !== 'web' ? (
            <PremiumButton
              title="Geräteeinstellungen öffnen"
              size="sm"
              variant="secondary"
              onPress={() => void Linking.openSettings()}
            />
          ) : null}
          {permissionHelp ? <Text style={styles.permissionHelp}>{permissionHelp}</Text> : null}
          {settingsRequired && Platform.OS === 'web' ? (
            <PremiumButton
              title="Seite nach Freigabe neu laden"
              size="sm"
              variant="secondary"
              onPress={() => globalThis.location?.reload()}
            />
          ) : null}
        </View>

        <PremiumInput
          label="Kommentar (optional)"
          value={comment}
          onChangeText={setComment}
          multiline
        />

        {submitError ? <Text style={[styles.error, { color: '#DC2626' }]}>{submitError}</Text> : null}
        {submitSuccess ? (
          <Text style={[styles.success, { color: text.secondary }]}>Dokument eingereicht — Office prüft den Eingang.</Text>
        ) : null}

        <PremiumButton
          title={submitting ? 'Wird dauerhaft gespeichert…' : 'Jetzt dauerhaft hochladen'}
          onPress={() => void submit()}
          disabled={!canSubmit || submitting}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: text.primary }]}>Meine Uploads</Text>
      {error && uploads.length === 0 ? (
        <ErrorState title="Uploads" message={error} onRetry={() => void refresh()} />
      ) : uploads.length === 0 ? (
        <EmptyState title="Noch keine Uploads" message="Reichen Sie Dokumente über das Formular oben ein." />
      ) : (
        uploads.map((upload, index) => (
          <PremiumListRow
            key={upload.id}
            title={upload.fileName}
            subtitle={`${EMPLOYEE_PORTAL_UPLOAD_STATUS_LABELS[upload.status]} · ${new Date(upload.createdAt).toLocaleDateString('de-DE')}`}
            multiline
            showDivider={index < uploads.length - 1}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: careSpacing.md,
    paddingBottom: careSpacing.xxl,
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  hint: { ...careTypography.caption, lineHeight: 19 },
  infoCard: {
    padding: careSpacing.md, borderRadius: 16, borderWidth: 1,
    borderColor: portalPremium.borderStrong, backgroundColor: portalPremium.surfaceSoft,
  },
  form: {
    gap: careSpacing.md, padding: careSpacing.lg, borderRadius: 22, borderWidth: 1,
    borderColor: portalPremium.border, backgroundColor: portalPremium.surfaceRaised,
  },
  sectionTitle: { ...careTypography.bodyStrong, marginTop: careSpacing.sm },
  label: { ...careTypography.caption, fontWeight: '600' },
  meta: { ...careTypography.caption },
  clientPicker: { gap: careSpacing.xs },
  mediaPicker: { gap: careSpacing.sm },
  mediaPickerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  mediaPickerAction: { flexGrow: 1, minWidth: 140 },
  pickedCard: {
    gap: 3,
    padding: careSpacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: portalPremium.borderStrong,
    backgroundColor: portalPremium.surfaceSoft,
  },
  pickedName: { ...careTypography.bodyStrong },
  notSavedYet: { ...careTypography.caption, color: '#B45309', fontWeight: '800' },
  permissionHelp: {
    ...careTypography.caption,
    color: '#7C2D12',
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 10,
    padding: careSpacing.sm,
    lineHeight: 18,
  },
  error: { ...careTypography.caption },
  success: { ...careTypography.caption },
});

const portalText = {
  primary: portalPremium.text.primary,
  secondary: portalPremium.text.secondary,
  muted: portalPremium.text.muted,
} as const;
