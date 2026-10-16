import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout/ScreenShell';
import { MobileButton, MobileCard, MobileHeading, MobileState, m } from '@/components/mobile/MobileWorkspace';
import { NativeDocumentPreview } from '@/components/office/NativeDocumentHtmlPreview.native';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchOfficeDocumentDetail, fetchOfficeDocumentBlob } from '@/lib/office/officeDocumentsService';
import { blobBytes } from '@/lib/platform/blobBytes';
import { shareNativeDocument } from '@/lib/documents/nativeDocumentDelivery';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
export function OfficeDocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const tenantId = useServiceTenantId() ?? ''; const { profile } = useAuth(); const { can } = usePermissions(); const router = useRouter(); const query = useAsyncQuery(() => fetchOfficeDocumentDetail(tenantId, id, profile?.roleKey, profile), [tenantId, id, profile?.id, profile?.roleKey], { queryKey: `native-document:${tenantId}:${id}:${profile?.id}`, enabled: !!tenantId && !!id && can('office.documents.view') });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false); const identity = `${tenantId}:${id}:${profile?.id}`; const active = useRef(identity); active.current = identity;
  useEffect(() => { active.current = identity; return () => { active.current = ''; }; }, [identity]);
  const open = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { const result = await fetchOfficeDocumentBlob(tenantId, id, profile?.roleKey, profile); if (active.current !== identity) return; if (!result.ok) throw new Error(result.error); await shareNativeDocument(await blobBytes(result.data.blob), result.data.filename, result.data.blob.type); } catch (cause) { if (active.current === identity) setError(cause instanceof Error ? cause.message : 'Datei konnte nicht geöffnet werden.'); } finally { lock.current = false; if (active.current === identity) setBusy(false); } };
  const doc = query.data;
  return <ScreenShell title="Dokument" contentOwnsHeader showBack={false}>{!can('office.documents.view') ? <MobileState title="Keine Berechtigung für die Dokumentenablage" /> : !doc ? <MobileState loading={query.loading} title={query.loading ? 'Dokument wird geladen' : 'Dokument nicht verfügbar'} message={query.error ?? undefined} onRetry={() => void query.refresh()} /> : <View style={m.stack}><MobileHeading title={doc.title} subtitle={doc.clientName || 'Klientenakte'} icon="file-text" /><MobileCard><Text style={m.body}>{WORKFLOW_STATUS_LABELS[doc.status]} · {doc.displayFileName || doc.fileName}</Text>{doc.signaturePending ? <Text style={m.muted}>Die unterschriebene Datei steht nach Abschluss der Signatur bereit.</Text> : <MobileButton primary label="Datei öffnen / teilen" icon="share-2" busy={busy} disabled={doc.status === 'gesperrt' || !doc.storagePath} onPress={() => void open()} />}{error ? <Text style={m.error}>{error}</Text> : null}{doc.clientId ? <MobileButton label="Klientenakte öffnen" onPress={() => router.push(`/business/office/clients/${doc.clientId}` as never)} /> : null}</MobileCard>{doc.previewHtml && doc.status !== 'gesperrt' ? <NativeDocumentPreview html={doc.previewHtml} height={540} /> : null}</View>}</ScreenShell>;
}
