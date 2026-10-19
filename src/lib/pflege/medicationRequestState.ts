/** In-memory request identity. No patient data are written to browser storage. */
export class MedicationRequestState<P extends object> {
  private pending: { id: string; payload: Readonly<P> } | null = null;
  private flight = false;
  private replay = false;

  begin(payload?: P, createId = () => crypto.randomUUID()) {
    if (this.flight || (!this.pending && !payload)) return null;
    const replay = this.pending !== null;
    this.replay = replay;
    const request = this.pending ?? { id: createId(), payload: Object.freeze({ ...payload }) as Readonly<P> };
    this.pending = request;
    this.flight = true;
    return { ...request, replay };
  }

  settle(confirmed: boolean, uncertain = false) {
    // Rejecting a retry does not prove that the original transaction failed.
    if (confirmed || (!uncertain && !this.replay)) this.pending = null;
  }

  release() { this.flight = false; }
}

/** Transport/connection failures may occur after commit and require exact replay. */
export function isDefiniteMedicationRejection(code: string | undefined, status: number | undefined) {
  return /^(?:22|23|40|42)[0-9A-Z]{3}$/.test(code ?? '') || code === 'P0001'
    || (code?.startsWith('PGRST') === true && (status ?? 500) < 500);
}
