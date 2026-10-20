import type { CertificateDetail } from '@/types/modules/akademie';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type CertificateDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildCertificateDetailKpis(certificate: CertificateDetail, mode: ColorMode = 'dark'): CertificateDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const issued = new Date(certificate.issuedAt).toLocaleDateString('de-DE');
  const expires = certificate.expiresAt
    ? new Date(certificate.expiresAt).toLocaleDateString('de-DE')
    : 'unbegrenzt';

  return [
    {
      id: 'number',
      label: 'Nummer',
      value: certificate.certificateNumber,
      subValue: certificate.issuerName,
      icon: '🏅',
      accentColor: colors.success,
    },
    {
      id: 'issued',
      label: 'Ausgestellt',
      value: issued,
      subValue: certificate.status,
      icon: '📅',
      accentColor: '#FFD166',
    },
    {
      id: 'expires',
      label: 'Gültig bis',
      value: expires,
      subValue: certificate.courseTitle.split(' ').slice(0, 2).join(' '),
      icon: '✅',
      accentColor: colors.cyan,
    },
  ];
}
