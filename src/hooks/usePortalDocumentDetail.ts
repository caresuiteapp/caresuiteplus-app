import { useCallback } from 'react';
import { Linking } from 'react-native';
import { downloadPortalDocument, fetchPortalDocumentDetail } from '@/lib/portal';
import { usePortalActor } from '@/hooks/usePortalActor';
import { isDemoMode } from '@/lib/supabase/config';
import { useAsyncQuery, useMutation } from './core';
import {
  isRoleAllowedForPortalAudience,
  type OperationalPortalAudience,
} from '@/lib/portal/portalAudience';
import { toPortalUserFacingError } from '@/lib/portal/portalUserFacingError';
import { familyPortalAllows } from '@/lib/portal/familyPortalAccessScope';

export function usePortalDocumentDetail(
  documentId: string | undefined,
  audience: OperationalPortalAudience,
) {
  const {
    tenantId,
    clientId,
    employeeId,
    actorId,
    roleKey,
    isLinkedReady,
    isResolvingClientLink,
    isResolvingEmployeeLink,
    familyAccess,
  } = usePortalActor();
  const profileId = actorId ?? '';
  const roleMatchesAudience = isRoleAllowedForPortalAudience(roleKey, audience);
  const scopedRoleKey = roleMatchesAudience ? roleKey : null;
  const scopedClientId = audience === 'client' && roleMatchesAudience ? clientId : null;
  const scopedEmployeeId = audience === 'employee' && roleMatchesAudience ? employeeId : null;
  const resolvingLink = audience === 'employee' ? isResolvingEmployeeLink : isResolvingClientLink;
  const familyDocumentsAllowed =
    roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'documents');
  const familyDownloadAllowed =
    roleKey !== 'family_portal' || familyPortalAllows(familyAccess, 'download_documents');

  const query = useAsyncQuery(
    () =>
      fetchPortalDocumentDetail(documentId ?? '', profileId, scopedRoleKey, {
        tenantId,
        clientId: scopedClientId,
        employeeId: scopedEmployeeId,
      }),
    [documentId, profileId, scopedRoleKey, tenantId, scopedClientId, scopedEmployeeId],
    {
      queryKey: JSON.stringify([tenantId, profileId, scopedRoleKey, scopedClientId, scopedEmployeeId, documentId]),
      enabled:
        !!documentId &&
        isLinkedReady &&
        roleMatchesAudience &&
        familyDocumentsAllowed &&
        (audience === 'client' ? Boolean(scopedClientId) : Boolean(scopedEmployeeId)),
    },
  );

  const downloadMutation = useMutation(
    async (_: null) => {
      const result = await downloadPortalDocument(documentId ?? '', profileId, scopedRoleKey, {
        tenantId,
        clientId: scopedClientId,
        employeeId: scopedEmployeeId,
      });
      if (result.ok && result.data.downloadUrl) await Linking.openURL(result.data.downloadUrl);
      return result;
    },
    {
      successMessage: isDemoMode() ? 'Download vorbereitet.' : 'Download gestartet.',
    },
  );

  const refresh = query.refresh;

  const download = useCallback(async () => {
    if (!familyDownloadAllowed) {
      return { ok: false as const, error: 'Downloads sind für diesen Angehörigenzugang nicht freigegeben.' };
    }
    return downloadMutation.mutate(null);
  }, [downloadMutation, familyDownloadAllowed]);

  return {
    data: query.data,
    loading: resolvingLink || (query.loading && !query.data),
    error: !roleMatchesAudience && roleKey
      ? 'Diese Sitzung gehört zu einem anderen Portal.'
      : audience === 'client' && !isResolvingClientLink && !scopedClientId
        ? 'Ihr Klient:innenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
        : audience === 'employee' && !resolvingLink && !scopedEmployeeId
          ? 'Ihr Mitarbeitendenprofil konnte nicht verknüpft werden. Bitte melden Sie sich erneut an.'
                : roleKey === 'family_portal' && !familyDocumentsAllowed
          ? 'Dokumente sind für diesen Angehörigenzugang nicht freigegeben.'
        : (query.error ?? query.refreshError)
          ? toPortalUserFacingError(
              (query.error ?? query.refreshError)!,
              'Das Dokument konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.',
            )
          : null,
    refresh,
    download,
    downloadLoading: downloadMutation.loading,
    downloadError: downloadMutation.error
      ? toPortalUserFacingError(
          downloadMutation.error,
          'Der Download konnte gerade nicht gestartet werden. Bitte versuchen Sie es erneut.',
        )
      : null,
    successMessage: downloadMutation.successMessage,
    notFound:
      isLinkedReady &&
      roleMatchesAudience &&
      (audience === 'client' ? Boolean(scopedClientId) : Boolean(scopedEmployeeId)) &&
      !query.loading &&
      !query.error &&
      !query.data &&
      !!documentId,
  };
}
