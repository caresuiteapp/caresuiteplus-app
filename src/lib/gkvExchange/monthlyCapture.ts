import {monthlyBase64,readMonthlyOriginalResponse,type MonthlyCapture,type MonthlyOriginalCommand,type MonthlyOriginalReceipt,type MonthlyOriginalResponse} from './monthlyOriginalContract';
import {monthlySha256} from './monthlyOriginalClient';
type Transport=(command:MonthlyOriginalCommand)=>Promise<MonthlyOriginalResponse>;
/** Memory-only capture. No PNG/token in browser storage. A failed write retains
 * its exact request until a read-only status check or explicit abandonment. */
export class MonthlyCaptureSession {
  readonly input:MonthlyCapture;
  original:Extract<MonthlyOriginalResponse,{kind:'original'}>|null=null;
  receipt:MonthlyOriginalReceipt|null=null;
  pending:MonthlyOriginalCommand|null=null;
  checked=false;busy=false;
  #send:Transport;#content:string;#actor:string|null=null;#signatureHash:string|null=null;
  constructor(input:MonthlyCapture,contentSha256:string,send:Transport){this.input=structuredClone(input);this.#content=contentSha256;this.#send=send;}
  async #request(command:MonthlyOriginalCommand){
    const raw=await this.#send(structuredClone(command));
    const value=readMonthlyOriginalResponse(raw,command,this.#actor ?? raw.actorId);
    if(this.#actor && value.actorId!==this.#actor)throw Error('Die persönliche Anmeldung hat sich geändert.');
    this.#actor=value.actorId;
    if(value.kind==='original' || value.kind==='state' && value.original){
      if(value.original!.contentSha256!==this.#content || this.original && value.original!.originalSha256!==this.original.original.originalSha256)throw Error('Die Originalfassung hat sich geändert.');
    }
    const receipt=value.kind==='receipt'?value.receipt:value.kind==='state'?value.receipt:null;
    if(receipt && (receipt.contentSha256!==this.#content || !this.original || receipt.originalSha256!==this.original.original.originalSha256
      || this.#signatureHash && receipt.signatureSha256!==this.#signatureHash))throw Error('Der Prüfbeleg passt nicht zur erfassten Unterschrift.');
    return value;
  }
  async #write(command:MonthlyOriginalCommand){
    if(this.busy)throw Error('Ein Vorgang wird bereits bearbeitet.');
    this.busy=true;this.pending=structuredClone(command);this.checked=false;
    try{
      const result=await this.#request(command);
      if(result.kind==='original')this.original=result;
      else if(result.kind==='acknowledged' && this.original)this.original={...this.original,original:{...this.original.original,acknowledged:true}};
      else if(result.kind==='receipt')this.receipt=result.receipt;
      this.pending=null;return result;
    }finally{this.busy=false;}
  }
  prepare(){if(this.pending || this.original)throw Error('Bitte zuerst die laufende Erfassung klären.');return this.#write({...this.input,action:'prepare'});}
  acknowledge(){if(this.pending || !this.original || this.receipt)throw Error('Bitte zuerst das Original öffnen.');return this.#write({...this.input,action:'acknowledge',originalSha256:this.original.original.originalSha256});}
  async verify(pngBase64:string){
    if(this.busy || this.pending || !this.original?.original.acknowledged || this.receipt)throw Error('Bitte zuerst die Originalfassung prüfen.');
    this.busy=true;
    try{this.#signatureHash=await monthlySha256(monthlyBase64(pngBase64));}finally{this.busy=false;}
    return this.#write({...this.input,action:'verify',pngBase64});
  }
  async check(){
    if(this.busy || !this.pending)throw Error('Kein ungeklärter Erfassungsauftrag vorhanden.');
    this.busy=true;this.checked=false;
    try{
      const value=await this.#request({...this.input,action:'status'});
      if(value.kind!=='state')throw Error('Der Erfassungsstatus fehlt.');
      if(value.state!=='absent' && !this.original){
        const original=await this.#request({...this.input,action:'read'});if(original.kind!=='original')throw Error('Das Original fehlt.');this.original=original;
      }
      if(this.original && value.original)this.original={...this.original,original:value.original};
      if(value.receipt){this.receipt=value.receipt;this.pending=null;}
      else if(this.pending.action==='prepare' && value.state!=='absent' || this.pending.action==='acknowledge' && value.original?.acknowledged)this.pending=null;
      else this.checked=true;
      return value;
    }finally{this.busy=false;}
  }
  retry(){if(!this.checked || !this.pending)throw Error('Bitte zuerst den Erfassungsstatus prüfen.');return this.#write(this.pending);}
}
