import type { ServiceResult } from '@/types';

/** Gemeinsame Supabase-Repository-Hülle — echte Queries folgen bei Live-Betrieb. */
export function supabaseRepositoryStub<T>(
  entityLabel: string,
  wpNumber: number,
): {
  wpNumber: number;
  entityLabel: string;
  list: (tenantId: string) => Promise<ServiceResult<T[]>>;
  getById: (tenantId: string, id: string) => Promise<ServiceResult<T | null>>;
} {
  return {
    wpNumber,
    entityLabel,
    async list() {
      return {
        ok: false,
        error: `${entityLabel}: Supabase-Repository (WP ${wpNumber}) — Live-Modus nicht konfiguriert.`,
      };
    },
    async getById() {
      return {
        ok: false,
        error: `${entityLabel}: Supabase-Repository (WP ${wpNumber}) — Live-Modus nicht konfiguriert.`,
      };
    },
  };
}
