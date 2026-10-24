import { useCallback, useEffect, useRef, useState } from 'react';
import { loadCompanyAccess } from '@/lib/tenant/companyAccessService';
import type { CompanyAccess } from '@/types/tenant/companyAccess';

/** Resolve permissions for the authenticated person; never reuse another actor's scope. */
export function useCompanyAccess(tenantId: string, actorProfileId?: string | null, roleKey?: string | null) {
  const identity = `${tenantId}:${actorProfileId ?? ''}:${roleKey ?? ''}`;
  const sequence = useRef(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ identity: string; data: CompanyAccess | null; loading: boolean; error: string | null }>({ identity, data: null, loading: true, error: null });
  useEffect(() => {
    let alive = true;
    const request = ++sequence.current;
    setState({ identity, data: null, loading: true, error: null });
    void loadCompanyAccess(tenantId).then(result => {
      if (!alive || sequence.current !== request) return;
      setState({ identity, data: result.ok ? result.data : null, loading: false, error: result.ok ? null : result.error });
    }).catch(() => {
      if (alive && sequence.current === request) setState({ identity, data: null, loading: false, error: 'Die Unternehmensrechte konnten nicht geprüft werden.' });
    });
    return () => { alive = false; };
  }, [tenantId, identity, revision]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { ...(state.identity === identity ? state : { data: null, loading: true, error: null }), refresh };
}
