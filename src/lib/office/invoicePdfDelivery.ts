import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { PreparedInvoicePdf } from './invoicePdfService';

async function shareInvoicePdf(payload: PreparedInvoicePdf, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('PDF-Dateien können auf diesem Gerät derzeit nicht geöffnet oder geteilt werden.');
  }
  const folder = new Directory(Paths.cache, 'caresuite-invoices');
  folder.create({ intermediates: true, idempotent: true });
  const name = payload.fileName.replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '_') || 'Rechnung.pdf';
  const file = new File(folder, name);
  file.create({ overwrite: true });
  file.write(payload.bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle,
  });
}

export async function previewInvoicePdf(payload: PreparedInvoicePdf, _target?: Window | null): Promise<void> {
  await shareInvoicePdf(payload, 'Rechnung öffnen oder teilen');
}

export async function downloadInvoicePdf(payload: PreparedInvoicePdf): Promise<void> {
  await shareInvoicePdf(payload, 'Rechnung speichern oder teilen');
}
