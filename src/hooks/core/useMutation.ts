import { useCallback, useRef, useState } from 'react';
import type { ServiceResult } from '@/types';

type UseMutationOptions<TOutput> = {
  onSuccess?: (data: TOutput) => void;
  successMessage?: string;
  successDurationMs?: number;
};

export function useMutation<TInput, TOutput>(
  mutator: (input: TInput) => Promise<ServiceResult<TOutput>>,
  options?: UseMutationOptions<TOutput>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const lockRef = useRef(false);

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput | null> => {
      if (lockRef.current || loading) return null;
      lockRef.current = true;
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      const result = await mutator(input);
      setLoading(false);
      lockRef.current = false;

      if (result.ok) {
        options?.onSuccess?.(result.data);
        if (options?.successMessage) {
          setSuccessMessage(options.successMessage);
          setTimeout(
            () => setSuccessMessage(null),
            options.successDurationMs ?? 2500,
          );
        }
        return result.data;
      }

      setError(result.error);
      return null;
    },
    [loading, mutator, options],
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    successMessage,
    reset,
  };
}
