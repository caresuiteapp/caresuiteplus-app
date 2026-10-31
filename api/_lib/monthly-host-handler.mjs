import {authenticateMonthly} from '../../services/gkv/monthly-auth.mjs';
import {readMonthlyOriginalCommand,readMonthlyOriginalResponse,MONTHLY_WIRE_LIMIT} from '../../src/lib/gkvExchange/monthlyOriginalContract.ts';
import {callMonthlyHost} from './monthly-host-transport.mjs';
const status = code => code === 'MONTHLY_AUTH' ? 401 : code === 'MONTHLY_FORBIDDEN' ? 403 : ['MONTHLY_INPUT','MONTHLY_PAPER_PROFILE'].includes(code) ? 400
  : code === 'MONTHLY_FILE_SIZE' ? 413 : ['MONTHLY_STALE','MONTHLY_BUSY','MONTHLY_COMPONENT_HELD','MONTHLY_COMPONENT_PIN_REQUIRED','MONTHLY_SIGNATURE_NOT_STORED','MONTHLY_SIGNATURE_REUSED','MONTHLY_QUOTA'].includes(code) ? 409 : 503;
export function createMonthlyHostHandler({env,fetch:http=fetch}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','private, no-store'); res.setHeader('X-Content-Type-Options','nosniff');
    if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({error:'MONTHLY_INPUT'}); }
    if (req.headers['content-encoding'] || !/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')) return res.status(415).json({error:'MONTHLY_INPUT'});
    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!body || Buffer.byteLength(body)>MONTHLY_WIRE_LIMIT) return res.status(413).json({error:'MONTHLY_FILE_SIZE'});
      let input; try { input=readMonthlyOriginalCommand(JSON.parse(body)); } catch { return res.status(400).json({error:'MONTHLY_INPUT'}); }
      const principal=await authenticateMonthly({url:env.EXPO_PUBLIC_SUPABASE_URL,key:env.EXPO_PUBLIC_SUPABASE_ANON_KEY},req.headers.authorization,http);
      if (!env.GKV_MONTHLY_HOST_URL) return res.status(503).json({error:'MONTHLY_UNCONFIGURED'});
      const result=await callMonthlyHost(env,input,req.headers.authorization);
      return res.status(200).json(readMonthlyOriginalResponse(result,input,principal.actorId));
    } catch (error) {
      const code=['MONTHLY_AUTH','MONTHLY_FORBIDDEN','MONTHLY_STALE','MONTHLY_UNCONFIGURED','MONTHLY_BUSY','MONTHLY_COMPONENT_HELD','MONTHLY_COMPONENT_PIN_REQUIRED','MONTHLY_SIGNATURE_NOT_STORED','MONTHLY_PAPER_PROFILE','MONTHLY_INPUT','MONTHLY_FILE_SIZE','MONTHLY_SIGNATURE_REUSED','MONTHLY_QUOTA'].includes(error?.message) ? error.message : 'MONTHLY_UNAVAILABLE';
      return res.status(status(code)).json({error:code});
    }
  };
}
