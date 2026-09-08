// Polling, subscriptions and manual refreshes share one scope per visible query.
// A retired scope cannot publish data or errors into a different ticket/filter.
export function createSupportReadScope() {
  let active = true;
  let revision = 0;

  return {
    activate() { active = true; },
    dispose() { active = false; revision += 1; },
    async run<T>(read: () => Promise<T>, onData: (data: T) => void, onError: (cause: unknown) => void): Promise<void> {
      if (!active) return;
      const request = ++revision;
      try {
        const data = await read();
        if (active && request === revision) onData(data);
      } catch (cause) {
        if (active && request === revision) onError(cause);
      }
    },
  };
}
