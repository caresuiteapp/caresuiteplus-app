import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceResult } from '@/types';

type UseMutationOptions<TOutput> = {
  onSuccess?: (data: TOutput) => void;
  successMessage?: string;
  successDurationMs?: number;
  /** Identity of the permitted mutation target; old completions cannot apply to a new target. */
  scopeKey?: string;
};

export function useMutation<TInput, TOutput>(
  mutator: (input: TInput) => Promise<ServiceResult<TOutput>>,
  options?: UseMutationOptions<TOutput>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [stateScope, setStateScope] = useState(options?.scopeKey);
  const requestState = useMemo(() => ({ scopeKey: options?.scopeKey, inFlight: false, timer: null as ReturnType<typeof setTimeout> | null }), [options?.scopeKey]);
  const currentRequest = useRef(requestState); currentRequest.current = requestState;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (requestState.timer) clearTimeout(requestState.timer); }, [requestState]);
  if (stateScope !== options?.scopeKey) {
    setStateScope(options?.scopeKey); setLoading(false); setError(null); setSuccessMessage(null);
  }

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput | null> => {
      const canApply = () => mounted.current && currentRequest.current === requestState;
      if (!canApply() || requestState.inFlight) return null;
      requestState.inFlight = true;
      if (requestState.timer) { clearTimeout(requestState.timer); requestState.timer = null; }
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const result = await mutator(input);
        if (!canApply()) return null;
        if (result.ok) {
          options?.onSuccess?.(result.data);
          if (options?.successMessage) {
            setSuccessMessage(options.successMessage);
            requestState.timer = setTimeout(() => {
              requestState.timer = null;
              if (canApply()) setSuccessMessage(null);
            }, options.successDurationMs ?? 2500);
          }
          return result.data;
        }
        setError(result.error);
        return null;
      } catch (cause) {
        if (canApply()) setError(cause instanceof Error ? cause.message : 'Speichern fehlgeschlagen. Bitte versuchen Sie es erneut.');
        return null;
      } finally {
        requestState.inFlight = false;
        if (canApply()) setLoading(false);
      }
    },
    [mutator, options, requestState],
  );

  const reset = useCallback(() => {
    if (!mounted.current || currentRequest.current !== requestState) return;
    if (requestState.timer) { clearTimeout(requestState.timer); requestState.timer = null; }
    setError(null);
    setSuccessMessage(null);
  }, [requestState]);

  return { mutate, loading, error, successMessage, reset };
}
