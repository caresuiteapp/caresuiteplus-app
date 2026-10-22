/** node --import ./services/gkv/register.mjs services/kim/host-entry.mjs /absolute/provisioned-config.mjs
 * The trusted local config exports async createConfiguration(), returning
 * { tenantId, storePath, probe, receive?, prepare?, tls, clientSha256, port, bindAddress?, close? }.
 * It constructs the existing pinned Konnektor + TSL/OCSP clients. No credentials
 * are read from browser input, argv values or repository example defaults. */
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { KimDiagnosticHost, createKimHostServer } from './host.mjs';

let host, server, configuration;
try {
  if (process.argv.length !== 3 || !isAbsolute(process.argv[2])) throw new Error('KIM_HOST_CONFIG_PATH');
  const module = await import(pathToFileURL(process.argv[2]).href);
  if (typeof module.createConfiguration !== 'function') throw new Error('KIM_HOST_CONFIGURATION');
  configuration = await module.createConfiguration();
  if (!Number.isInteger(configuration.port) || configuration.port < 1024 || configuration.port > 65535) throw new Error('KIM_HOST_CONFIGURATION');
  host = new KimDiagnosticHost(configuration);
  // Trusted local provisioning may stage already persisted originals. No
  // prepared job starts automatically, including after a service restart.
  if (configuration.prepare !== undefined) {
    if (typeof configuration.prepare !== 'function') throw new Error('KIM_HOST_CONFIGURATION');
    await configuration.prepare(host);
  }
  server = createKimHostServer({ host, tls: configuration.tls, clientSha256: configuration.clientSha256 });
  server.listen(configuration.port, configuration.bindAddress ?? '127.0.0.1'); await once(server, 'listening');
  process.stdout.write('KIM diagnostic host ready; delivery disabled.\n');
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    server.close(); server.closeIdleConnections(); await host.close(); await configuration.close?.();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void stop().catch(() => { process.exitCode = 1; }); });
} catch {
  server?.close(); await host?.close(); await configuration?.close?.();
  process.stderr.write('KIM_HOST_START_FAILED\n'); process.exitCode = 1;
}
