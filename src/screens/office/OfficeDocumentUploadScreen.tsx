import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { CatalogValueSelect } from '@/components/templates';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchOfficeDocumentList, uploadOfficeDocument } from '@/lib/office/officeDocumentsService';
import { getServiceMode } from '@/lib/services/mode';

type PickedFile = {
  name: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64?: string;
};

/** Office Dokument-Upload — expo-document-picker + Supabase Storage */
export function OfficeDocumentUploadScreen() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [name, setName] = useState('');
  const [documentCategory, setDocumentCategory] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [done, setDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLive = getServiceMode() === 'supabase';

  const handlePickFile = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const filename = asset.name ?? 'dokument';
    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const sizeBytes = asset.size ?? 0;

    setName(filename);
    setPickedFile({
      name: filename,
      mimeType,
      sizeBytes,
      contentBase64: isLive ? undefined : undefined,
    });

    if (isLive && asset.uri) {
      try {
        const response = await fetch(asset.uri);
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i] ?? 0);
        }
        setPickedFile({
          name: filename,
          mimeType,
          sizeBytes: sizeBytes || bytes.length,
          contentBase64: btoa(binary),
        });
      } catch {
        setError('Datei konnte nicht gelesen werden.');
        setPickedFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!tenantId || !name.trim() || !documentCategory || !uploadCategory) return;
    if (isLive && (!pickedFile?.contentBase64 || pickedFile.sizeBytes <= 0)) {
      setError('Bitte zuerst eine Datei auswählen.');
      return;
    }

    setUploading(true);
    setError(null);
    const result = await uploadOfficeDocument(
      tenantId,
      {
        filename: name.trim(),
        mimeType: pickedFile?.mimeType ?? 'application/pdf',
        sizeBytes: pickedFile?.sizeBytes ?? 0,
        category: documentCategory,
        contentBase64: pickedFile?.contentBase64,
      },
      profile?.roleKey,
    );
    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  if (uploading) {
    return (
      <ScreenShell title="Upload" subtitle="Wird hochgeladen…">
        <LoadingState message="Dokument wird hochgeladen…" />
      </ScreenShell>
    );
  }

  if (done) {
    return (
      <ScreenShell title="Upload" subtitle="Dokument hochgeladen">
        <SuccessState
          message={
            isLive
              ? 'Dokument in Supabase Storage hochgeladen.'
              : 'Dokument in Demo-Storage referenziert.'
          }
        />
      </ScreenShell>
    );
  }

  const isEmpty = !pickedFile && !name.trim() && !documentCategory && !uploadCategory;

  return (
    <ScreenShell title="Dokument hochladen" subtitle="Office Ablage">
      {isEmpty ? (
        <EmptyState
          title="Dokument hochladen"
          message="Datei auswählen, Kategorien setzen und hochladen."
        />
      ) : null}
      <PremiumCard>
        <PremiumButton
          title={pickedFile ? `Datei: ${pickedFile.name}` : 'Datei auswählen'}
          fullWidth
          onPress={() => void handlePickFile()}
        />
        <PremiumInput label="Dateiname" value={name} onChangeText={setName} />
        <CatalogValueSelect
          catalogType="document_category"
          label="Dokumentkategorie"
          required
          value={documentCategory}
          onChange={setDocumentCategory}
        />
        <CatalogValueSelect
          catalogType="upload_category"
          label="Upload-Kategorie"
          required
          value={uploadCategory}
          onChange={setUploadCategory}
        />
        {isLive && !pickedFile ? (
          <PremiumInput
            label="Hinweis"
            value="Live-Upload erfordert Dateiauswahl über Dokument-Picker."
            editable={false}
          />
        ) : null}
        {error ? <ErrorState title="Upload" message={error} onRetry={() => setError(null)} /> : null}
        <PremiumButton
          title={isLive ? 'Hochladen (Live)' : 'Hochladen (Demo)'}
          fullWidth
          disabled={
            !tenantId ||
            uploading ||
            !name.trim() ||
            !documentCategory ||
            !uploadCategory ||
            (isLive && (!pickedFile || pickedFile.sizeBytes <= 0))
          }
          onPress={() => void handleUpload()}
        />
      </PremiumCard>
    </ScreenShell>
  );
}

void fetchOfficeDocumentList;
