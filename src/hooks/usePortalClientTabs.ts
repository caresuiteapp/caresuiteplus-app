import { useMemo } from 'react';
import type { ShellTabConfig } from '@/types/navigation/shell';
import {
  buildClientPortalPrimaryTabs,
  resolveClientPortalNavigationTabs,
} from '@/lib/navigation/clientPortalNavigation';

/** Full drawer + sidebar navigation — always K.1 canonical list. */
export function usePortalClientTabs(): ShellTabConfig[] {
  return useMemo(() => resolveClientPortalNavigationTabs(), []);
}

/** Primary bottom tabs on phone — Übersicht · Einsätze · Dokumente · Nachrichten · Profil. */
export function usePortalClientPrimaryTabs(): ShellTabConfig[] {
  return useMemo(() => buildClientPortalPrimaryTabs(), []);
}
