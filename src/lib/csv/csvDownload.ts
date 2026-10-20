import { Platform } from 'react-native';

export function triggerCsvDownload(content: string, fileName: string): void {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }
}

export function buildExportFileName(importType: 'clients' | 'employees'): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('-');
  const prefix = importType === 'clients' ? 'klientinnen' : 'mitarbeiterinnen';
  return `caresuite_${prefix}_export_${stamp}_${time}.csv`;
}

export function buildErrorReportFileName(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const time = [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('-');
  return `caresuite_import_fehlerbericht_${stamp}_${time}.csv`;
}
