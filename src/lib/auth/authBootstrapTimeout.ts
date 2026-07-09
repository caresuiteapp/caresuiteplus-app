const BOOTSTRAP_TIMEOUT_MS = 12_000;

export function getAuthBootstrapTimeoutMs(): number {
  return BOOTSTRAP_TIMEOUT_MS;
}

export async function withAuthBootstrapTimeout<T>(
  promise: Promise<T>,
  label = 'Profil-Bootstrap',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} hat zu lange gedauert.`));
        }, BOOTSTRAP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
