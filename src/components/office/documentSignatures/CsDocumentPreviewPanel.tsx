import { StyleSheet, Text, View } from 'react-native';
import { DocumentHtmlPreview } from '@/components/office/DocumentHtmlPreview';
import { PremiumBadge, SectionPanel } from '@/components/ui';
import { useAuroraAdaptiveText } from '@/design/tokens/auroraGlass';
import { spacing, typography } from '@/theme';
import type { CsTemplateSignatureField } from '@/types/documents/csTemplateDatabase';

type Props = {
  title: string;
  previewHtml: string | null;
  signatureFields?: CsTemplateSignatureField[];
};

const ROLE_LABELS: Record<string, string> = {
  employee: 'Mitarbeiter',
  client: 'Klient:in',
  representative: 'Vertretung',
  office: 'Office',
  payor: 'Kostenträger',
};

export function CsDocumentPreviewPanel({ title, previewHtml, signatureFields = [] }: Props) {
  const text = useAuroraAdaptiveText();
  const styles = StyleSheet.create({
    empty: { ...typography.body, color: text.muted, padding: spacing.md },
    badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  });

  if (!previewHtml?.trim()) {
    return (
      <SectionPanel title="Vorschau" subtitle="Gerendertes Dokument">
        <Text style={styles.empty}>
          Wählen Sie eine Vorlage und Empfänger:innen, um die Vorschau zu laden.
        </Text>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Vorschau" subtitle="Gerenderte Inhalte inkl. Signaturbereiche">
      {signatureFields.length > 0 ? (
        <View style={styles.badges}>
          {signatureFields.map((field) => (
            <PremiumBadge
              key={field.id}
              label={`${ROLE_LABELS[field.signerRole] ?? field.signerRole}: ${field.label}${field.required ? ' · Pflicht' : ''}`}
              variant={field.required ? 'orange' : 'muted'}
            />
          ))}
        </View>
      ) : null}
      <DocumentHtmlPreview title={title} previewHtml={previewHtml} />
    </SectionPanel>
  );
}
