export const SERVICE_QUERY_TIMEOUT_MS = 120_000;
/** Native app queries fail visibly and retry instead of leaving a two-minute spinner. */
export const NATIVE_SERVICE_QUERY_TIMEOUT_MS = 15_000;

export function getServiceQueryTimeoutMs(): number {
  return SERVICE_QUERY_TIMEOUT_MS;
}

export async function withServiceQueryTimeout<T>(
  promise: Promise<T>,
  label = 'Datenabfrage',
  timeoutMs = SERVICE_QUERY_TIMEOUT_MS,
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
