const DEFAULT_QUERY_TIMEOUT_MS = 25_000;

export function getServiceQueryTimeoutMs(): number {
  return DEFAULT_QUERY_TIMEOUT_MS;
}

export async function withServiceQueryTimeout<T>(
  promise: Promise<T>,
  label = 'Datenabfrage',
  timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} hat zu lange gedauert.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
