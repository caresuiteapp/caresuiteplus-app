/** Bounded, sequential readback. A deadline never means that the write failed. */
export function pollSignatureConfirmation(options: {
  refresh: () => Promise<unknown>;
  onUnconfirmed: () => void;
  maxWaitMs?: number;
}): () => void {
  let stopped = false;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    clearTimeout(deadline);
    if (retry) clearTimeout(retry);
  };
  const unconfirmed = () => {
    if (stopped) return;
    stop();
    options.onUnconfirmed();
  };
  // Independent of refresh: even a request that never settles must release the waiting UI.
  const deadline = setTimeout(unconfirmed, options.maxWaitMs ?? 30_000);
  const check = async () => {
    if (stopped) return;
    attempts += 1;
    try {
      await options.refresh();
    } catch {
      unconfirmed();
      return;
    }
    if (!stopped) retry = setTimeout(() => void check(), attempts < 5 ? 1_500 : 3_000);
  };
  retry = setTimeout(() => void check(), 800);
  return stop;
}
