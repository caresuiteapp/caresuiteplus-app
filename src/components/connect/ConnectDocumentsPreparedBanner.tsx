import { InfoBanner } from '@/components/ui';
import { GOBD_ARCHIVE_DISCLAIMER, OCR_EXTERNAL_APPROVAL_REQUIRED } from '@/lib/documents/connectDocuments';

type ConnectDocumentsPreparedBannerProps = {
  variant?: 'general' | 'ocr' | 'archive';
};

const MESSAGES: Record<NonNullable<ConnectDocumentsPreparedBannerProps['variant']>, string> = {
  general:
    'Dokumentenerzeugung, Signaturen und OCR sind vorbereitet. Es findet kein externer Signatur-Versand und kein OCR-Transfer ohne Freigabe statt.',
  ocr: OCR_EXTERNAL_APPROVAL_REQUIRED,
  archive: GOBD_ARCHIVE_DISCLAIMER,
};

export function ConnectDocumentsPreparedBanner({
  variant = 'general',
}: ConnectDocumentsPreparedBannerProps) {
  return (
    <InfoBanner
      title="Dokumente & Signaturen — Vorbereitung"
      message={MESSAGES[variant]}
    />
  );
}
