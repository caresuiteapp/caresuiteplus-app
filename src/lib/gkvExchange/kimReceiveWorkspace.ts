import { readKimReceiveList, readKimReceiveStatus, type KimHostCommand, type KimReceiveCursor, type KimReceiveList, type KimReceiveStatus } from './kimReceiveContract';

export type KimReceiveView = {
  page: KimReceiveList | null; job: KimReceiveStatus | null; pageNumber: number;
  busy: 'list' | 'detail' | 'start' | null; listError: string; detailError: string; uncertain: boolean;
};
export const emptyKimReceiveView = (): KimReceiveView => ({ page: null, job: null, pageNumber: 1, busy: null, listError: '', detailError: '', uncertain: false });
type Transport = (command: KimHostCommand, signal: AbortSignal) => Promise<unknown>;
type Operation = { controller: AbortController; kind: 'list' | 'detail' | 'start' };
const message = (e: unknown) => e instanceof Error && !e.message.startsWith('KIM_') ? e.message : 'Der Prüfstatus passt nicht zum Auftrag oder ist unlesbar. Bitte erneut abfragen.';
const boundStatus = (value: unknown, expected: KimReceiveStatus) => {
  const job = readKimReceiveStatus(value, expected.tenantId, expected.requestId);
  if (job.mailboxId !== expected.mailboxId || job.messageId !== expected.messageId || job.originalSha256 !== expected.originalSha256
    || job.createdAt !== expected.createdAt || job.environment !== expected.environment) throw new Error('KIM_HOST_RESPONSE');
  return job;
};

/** One mounted, authorized workspace. Browser cancellation only abandons the
 * response; it never cancels or retries a durable card operation on the host. */
export class KimReceiveWorkspace {
  #tenant: string; #transport: Transport; #changed: (view: KimReceiveView) => void;
  #view = emptyKimReceiveView(); #history: (KimReceiveCursor | null)[] = []; #closed = false;
  #active: Operation | null = null;
  constructor(tenantId: string, transport: Transport, changed: (view: KimReceiveView) => void) {
    this.#tenant = tenantId; this.#transport = transport; this.#changed = changed;
  }
  get view() { return this.#view; }
  #set(change: Partial<KimReceiveView>) { this.#view = { ...this.#view, ...change }; if (!this.#closed) this.#changed(this.#view); }
  #begin(kind: 'list' | 'detail' | 'start') {
    if (this.#closed || this.#active?.kind === 'start') return null;
    this.#active?.controller.abort();
    const operation = { controller: new AbortController(), kind }; this.#active = operation; this.#set({ busy: kind }); return operation;
  }
  #signal(operation: Operation) { return AbortSignal.any([operation.controller.signal, AbortSignal.timeout(30000)]); }
  async #request(command: KimHostCommand, signal: AbortSignal) { return this.#transport(command, signal); }
  #current(operation: unknown) { return !this.#closed && this.#active === operation; }
  async #load(before: KimReceiveCursor | null, history: (KimReceiveCursor | null)[], navigate = false) {
    if (navigate && this.#view.uncertain) return;
    const job = navigate ? null : this.#view.job, op = this.#begin('list'); if (!op) return;
    this.#set({ listError: '', detailError: '', ...(navigate ? { job: null } : {}) });
    const signal = this.#signal(op);
    // Independent metadata reads. A failed list must not discard a successfully
    // reconciled start, and an old selection cannot overwrite a new selection.
    const [page, detail] = await Promise.allSettled([
      this.#request({ tenantId: this.#tenant, action: 'receive-list', before }, signal).then(v => readKimReceiveList(v, this.#tenant, before)),
      job ? this.#request({ tenantId: this.#tenant, action: 'receive-status', requestId: job.requestId }, signal).then(v => boundStatus(v, job)) : Promise.resolve(null),
    ]);
    if (!this.#current(op)) return;
    this.#active = null;
    if (page.status === 'fulfilled') this.#history = history;
    this.#set({ busy: null,
      ...(page.status === 'fulfilled' ? { page: page.value, pageNumber: history.length + 1 } : { listError: message(page.reason) }),
      ...(detail.status === 'fulfilled' ? { job: detail.value, ...(job ? { uncertain: false } : {}) } : { detailError: message(detail.reason) }),
    });
  }
  refresh() { return this.#load(this.#view.page?.before ?? null, this.#history); }
  first() { return this.#load(null, [], true); }
  next() {
    const page = this.#view.page;
    if (page?.nextCursor) return this.#load(page.nextCursor, [...this.#history, page.before], true);
  }
  previous() {
    if (this.#history.length) return this.#load(this.#history[this.#history.length - 1], this.#history.slice(0, -1), true);
  }
  async select(requestId: string) {
    if (this.#view.uncertain) return;
    const job = this.#view.page?.items.find(item => item.requestId === requestId); if (!job) return;
    const op = this.#begin('detail'); if (!op) return;
    this.#set({ job, detailError: '' });
    try {
      const value = boundStatus(await this.#request({ tenantId: this.#tenant, action: 'receive-status', requestId }, this.#signal(op)), job);
      if (this.#current(op)) this.#set({ job: value });
    } catch (e) { if (this.#current(op)) this.#set({ detailError: message(e) }); }
    finally { if (this.#current(op)) { this.#active = null; this.#set({ busy: null }); } }
  }
  async start() {
    const view = this.#view, job = view.job;
    if (view.busy || view.uncertain || view.listError || view.detailError || !view.page?.canStart || !job?.canStart || job.state !== 'prepared') return;
    const op = this.#begin('start'); if (!op) return;
    try {
      const value = boundStatus(await this.#request({ tenantId: this.#tenant, action: 'receive-start', requestId: job.requestId }, this.#signal(op)), job);
      if (!this.#current(op)) return;
      this.#active = null; this.#set({ job: value, busy: null });
      await this.refresh();
    } catch (e) {
      if (this.#current(op)) { this.#active = null; this.#set({ busy: null, uncertain: true,
        detailError: 'Die Startantwort konnte nicht bestätigt werden. Der Auftrag kann am Host laufen. Bitte zuerst den Status abfragen. ' + message(e) }); }
    }
  }
  dispose() { this.#closed = true; this.#active?.controller.abort(); this.#active = null; }
}
