export function formatPlatformCents(cents: unknown, currency = 'EUR'): string {
  const n = typeof cents === 'number' ? cents : Number(cents);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(n / 100);
}

export function parsePlatformEurosToCents(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  if (!normalized) return null;
  const euros = Number(normalized);
  if (!Number.isFinite(euros) || euros < 0) return null;
  return Math.round(euros * 100);
}

export function maskPlatformProviderId(id: unknown): string {
  if (id == null || id === '') return '—';
  const s = String(id);
  if (s.length <= 8) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function formatPlatformDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE');
}

export function buildPlatformAuditPath(options?: { tenantId?: string; action?: string }): string {
  const params = new URLSearchParams();
  if (options?.tenantId) params.set('tenantId', options.tenantId);
  if (options?.action) params.set('action', options.action);
  const q = params.toString();
  return q ? `/platform/audit?${q}` : '/platform/audit';
}
