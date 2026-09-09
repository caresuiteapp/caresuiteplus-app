import { webScaledFontMetric as font } from '@/design/web/webFontSize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useUnsavedWebChanges } from '@/hooks/useUnsavedWebChanges.web';
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
  releaseEmployeePortalMediaUri,
  type EmployeePortalMediaPickerResult,
} from '@/lib/portal/employeePortalMediaPicker';
import {
  formatEmployeePortalMediaSize,
  validateEmployeePortalPickedMedia,
  type EmployeePortalPickedMedia,
} from '@/lib/portal/employeePortalMediaValidation';

function formatCategoryLabel(value: string): string {
  if (value === 'fuehrerschein') return 'Führerschein';
  if (value === 'foto_dokument') return 'Foto / Dokument';
  const label = value.replace(/_/g, ' ').trim();
  return label ? `${label.charAt(0).toLocaleUpperCase('de-DE')}${label.slice(1)}` : value;
}

export function EmployeePortalUploadScreen() {
  const text = portalText;
  const { tenantId, employeeId } = usePortalActor();
  const { uploads, loading, error, refresh } = useEmployeePortalUploads();
  const { records: clients, loading: clientsLoading, error: clientsError, refresh: refreshClients } = useEmployeePortalClientRecords();

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
  const [clientSearch, setClientSearch] = useState('');
  const selected = useRef<EmployeePortalPickedMedia | null>(null);
  const flight = useRef(false);
  const epoch = useRef(0);
  useUnsavedWebChanges(Boolean(pickedFile || comment.trim()), submitting);
  useEffect(() => {
    epoch.current += 1; flight.current = false;
    setPickedFile(null); setComment(''); setClientId(null); setSubmitting(false); setPicking(false); setSubmitError(null); setSubmitSuccess(false);
    return () => { epoch.current += 1; releaseEmployeePortalMediaUri(selected.current?.uri); selected.current = null; };
  }, [tenantId, employeeId]);
  const filteredClients = clients.filter(client => client.displayName.toLocaleLowerCase('de-DE').includes(clientSearch.trim().toLocaleLowerCase('de-DE')));


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
      releaseEmployeePortalMediaUri(result.media.uri);
      setSubmitError(validation.error);
      return;
    }
    setSettingsRequired(false);
    setPermissionHelp(null);
    setSubmitError(null);
    releaseEmployeePortalMediaUri(selected.current?.uri);
    selected.current = result.media;
    setPickedFile(result.media);
    setSubmitSuccess(false);
  }, []);

  const pickFrom = useCallback(async (source: 'camera' | 'library' | 'document') => {
    if (flight.current) return;
    flight.current = true; setPicking(true); setSubmitError(null);
    const generation = epoch.current;
    try {
      const result = source === 'camera' ? await openEmployeePortalCamera()
        : source === 'library' ? await openEmployeePortalMediaLibrary()
        : await openEmployeePortalDocumentPicker({ includeMediaFallback: true });
      if (epoch.current !== generation) { if (result.ok) releaseEmployeePortalMediaUri(result.media?.uri); return; }
      acceptPickerResult(result);
    } catch { if (epoch.current === generation) setSubmitError('Die Dateiauswahl konnte nicht geöffnet werden. Bitte erneut versuchen.'); }
    finally { if (epoch.current === generation) { flight.current = false; setPicking(false); } }
  }, [acceptPickerResult]);

  const canSubmit = Boolean(tenantId && employeeId && pickedFile) && (uploadContext === 'mitarbeiter' || Boolean(clientId));
  const submit = useCallback(async () => {
    if (flight.current || !tenantId || !employeeId || !pickedFile || !canSubmit) return;
    flight.current = true; setSubmitting(true); setSubmitError(null); setSubmitSuccess(false);
    const generation = epoch.current;
    try {
      const bytes = await readEmployeePortalMediaBytes(pickedFile.uri);
      if (epoch.current !== generation) return;
      const valid = validateEmployeePortalPickedMedia({ ...pickedFile, sizeBytes: bytes.length }, 'portal-upload');
      if (!valid.ok) { setSubmitError(valid.error); return; }
      const result = await uploadEmployeePortalDocument({ tenantId, employeeId, uploadContext,
        clientId: uploadContext === 'klient' ? clientId : null, fileName: pickedFile.fileName,
        mimeType: pickedFile.mimeType, sizeBytes: bytes.length, bytes, category, message: comment.trim() || null });
      if (epoch.current !== generation) return;
      if (!result.ok) { setSubmitError(result.error); return; }
      releaseEmployeePortalMediaUri(selected.current?.uri); selected.current = null;
      setPickedFile(null); setComment(''); setSubmitSuccess(true);
      try { await refresh(); }
      catch { if (epoch.current === generation) setSubmitError('Das Dokument wurde gespeichert. Die Liste konnte noch nicht aktualisiert werden. Bitte die Liste erneut laden.'); }
    } catch { if (epoch.current === generation) setSubmitError('Die Speicherung konnte nicht bestätigt werden. Datei und Kommentar bleiben erhalten. Bitte vor erneutem Hochladen die Liste aktualisieren.'); }
    finally { if (epoch.current === generation) { flight.current = false; setSubmitting(false); } }
  }, [tenantId, employeeId, pickedFile, canSubmit, uploadContext, clientId, category, comment, refresh]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator>
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
            if (flight.current) return;
            setSubmitSuccess(false);
            setUploadContext(value as EmployeePortalUploadContext);
            setCategory('sonstiges');
            setClientId(null);
          }}
          layout="wrap"
        />

        {uploadContext === 'klient' ? (
          <View style={styles.clientPicker}>
            <Text style={[styles.label, { color: text.secondary }]}>Klient:in</Text>
            <PremiumInput label="Klient:in suchen" value={clientSearch} onChangeText={setClientSearch} editable={!submitting} />
            {clientsLoading ? <Text style={styles.meta}>Klient:innen werden geladen…</Text> : clientsError ? <ErrorState title="Klient:innen konnten nicht geladen werden" message={clientsError} onRetry={() => void refreshClients()} /> : clients.length === 0 ? (
              <Text style={[styles.meta, { color: text.muted }]}>Keine zugeordneten Klient:innen</Text>
            ) : (
              filteredClients.length === 0 ? <Text style={styles.meta}>Keine passenden Klient:innen gefunden.</Text> : filteredClients.map((client) => (
                <PremiumListRow
                  key={client.clientId}
                  title={client.displayName}
                  multiline
                  showChevron={false}
                  trailing={clientId === client.clientId ? <Text>✓</Text> : undefined}
                  onPress={() => { if (!flight.current) { setClientId(client.clientId); setSubmitSuccess(false); } }}
                />
              ))
            )}
          </View>
        ) : null}

        <SegmentedTabs
          tabs={categories.map((cat) => ({ key: cat, label: formatCategoryLabel(cat) }))}
          activeKey={category}
          onSelect={(value) => { if (!flight.current) { setCategory(value); setSubmitSuccess(false); } }}
          layout="wrap"
          rows={2}
        />

        <View style={styles.mediaPicker}>
          <Text style={[styles.label, { color: text.secondary }]}>Foto, Video oder Dokument hinzufügen</Text>
          <View style={styles.mediaPickerActions}>
            <View style={styles.mediaPickerAction}>
              <PremiumButton
                title="Kamera"
                variant="secondary"
                onPress={() => void pickFrom('camera')}
                disabled={picking || submitting}
              />
            </View>
            <View style={styles.mediaPickerAction}>
              <PremiumButton
                title="Fotos & Videos"
                variant="secondary"
                onPress={() => void pickFrom('library')}
                disabled={picking || submitting}
              />
            </View>
            <View style={styles.mediaPickerAction}>
              <PremiumButton
                title="Datei auswählen"
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
              <PremiumButton title="Auswahl entfernen" variant="ghost" disabled={picking || submitting} onPress={() => { releaseEmployeePortalMediaUri(selected.current?.uri); selected.current = null; setPickedFile(null); setSubmitError(null); }} />
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
          onChangeText={(value) => { setComment(value); setSubmitSuccess(false); }}
          editable={!submitting}
          multiline
        />

        {submitError ? <Text accessibilityRole="alert" style={[styles.error, { color: '#DC2626' }]}>{submitError}</Text> : null}
        {submitSuccess ? (
          <Text style={[styles.success, { color: text.secondary }]}>Dokument eingereicht — Office prüft den Eingang.</Text>
        ) : null}

        <PremiumButton
          title={submitting ? 'Dokument wird eingereicht…' : 'Dokument einreichen'}
          loading={submitting}
          onPress={() => void submit()}
          disabled={!canSubmit || submitting || picking}
        />
      </View>

      <Text style={[styles.sectionTitle, { color: text.primary }]}>Meine Uploads</Text>
      <PremiumButton title="Liste aktualisieren" variant="secondary" onPress={() => void refresh()} disabled={submitting || loading} />
      {error && uploads.length > 0 ? <ErrorState title="Liste konnte nicht aktualisiert werden" message={error} onRetry={() => void refresh()} /> : null}
      {loading && uploads.length === 0 ? <LoadingState message="Uploads werden geladen…" /> : error && uploads.length === 0 ? (
        <ErrorState title="Uploads" message={error} onRetry={() => void refresh()} />
      ) : uploads.length === 0 ? (
        <EmptyState title="Noch keine Uploads" message="Reichen Sie Dokumente über das Formular oben ein." />
      ) : (
        uploads.map((upload, index) => (
          <PremiumListRow
            key={upload.id}
            title={upload.fileName}
            subtitle={`${EMPLOYEE_PORTAL_UPLOAD_STATUS_LABELS[upload.status] ?? 'Status offen'} · ${new Date(upload.createdAt).toLocaleDateString('de-DE')}${upload.reviewNote ? ` · Rückmeldung: ${upload.reviewNote}` : ''}`}
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
    maxWidth: 1100,
    minWidth: 0,
    alignSelf: 'center',
    width: '100%',
  },
  hint: { ...careTypography.caption, fontSize: font(14), lineHeight: font(21) },
  infoCard: {
    padding: careSpacing.md, borderRadius: 16, borderWidth: 1,
    borderColor: portalPremium.borderStrong, backgroundColor: portalPremium.surfaceSoft,
  },
  form: {
    gap: careSpacing.md, padding: careSpacing.lg, borderRadius: 22, borderWidth: 1,
    borderColor: portalPremium.border, backgroundColor: portalPremium.surfaceRaised,
  },
  sectionTitle: { ...careTypography.bodyStrong, fontSize: font(20), lineHeight: font(27), marginTop: careSpacing.sm },
  label: { ...careTypography.caption, fontSize: font(14), lineHeight: font(21), fontWeight: '600' },
  meta: { ...careTypography.caption, fontSize: font(14), lineHeight: font(21) },
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
  notSavedYet: { ...careTypography.caption, fontSize: font(14), lineHeight: font(21), color: '#B45309', fontWeight: '800' },
  permissionHelp: {
    ...careTypography.caption, fontSize: font(14),
    color: '#7C2D12',
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
    borderWidth: 1,
    borderRadius: 10,
    padding: careSpacing.sm,
    lineHeight: font(21),
  },
  error: { ...careTypography.caption, fontSize: font(14), lineHeight: font(21) },
  success: { ...careTypography.caption, fontSize: font(14), lineHeight: font(21) },
});

const portalText = {
  primary: portalPremium.text.primary,
  secondary: portalPremium.text.secondary,
  muted: portalPremium.text.muted,
} as const;
