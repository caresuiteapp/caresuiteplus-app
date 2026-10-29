import type {PaperScan,PaperReview} from './monthlyPaper';
import {monthlyBase64,readMonthlyOriginalResponse,type MonthlyCapture,type MonthlyOriginalCommand,type MonthlyOriginalReceipt,type MonthlyOriginalResponse} from './monthlyOriginalContract';
import {monthlySha256} from './monthlyOriginalClient';
type Transport=(command:MonthlyOriginalCommand)=>Promise<MonthlyOriginalResponse>;
/** Memory-only capture. No PNG/token in browser storage. A failed write retains
 * its exact request until a read-only status check or explicit abandonment. */
export class MonthlyCaptureSession {
  readonly input:MonthlyCapture;
  original:Extract<MonthlyOriginalResponse,{kind:'original'}>|null=null;
  receipt:MonthlyOriginalReceipt|null=null;
  scan:PaperScan|null=null;
  pending:MonthlyOriginalCommand|null=null;
  checked=false;busy=false;
  #send:Transport;#content:string;#actor:string|null=null;#signatureHash:string|null=null;#scanHash:string|null=null;
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
    const boundOriginal=this.original?.original ?? (value.kind==='state'?value.original:null);
    if(receipt && (receipt.contentSha256!==this.#content || !boundOriginal || receipt.originalSha256!==boundOriginal.originalSha256
      || this.#signatureHash && receipt.signatureSha256!==this.#signatureHash))throw Error('Der Prüfbeleg passt nicht zur erfassten Unterschrift.');
    const scan=value.kind==='scan'?value.scan:value.kind==='state'?value.scan:null;
    if(scan && (this.original && scan.pages.length!==this.original.original.paper?.pageCount || (this.#scanHash && scan.scanSha256!==this.#scanHash) || this.scan && JSON.stringify(scan)!==JSON.stringify(this.scan)))throw Error('Der Scan passt nicht zur gespeicherten Erfassung.');
    if(receipt?.paper && (receipt.paper.scanSha256!==(scan ?? this.scan)?.scanSha256 || JSON.stringify(receipt.paper.pageSha256)!==JSON.stringify((scan ?? this.scan)?.pages.map(p=>p.sha256))))throw Error('Der Prüfbeleg passt nicht zum geprüften Scan.');
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
      else if(result.kind==='scan')this.scan=result.scan;
      else if(result.kind==='state'){this.scan=result.scan ?? null;this.receipt=result.receipt;if(this.original&&result.original)this.original={...this.original,original:result.original};}
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
  async resume(){
    if(this.busy||this.pending||this.original||this.input.method!=='paper')throw Error('Keine fortsetzbare Papiererfassung.');
    await this.#write({...this.input,action:'read'});return this.#write({...this.input,action:'status'});
  }
  async uploadScan(pdfBase64:string){
    if(this.busy||this.pending||this.scan||this.receipt||!this.original?.original.acknowledged||this.input.method!=='paper')throw Error('Bitte zuerst die Druckfassung prüfen.');
    this.busy=true;try{this.#scanHash=await monthlySha256(monthlyBase64(pdfBase64));}finally{this.busy=false;}
    return this.#write({...this.input,action:'upload-scan',pdfBase64});
  }
  async readScanPage(page:number){
    if(this.busy||this.pending||!this.scan||!this.scan.pages[page-1])throw Error('Die Scanseite ist nicht verfügbar.');
    this.busy=true;
    try{const result=await this.#request({...this.input,action:'scan-page',page,scanSha256:this.scan.scanSha256});
      const expected=this.scan.pages[page-1];
      if(result.kind!=='scan-page'||result.sha256!==expected.sha256||result.width!==expected.width||result.height!==expected.height)throw Error('Die Scanseite stimmt nicht mit dem Archiv überein.');
      return result;
    }finally{this.busy=false;}
  }
  reviewScan(review:PaperReview){
    if(this.busy||this.pending||this.receipt||!this.scan||this.scan.scanSha256!==review.scanSha256)throw Error('Bitte zuerst den vollständigen Scan prüfen.');
    return this.#write({...this.input,action:'review-scan',review});
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
      this.scan=value.scan ?? null;
      if(this.original && value.original)this.original={...this.original,original:value.original};
      if(value.receipt){this.receipt=value.receipt;this.pending=null;}
      else if(['prepare','read','status'].includes(this.pending.action) && value.state!=='absent' || this.pending.action==='upload-scan' && !!value.scan || this.pending.action==='acknowledge' && value.original?.acknowledged)this.pending=null;
      else this.checked=true;
      return value;
    }finally{this.busy=false;}
  }
  retry(){if(!this.checked || !this.pending)throw Error('Bitte zuerst den Erfassungsstatus prüfen.');return this.#write(this.pending);}
}
