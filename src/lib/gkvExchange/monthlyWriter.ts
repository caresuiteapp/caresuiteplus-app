import { MonthlyProofWriteError, type MonthlyProof, type MonthlyProofCommand } from './monthlyProof';
import { commandTarget, type MonthlyRequestStatus } from './monthlyWorkspace';

type Pending = {command: MonthlyProofCommand; requestId: string};
type Transport = {
  execute(command: MonthlyProofCommand, requestId: string): Promise<MonthlyProof>;
  status(requestId: string): Promise<MonthlyRequestStatus>;
};
/** One instance per authenticated workspace. Unknown results retain the exact
 * command and request ID; checking status never sends another write. */
export class MonthlyProofWriter {
  pending: Pending | null = null;
  busy = false;
  checkedNotFound = false;
  private readonly transport: Transport;
  private readonly newId: () => string;
  constructor(transport: Transport, newId: () => string) { this.transport = transport; this.newId = newId; }
  async submit(command: MonthlyProofCommand): Promise<MonthlyProof> {
    if (this.busy || this.pending) throw new Error('Bitte zuerst das Ergebnis der laufenden Speicherung klären.');
    this.pending = {command: structuredClone(command), requestId: this.newId()};
    return this.send();
  }
  private async send(): Promise<MonthlyProof> {
    if (this.busy || !this.pending) throw new Error('Kein unveränderter Speicherauftrag verfügbar.');
    const pending = this.pending;
    this.busy = true; this.checkedNotFound = false;
    try {
      const proof = await this.transport.execute(pending.command, pending.requestId);
      if (proof.id !== commandTarget(pending.command)) throw new Error('Die Speicherantwort gehört nicht zu diesem Auftrag.');
      this.pending = null;
      return proof;
    } catch (error) {
      if (error instanceof MonthlyProofWriteError && !error.uncertain) this.pending = null;
      throw error;
    } finally { this.busy = false; }
  }
  async check(): Promise<MonthlyRequestStatus> {
    if (this.busy || !this.pending) throw new Error('Kein ungeklärter Speicherauftrag verfügbar.');
    const pending = this.pending; this.busy = true; this.checkedNotFound = false;
    try {
      const status = await this.transport.status(pending.requestId);
      if (status.state === 'applied') {
        if (status.proof.id !== commandTarget(pending.command)) throw new Error('Die Auftragsantwort gehört nicht zu dieser Fassung.');
        this.pending = null; this.checkedNotFound = false;
      } else this.checkedNotFound = true;
      return status;
    } finally { this.busy = false; }
  }
  async retry(): Promise<MonthlyProof> {
    if (!this.checkedNotFound) throw new Error('Bitte zuerst den gespeicherten Auftrag prüfen.');
    return this.send();
  }
}
