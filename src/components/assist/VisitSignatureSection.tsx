import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import { isAssistExecutionPersistenceReady } from '@/lib/assist/assistExecutionPersistenceService';
import {
  computeSignatureDataHash,
  computeVisitSignaturePayloadHash,
  saveVisitSignaturePersistent,
  type VisitSignaturePayloadInput,
} from '@/lib/assist/assistVisitSignaturePersistenceService';
import {
  clearVisitSignature,
  getVisitSignature,
  saveVisitSignature,
} from '@/lib/assist/visitSignatureSessionStore';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';

type VisitSignatureSectionProps = {
  visitId: string;
  clientName: string;
  tenantId?: string | null;
  signaturePayload?: VisitSignaturePayloadInput | null;
  signedByProfileId?: string | null;
  disabled?: boolean;
  onSigned?: (result: { persisted: boolean; warning?: string }) => void;
};

export function VisitSignatureSection({
  visitId,
  clientName,
  tenantId,
  signaturePayload,
  signedByProfileId,
  disabled = false,
  onSigned,
}: VisitSignatureSectionProps) {
  const text = useAuroraAdaptiveText();
  const [modalVisible, setModalVisible] = useState(false);
  const [signerName, setSignerName] = useState(clientName);
  const [signerRole, setSignerRole] = useState('Klient:in / Angehörige:r');
  const [capture, setCapture] = useState(() => getVisitSignature(visitId));
  const [saving, setSaving] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState<boolean | null>(null);
  const [persistWarning, setPersistWarning] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setPersistenceReady(false);
      return;
    }
    let cancelled = false;
    void isAssistExecutionPersistenceReady(tenantId).then(({ ready }) => {
      if (!cancelled) setPersistenceReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        preview: { width: '100%', height: 120, borderRadius: 8, marginTop: spacing.sm },
        meta: { ...typography.caption, color: text.muted, marginTop: spacing.xs },
        fields: { gap: spacing.sm },
        actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
      }),
    [text],
  );

  const handleConfirm = async (dataUrl: string) => {
    if (!dataUrl.trim() || !signerName.trim()) return;
    setSaving(true);
    setPersistWarning(null);

    const signedAt = new Date().toISOString();
    const next = {
      visitId,
      dataUrl,
      signerName: signerName.trim(),
      signerRole: signerRole.trim(),
      signedAt,
    };
    saveVisitSignature(next);
    setCapture(next);

    let didPersist = false;
    let warning: string | undefined;

    if (tenantId && persistenceReady && signaturePayload) {
      const payloadHash = await computeVisitSignaturePayloadHash(signaturePayload);
      const signatureHash = await computeSignatureDataHash(dataUrl);
      const saved = await saveVisitSignaturePersistent(tenantId, {
        visitId,
        signerName: next.signerName,
        signerRole: next.signerRole,
        storagePath: '',
        payloadHash,
        signatureHash,
        signedAt,
        signedByProfileId: signedByProfileId ?? null,
        signatureDataUrl: dataUrl,
      });
      if (saved.ok) {
        didPersist = true;
        setPersisted(true);
      } else {
        warning = saved.error ?? 'Unterschrift konnte nicht dauerhaft gespeichert werden.';
        setPersistWarning(warning);
      }
    } else if (!persistenceReady) {
      warning =
        'Dauerhafte Speicherung ist derzeit nicht verfügbar — Unterschrift gilt nur bis Browser-Reload.';
      setPersistWarning(warning);
    }

    setSaving(false);
    setModalVisible(false);
    onSigned?.({ persisted: didPersist, warning });
  };

  const handleClear = () => {
    clearVisitSignature(visitId);
    setCapture(null);
    setPersisted(false);
    setPersistWarning(null);
  };

  return (
    <SectionPanel title="Unterschrift" subtitle="Klient:in / Angehörige:r">
      {persistenceReady === false && !persisted ? (
        <InfoBanner
          variant="warning"
          title="Nur Sitzungsspeicher"
          message="Die Unterschrift wird lokal erfasst. Für auditierbare Speicherung muss die Signatur-Datenbank verfügbar sein."
        />
      ) : null}
      {persistWarning ? (
        <InfoBanner variant="warning" title="Hinweis zur Speicherung" message={persistWarning} />
      ) : null}
      {persisted ? (
        <InfoBanner
          variant="success"
          title="Unterschrift gespeichert"
          message="Die Unterschrift wurde dauerhaft hinterlegt."
        />
      ) : null}

      <View style={styles.fields}>
        <PremiumInput label="Unterzeichner:in" value={signerName} onChangeText={setSignerName} />
        <PremiumInput label="Rolle / Beziehung" value={signerRole} onChangeText={setSignerRole} />
      </View>

      {capture ? (
        <>
          <Image source={{ uri: capture.dataUrl }} style={styles.preview} resizeMode="contain" />
          <Text style={styles.meta}>
            {capture.signerName} · {capture.signerRole} ·{' '}
            {new Date(capture.signedAt).toLocaleString('de-DE')}
          </Text>
          <Text style={styles.meta}>Einsatz-ID: {visitId}</Text>
        </>
      ) : null}

      {!disabled ? (
        <View style={styles.actions}>
          <PremiumButton
            title={capture ? 'Neu unterschreiben' : 'Unterschrift erfassen'}
            loading={saving}
            onPress={() => setModalVisible(true)}
          />
          {capture ? (
            <PremiumButton title="Löschen" variant="ghost" onPress={handleClear} />
          ) : null}
        </View>
      ) : null}

      <CareSignatureModal
        visible={modalVisible}
        label="Unterschrift bestätigen"
        onConfirm={(dataUrl) => {
          void handleConfirm(dataUrl);
        }}
        onClose={() => setModalVisible(false)}
        disabled={!signerName.trim() || saving}
      />
    </SectionPanel>
  );
}
