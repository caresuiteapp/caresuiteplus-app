let current: { release(): void } | null = null;
/** One ambient/command capture at a time, including overlapping mounted workspaces. */
export function claimNeoMicrophone(stop: () => void): () => void {
  current?.release();
  const claim = { release: stop }; current = claim;
  return () => { if (current === claim) current = null; };
}
