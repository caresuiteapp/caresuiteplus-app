import { registerDocumentContextRepository } from '@/features/documents/templateEngine/documentContext';
import { documentContextSupabaseRepository } from '@/lib/documents/repository/documentContextRepository.supabase';
import { getServiceMode } from '@/lib/services/mode';

let bootstrapped = false;

/** Registriert Live-Repositories für die Dokumenten-Engine (idempotent). */
export function bootstrapDocumentEngine(): void {
  if (bootstrapped) return;
  if (getServiceMode() === 'supabase') {
    registerDocumentContextRepository(documentContextSupabaseRepository);
  }
  bootstrapped = true;
}

export function resetDocumentEngineBootstrap(): void {
  bootstrapped = false;
}
