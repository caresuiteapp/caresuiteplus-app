// POP3 transaction core (RFC 1939). Must be hosted behind verified TLS, with per-connection input limits.
// Deletions are committed only by QUIT, never by disconnect or failed authentication.
export class Pop3Session {
  #store; #user; #session; #deleted = new Set(); #closed = false; #busy = false;
  constructor(store, { tlsVerified }) {
    if (tlsVerified !== true) throw new Error('POP3_TLS_REQUIRED'); this.#store = store;
  }
  greeting() { return Buffer.from('+OK CareSuite mail service ready\r\n'); }
  async command(line) {
    if (this.#busy) throw new Error('POP3_SERIAL_COMMANDS_REQUIRED');
    if (this.#closed) throw new Error('POP3_CLOSED');
    this.#busy = true;
    try { return await this.#execute(line); }
    catch { return Buffer.from('-ERR operation unavailable\r\n'); }
    finally { this.#busy = false; }
  }
  async #execute(line) {
    if (typeof line !== 'string' || line.length > 512 || /[\r\n\x00]/.test(line)) return Buffer.from('-ERR invalid command\r\n');
    const match = /^([A-Za-z]+)(?: (.*))?$/.exec(line);
    if (!match) return Buffer.from('-ERR invalid command\r\n');
    const command = match[1].toUpperCase(), arg = match[2], ok = text => Buffer.from(`+OK${text ? ` ${text}` : ''}\r\n`);
    const multi = lines => Buffer.from(`+OK\r\n${lines.length ? lines.join('\r\n') + '\r\n' : ''}.\r\n`);
    if (command === 'CAPA' && arg === undefined) return multi(['TOP', 'USER', 'UIDL', 'RESP-CODES', 'IMPLEMENTATION CareSuite']);
    if (command === 'QUIT' && arg === undefined) {
      if (this.#session) this.#store.endMailbox(this.#user, this.#session.token, [...this.#deleted]);
      this.#closed = true; return ok('bye');
    }
    if (!this.#session) {
      if (command === 'USER' && arg && !/\s/.test(arg)) { this.#user = arg; return ok(); }
      if (command === 'PASS' && this.#user && arg !== undefined) {
        if (!await this.#store.authenticate(this.#user, arg)) return Buffer.from('-ERR [AUTH] authentication failed\r\n');
        if (this.#closed) throw new Error('POP3_CLOSED');
        this.#session = this.#store.beginMailbox(this.#user); return ok();
      }
      return Buffer.from('-ERR authentication required\r\n');
    }
    this.#store.touchMailbox(this.#user, this.#session.token);
    const active = this.#session.messages.filter(m => !this.#deleted.has(m.uid));
    if (command === 'STAT' && arg === undefined) return ok(`${active.length} ${active.reduce((n, m) => n + m.octets, 0)}`);
    if (command === 'NOOP' && arg === undefined) return ok();
    if (command === 'RSET' && arg === undefined) { this.#deleted.clear(); return ok(); }
    if ((command === 'LIST' || command === 'UIDL') && arg === undefined) return multi(active.map(m => `${m.number} ${command === 'LIST' ? m.octets : m.uid}`));
    if (command === 'TOP' && /^[1-9]\d{0,8} (?:0|[1-9]\d{0,8})$/.test(arg ?? '')) {
      const [number, count] = arg.split(' ').map(Number), m = active.find(entry => entry.number === number);
      if (!m) return Buffer.from('-ERR no such message\r\n');
      const wire = this.#store.readMessage(this.#user, this.#session.token, m.uid).toString('latin1'), split = wire.indexOf('\r\n\r\n');
      if (split < 0 || !wire.endsWith('\r\n') || /(?<!\r)\n|\r(?!\n)/.test(wire)) throw new Error('POP3_NONCANONICAL_MESSAGE');
      const content = wire.slice(split + 4), body = content ? content.slice(0, -2).split('\r\n').slice(0, count) : [];
      const top = wire.slice(0, split + 4) + (body.length ? body.join('\r\n') + '\r\n' : '');
      return Buffer.concat([ok(), Buffer.from(top.replace(/(^|\r\n)\./g, '$1..') + '.\r\n', 'latin1')]);
    }
    if (['LIST', 'UIDL', 'RETR', 'DELE'].includes(command) && /^[1-9]\d{0,8}$/.test(arg ?? '')) {
      const m = active.find(m => m.number === Number(arg));
      if (!m) return Buffer.from('-ERR no such message\r\n');
      if (command === 'LIST') return ok(`${m.number} ${m.octets}`);
      if (command === 'UIDL') return ok(`${m.number} ${m.uid}`);
      if (command === 'DELE') { this.#deleted.add(m.uid); return ok(); }
      const bytes = this.#store.readMessage(this.#user, this.#session.token, m.uid), wire = bytes.toString('latin1');
      if (!wire.endsWith('\r\n') || /(?<!\r)\n|\r(?!\n)/.test(wire)) throw new Error('POP3_NONCANONICAL_MESSAGE');
      return Buffer.concat([ok(`${m.octets} octets`), Buffer.from(wire.replace(/(^|\r\n)\./g, '$1..') + '.\r\n', 'latin1')]);
    }
    return Buffer.from('-ERR unsupported command\r\n');
  }
  disconnect() { if (this.#session) this.#store.abandonMailbox(this.#user, this.#session.token); this.#closed = true; }
}
