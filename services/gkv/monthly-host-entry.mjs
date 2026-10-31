/** Existing Node 24 host, no Vercel temporary volume. Local configuration only:
 * node --import ./services/gkv/register.mjs services/gkv/monthly-host-entry.mjs /absolute/config.mjs
 * createConfiguration() returns {tenantId,storePath,archiveKey,supabase,
 * workerKeyId,workerKey,tls,clientSha256,port,bindAddress?,maxTenantBytes?}.
 * Provisioning secrets/SQL/roles is a separate reviewed deployment step. */
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {MonthlyOriginalStore} from './monthly-original-store.mjs';
import {MonthlyComponentSigner} from './monthly-component-signer.mjs';
import {MonthlyOriginalHost,createMonthlyHostServer} from './monthly-host.mjs';
let host,server,store;
try {
  if (process.argv.length !== 3 || !isAbsolute(process.argv[2])) throw Error();
  const config = await (await import(pathToFileURL(process.argv[2]).href)).createConfiguration();
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw Error();
  store = new MonthlyOriginalStore({path:config.storePath,key:config.archiveKey,maxTenantBytes:config.maxTenantBytes});
  const componentSigner=config.smcb?new MonthlyComponentSigner({...config.smcb,tenantId:config.tenantId,store}):undefined;
  host = new MonthlyOriginalHost({...config,store,componentSigner});
  server = createMonthlyHostServer({host,tls:config.tls,clientSha256:config.clientSha256});
  server.listen(config.port,config.bindAddress || '127.0.0.1'); await once(server,'listening');
  process.stdout.write('Monthly original host ready; no automatic capture or confirmation.\n');
  let stopping = false;
  for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => {
    if (stopping) return; stopping = true;
    server.close(() => { host.close(); }); server.closeIdleConnections();
  });
} catch { server?.close(); if (host) host.close(); else store?.close(); process.stderr.write('MONTHLY_HOST_START_FAILED\n'); process.exitCode = 1; }
