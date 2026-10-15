import { Platform } from 'react-native';
import type { ServiceResult } from '@/types';
import { guardServiceTenant, isLiveServiceMode } from '@/lib/services/liveServiceGuard';
import { loadCompanyAccess } from './companyAccessService.web';
import { TENANT_SETTINGS_PERMISSION } from './tenantSettingsRoute';

/** Company-wide legacy records have no structural scope; native callers retain their existing checks. */
export async function guardLegacyCompanyWebAccess<T>(tenantId: string): Promise<ServiceResult<T> | null> {
  if (Platform.OS !== 'web') return null;
  const tenantBlock = guardServiceTenant(tenantId);
  if (tenantBlock) return tenantBlock;
  if (!isLiveServiceMode()) return { ok: false, error: 'Unternehmensdaten benötigen eine aktive Datenverbindung. Es werden keine Beispieldaten verwendet.' };
  const access = await loadCompanyAccess(tenantId);
  if (!access.ok) return access;
  if (access.data.scopeLimited || !access.data.permissions.includes(TENANT_SETTINGS_PERMISSION)) return { ok: false, error: 'Für unternehmensweite Angaben benötigen Sie die entsprechende Berechtigung ohne Bereichsbeschränkung.' };
  return null;
}
