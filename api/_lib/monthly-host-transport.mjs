import https from 'node:https';
import {isIP} from 'node:net';
import {checkServerIdentity,createSecureContext} from 'node:tls';
import {createHash} from 'node:crypto';
import {MONTHLY_WIRE_LIMIT} from '../../src/lib/gkvExchange/monthlyOriginalContract.ts';

/** Unlike tenant-only diagnostics, confirmation requires the personal token.
 * It travels only to this fixed, pinned, mutually authenticated host. Never log,
 * persist, redirect or send it to any caller-selected address. */
export function callMonthlyHost(env,input,authorization) {
  let url,secureContext;
  try {
    url = new URL(env.GKV_MONTHLY_HOST_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/v1/monthly-originals'
      || !/^[a-f0-9]{64}$/.test(env.GKV_MONTHLY_HOST_SHA256 || '') || env.GKV_MONTHLY_HOST_CONNECT_ADDRESS && !isIP(env.GKV_MONTHLY_HOST_CONNECT_ADDRESS)
      || !env.GKV_MONTHLY_HOST_CA || !env.GKV_MONTHLY_CLIENT_CERT || !env.GKV_MONTHLY_CLIENT_KEY) throw Error();
    secureContext = createSecureContext({ca:env.GKV_MONTHLY_HOST_CA,cert:env.GKV_MONTHLY_CLIENT_CERT,key:env.GKV_MONTHLY_CLIENT_KEY,
      passphrase:env.GKV_MONTHLY_CLIENT_PASSPHRASE,minVersion:'TLSv1.2'});
  } catch { return Promise.reject(Error('MONTHLY_UNCONFIGURED')); }
  return new Promise((resolve,reject) => {
    const data = Buffer.from(JSON.stringify(input)); let request,response,done=false,size=0; const chunks=[];
    const finish = (error,value) => { if (done) return; done=true; clearTimeout(timer); request?.destroy(); response?.destroy(); data.fill(0); error ? reject(Error(error)) : resolve(value); };
    const timer = setTimeout(() => finish('MONTHLY_UNAVAILABLE'),25000);
    try {
      request = https.request(url,{method:'POST',agent:false,secureContext,rejectUnauthorized:true,maxHeaderSize:8192,
        ...(env.GKV_MONTHLY_HOST_CONNECT_ADDRESS ? {lookup:(_host,options,callback) => {
          const address=env.GKV_MONTHLY_HOST_CONNECT_ADDRESS,family=isIP(address);
          callback(null,options.all ? [{address,family}] : address,...(options.all ? [] : [family]));
        }} : {}),
        checkServerIdentity:(hostname,peer) => checkServerIdentity(hostname,peer)
          || (!peer.raw || createHash('sha256').update(peer.raw).digest('hex') !== env.GKV_MONTHLY_HOST_SHA256 ? Error('MONTHLY_TLS') : undefined),
        headers:{Authorization:authorization,'Content-Type':'application/json','Content-Length':data.length,Accept:'application/json','Accept-Encoding':'identity'}
      },incoming => {
        response=incoming; incoming.on('error',() => finish('MONTHLY_UNAVAILABLE'));
        if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(incoming.headers['content-type'] || '') || incoming.headers['content-encoding'] !== undefined) return finish('MONTHLY_UNAVAILABLE');
        incoming.on('data',chunk => { size+=chunk.length; if (size>MONTHLY_WIRE_LIMIT) finish('MONTHLY_UNAVAILABLE'); else chunks.push(chunk); });
        incoming.on('end',() => {
          try {
            if (!incoming.complete) throw Error(); const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (incoming.statusCode !== 200) {
              const allowed=['MONTHLY_AUTH','MONTHLY_FORBIDDEN','MONTHLY_STALE','MONTHLY_BUSY','MONTHLY_FILE_SIZE','MONTHLY_PAPER_PROFILE','MONTHLY_INPUT','MONTHLY_SIGNATURE_REUSED','MONTHLY_QUOTA'];
              return finish(allowed.includes(value?.error) ? value.error : 'MONTHLY_UNAVAILABLE');
            }
            finish(null,value);
          } catch { finish('MONTHLY_UNAVAILABLE'); }
        });
        incoming.on('close',() => { if (!done) finish('MONTHLY_UNAVAILABLE'); });
      });
      request.on('error',() => finish('MONTHLY_UNAVAILABLE')); request.end(data);
    } catch { finish('MONTHLY_UNAVAILABLE'); }
  });
}
