import { useState, type ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  ErrorState,
  PremiumButton,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import type { ClientDocumentRecord } from '@/types/modules/client';
import { downloadDocumentPdf, isDocumentPdfDownloadSupported } from '@/lib/documents/documentPdfService';
import {
  resolveDocumentDeliveryDemoHint,
  sendDocumentViaEmail,
  sendDocumentViaFax,
} from '@/lib/documents/documentDeliveryService';
import { careLightColors } from '@/design/tokens/lightTheme';
import { colors, spacing, typography } from '@/theme';

type DocumentDeliveryActionsProps = {
  tenantId: string;
  clientId: string;
  document: ClientDocumentRecord;
  clientLastName?: string | null;
  actorName?: string | null;
  onDeliveryComplete?: () => void;
};

type ActiveModal = 'email' | 'fax' | null;

export function DocumentDeliveryActions({
  tenantId,
  clientId,
  document,
  clientLastName,
  actorName,
  onDeliveryComplete,
}: DocumentDeliveryActionsProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState(document.title);
  const [emailMessage, setEmailMessage] = useState('');
  const [faxNumber, setFaxNumber] = useState('');

  const pdfSupported = isDocumentPdfDownloadSupported(document);
  const demoEmailHint = resolveDocumentDeliveryDemoHint('email');
  const demoFaxHint = resolveDocumentDeliveryDemoHint('fax');

  async function handleDownloadPdf() {
    setWorking(true);
    setError(null);
    setFeedback(null);

    const result = await downloadDocumentPdf({ doc: document, clientLastName });
    setWorking(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (Platform.OS === 'web') {
      setFeedback(`PDF „${result.data.fileName}“ wurde heruntergeladen.`);
    } else {
      setFeedback(`PDF „${result.data.fileName}“ im Demo-Modus vorbereitet.`);
    }
  }

  async function handleSendEmail() {
    setWorking(true);
    setError(null);
    setFeedback(null);

    const result = await sendDocumentViaEmail({
      tenantId,
      clientId,
      doc: document,
      recipientEmail,
      subject: emailSubject,
      message: emailMessage,
      clientLastName,
      actorName,
    });

    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFeedback(result.data.message);
    if (result.data.configured) {
      setActiveModal(null);
      onDeliveryComplete?.();
    }
  }

  async function handleSendFax() {
    setWorking(true);
    setError(null);
    setFeedback(null);

    const result = await sendDocumentViaFax({
      tenantId,
      clientId,
      doc: document,
      faxNumber,
      clientLastName,
      actorName,
    });

    setWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setFeedback(result.data.message);
    if (result.data.configured) {
      setActiveModal(null);
      onDeliveryComplete?.();
    }
  }

  function closeModal() {
    if (working) return;
    setActiveModal(null);
  }

  return (
    <View style={styles.wrapper}>
      {feedback ? <SuccessState message={feedback} /> : null}
      {error ? <ErrorState message={error} /> : null}

      <View style={styles.actionsRow}>
        <PremiumButton
          title={working ? 'PDF wird erstellt…' : 'Als PDF herunterladen'}
          variant="secondary"
          onPress={handleDownloadPdf}
          disabled={working || !pdfSupported}
        />
        <PremiumButton
          title="Per E-Mail senden"
          variant="secondary"
          onPress={() => {
            setError(null);
            setFeedback(null);
            setActiveModal('email');
          }}
          disabled={working || !pdfSupported}
        />
        <PremiumButton
          title="Per Fax senden"
          variant="secondary"
          onPress={() => {
            setError(null);
            setFeedback(null);
            setActiveModal('fax');
          }}
          disabled={working || !pdfSupported}
        />
      </View>

      {!pdfSupported ? (
        <Text style={styles.hint}>Für dieses Dokument ist kein PDF-Export verfügbar.</Text>
      ) : null}

      <DeliveryModal
        visible={activeModal === 'email'}
        title="Per E-Mail senden"
        subtitle={document.title}
        onClose={closeModal}
        screenWidth={screenWidth}
      >
        {demoEmailHint ? <Text style={styles.hint}>{demoEmailHint}</Text> : null}
        <PremiumInput
          label="Empfänger-E-Mail *"
          value={recipientEmail}
          onChangeText={setRecipientEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <PremiumInput
          label="Betreff"
          value={emailSubject}
          onChangeText={setEmailSubject}
        />
        <PremiumInput
          label="Nachricht (optional)"
          value={emailMessage}
          onChangeText={setEmailMessage}
          multiline
        />
        <PremiumButton
          title={working ? 'Senden…' : 'E-Mail senden'}
          onPress={handleSendEmail}
          disabled={working || !recipientEmail.trim()}
        />
      </DeliveryModal>

      <DeliveryModal
        visible={activeModal === 'fax'}
        title="Per Fax senden"
        subtitle={document.title}
        onClose={closeModal}
        screenWidth={screenWidth}
      >
        {demoFaxHint ? <Text style={styles.hint}>{demoFaxHint}</Text> : null}
        <PremiumInput
          label="Faxnummer *"
          value={faxNumber}
          onChangeText={setFaxNumber}
          placeholder="z. B. 02323 123456"
          keyboardType="phone-pad"
        />
        <Text style={styles.hint}>Deutsche Nummern: Vorwahl mit 0 oder +49</Text>
        <PremiumButton
          title={working ? 'Senden…' : 'Fax senden'}
          onPress={handleSendFax}
          disabled={working || !faxNumber.trim()}
        />
      </DeliveryModal>
    </View>
  );
}

type DeliveryModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  screenWidth: number;
  children: ReactNode;
};

function DeliveryModal({
  visible,
  title,
  subtitle,
  onClose,
  screenWidth,
  children,
}: DeliveryModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Schließen" />
        <View style={[styles.sheet, { width: Math.min(screenWidth - spacing.lg * 2, 560) }]}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSubtitle}>{subtitle}</Text>
          <View style={styles.modalBody}>{children}</View>
          <PremiumButton title="Abbrechen" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  actionsRow: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: careLightColors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    maxHeight: '90%',
  },
  modalTitle: { ...typography.label, fontSize: 18, color: careLightColors.navy },
  modalSubtitle: { ...typography.caption, color: careLightColors.muted },
  modalBody: { gap: spacing.sm },
});
