import { useCallback, useEffect, useState } from 'react';
import {
  probeAssistVisitPersistence,
  type AssistDataSourceProbeResult,
} from '@/lib/assist/assistDataSourceProbe';
import { useServiceTenantId } from '@/hooks/useTenantId';

const IDLE_PROBE: AssistDataSourceProbeResult = { blocking: false, title: '', message: '' };

export function useAssistDataSource() {
  const tenantId = useServiceTenantId();
  const [probe, setProbe] = useState<AssistDataSourceProbeResult>(IDLE_PROBE);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await probeAssistVisitPersistence(tenantId);
    setProbe(result);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...probe, loading, refresh };
}
