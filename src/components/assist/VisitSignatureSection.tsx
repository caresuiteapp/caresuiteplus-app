import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CareSignatureModal } from '@/components/inputs/CareSignatureModal';
import { InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
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
  disabled?: boolean;
  onSigned?: () => void;
};

export function VisitSignatureSection({
  visitId,
  clientName,
  disabled = false,
  onSigned,
}: VisitSignatureSectionProps) {
  const text = useAuroraAdaptiveText();
  const [modalVisible, setModalVisible] = useState(false);
  const [signerName, setSignerName] = useState(clientName);
  const [signerRole, setSignerRole] = useState('Klient:in / Angehörige:r');
  const [capture, setCapture] = useState(() => getVisitSignature(visitId));

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

  const handleConfirm = (dataUrl: string) => {
    if (!dataUrl.trim() || !signerName.trim()) return;
    const next = {
      visitId,
      dataUrl,
      signerName: signerName.trim(),
      signerRole: signerRole.trim(),
      signedAt: new Date().toISOString(),
    };
    saveVisitSignature(next);
    setCapture(next);
    setModalVisible(false);
    onSigned?.();
  };

  const handleClear = () => {
    clearVisitSignature(visitId);
    setCapture(null);
  };

  return (
    <SectionPanel title="Unterschrift" subtitle="Klient:in / Angehörige:r">
      <InfoBanner
        variant="warning"
        title="Session-Speicher"
        message="assist_visit_signatures fehlt — Unterschrift nur bis Browser-Reload/session, nicht auditierbar."
      />

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
        onConfirm={handleConfirm}
        onClose={() => setModalVisible(false)}
        disabled={!signerName.trim()}
      />
    </SectionPanel>
  );
}
