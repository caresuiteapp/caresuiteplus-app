// Deliver a small allowlist of existing fictional audit PNGs through CI logs.
// This is transport for visual review, not an additional UI acceptance claim.
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';

const mode=process.argv[2];
const names={
  native:['clients-1280x800.png','web-clients-1280x800.png','clients-320x740.png','web-clients-320x740.png','notes-1280x800.png','web-notes-1280x800.png'],
  administration:[],
  employee:['employee-audit-client-detail-default-error-360x800-scale-1.6.png','employee-audit-open-assignments-default-empty-360x800-scale-1.6.png'],
  client_and_family:['client-audit-request-client-ready-360x800-scale-1.6.png','client-audit-request-client-empty-360x800-scale-1.6.png','client-audit-request-client-ready-1280x800-scale-1.png','client-audit-proofs-client-empty-360x800-scale-1.6.png','client-audit-proofs-client-empty-320x740-scale-1.png','client-audit-profile-client-empty-360x800-scale-1.6.png'],
}[mode];
if(!names)throw Error('Unknown audit image mode.');
const directory=resolve(mode==='native'?(process.env.CARESUITE_NATIVE_QA_DIR??'/tmp/caresuite-native-qa'):(process.env.CARESUITE_NATIVE_PORTAL_AUDIT_DIR??'/tmp/caresuite-native-portal-audit'));
for(const name of names){
  const path=join(directory,name);
  if(!existsSync(path)){console.log(JSON.stringify({kind:'review-image-unavailable',name,source:process.env.GITHUB_SHA}));continue;}
  const bytes=readFileSync(path),base64=bytes.toString('base64'),sha256=createHash('sha256').update(bytes).digest('hex'),size=8192,parts=Math.ceil(base64.length/size);
  for(let part=0;part<parts;part++)console.log('CARESUITE_REVIEW_PNG '+JSON.stringify({name,source:process.env.GITHUB_SHA,bytes:bytes.length,sha256,part,parts,data:base64.slice(part*size,(part+1)*size)}));
}
