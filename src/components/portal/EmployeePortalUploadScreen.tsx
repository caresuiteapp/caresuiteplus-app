import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
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
import { isDemoMode } from '@/lib/supabase/config';

async function readPickedFile(asset: DocumentPicker.DocumentPickerAsset) {
  const fileName = asset.name ?? 'dokument';
  const mimeType = asset.mimeType ?? 'application/octet-stream';
  if (isDemoMode()) {
    return { name: fileName, mimeType, sizeBytes: asset.size ?? 0, contentBase64: 'demo' };
  }
  const response = await fetch(asset.uri);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  return { name: fileName, mimeType, sizeBytes: asset.size ?? bytes.length, contentBase64: btoa(binary) };
}

export function EmployeePortalUploadScreen() {
  const text = useAuroraAdaptiveText();
  const { tenantId, employeeId } = usePortalActor();
  const { uploads, loading, error, refresh } = useEmployeePortalUploads();
  const { records: clients } = useEmployeePortalClientRecords();

  const [uploadContext, setUploadContext] = useState<EmployeePortalUploadContext>('mitarbeiter');
  const [clientId, setClientId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>('sonstiges');
  const [comment, setComment] = useState('');
  const [pickedFile, setPickedFile] = useState<Awaited<ReturnType<typeof readPickedFile>> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const categories = useMemo(
    () => (uploadContext === 'mitarbeiter' ? EMPLOYEE_SELF_UPLOAD_CATEGORIES : EMPLOYEE_CLIENT_UPLOAD_CATEGORIES),
    [uploadContext],
  );

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = await readPickedFile(result.assets[0]);
    if (file) setPickedFile(file);
  }, []);

  const canSubmit = Boolean(pickedFile) && (uploadContext === 'mitarbeiter' || clientId);

  const submit = useCallback(async () => {
    if (!tenantId || !employeeId || !pickedFile || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await uploadEmployeePortalDocument({
      tenantId,
      employeeId,
      uploadContext,
      clientId: uploadContext === 'klient' ? clientId : null,
      fileName: pickedFile.name,
      mimeType: pickedFile.mimeType,
      sizeBytes: pickedFile.sizeBytes,
      contentBase64: pickedFile.contentBase64,
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
      <Text style={[styles.hint, { color: text.muted }]}>
        Eingereichte Dokumente landen zur Prüfung im Office — nicht direkt in der Klientenakte.
      </Text>

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
          tabs={categories.map((cat) => ({ key: cat, label: cat.replace(/_/g, ' ') }))}
          activeKey={category}
          onSelect={setCategory}
          layout="wrap"
          rows={2}
        />

        <PremiumButton
          title={pickedFile ? `Datei: ${pickedFile.name}` : 'Datei auswählen / Foto'}
          variant="secondary"
          onPress={() => void pickFile()}
        />

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
          title={submitting ? 'Wird gesendet…' : 'Absenden'}
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
  hint: { ...careTypography.caption },
  form: { gap: careSpacing.sm },
  sectionTitle: { ...careTypography.bodyStrong, marginTop: careSpacing.sm },
  label: { ...careTypography.caption, fontWeight: '600' },
  meta: { ...careTypography.caption },
  clientPicker: { gap: careSpacing.xs },
  error: { ...careTypography.caption },
  success: { ...careTypography.caption },
});
