import {parentPort,workerData} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {createCanvas} from '@napi-rs/canvas';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {fileURLToPath} from 'node:url';

// Only local bytes and package-owned fonts/decoders. Never execute PDF actions
// or use document-provided URLs. A warning means rendering may be incomplete.
let warned=false,task;
console.log=console.warn=console.error=()=>{warned=true;};
const hash=b=>createHash('sha256').update(b).digest('hex');
class BoundedCanvas {
  check(width,height){if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>16_000_000)throw Error();}
  create(width,height){this.check(width,height);const canvas=createCanvas(width,height);return {canvas,context:canvas.getContext('2d')};}
  reset(target,width,height){this.check(width,height);target.canvas.width=width;target.canvas.height=height;}
  destroy(target){target.canvas.width=1;target.canvas.height=1;target.canvas=null;target.context=null;}
}
try{
  const bytes=new Uint8Array(workerData.bytes);
  if(bytes.length>2097152||bytes.length<8||Buffer.from(bytes.subarray(0,5)).toString()!=='%PDF-')throw Error();
  const root=new URL('../../',import.meta.resolve('pdfjs-dist/legacy/build/pdf.mjs'));
  task=getDocument({data:bytes,isEvalSupported:false,enableXfa:false,useSystemFonts:false,disableFontFace:true,
    disableAutoFetch:true,disableStream:true,disableRange:true,useWorkerFetch:false,stopAtErrors:true,verbosity:1,
    maxImageSize:16_000_000,CanvasFactory:BoundedCanvas,standardFontDataUrl:fileURLToPath(new URL('standard_fonts/',root)),
    cMapUrl:fileURLToPath(new URL('cmaps/',root)),cMapPacked:true,wasmUrl:fileURLToPath(new URL('wasm/',root))});
  task.onPassword=()=>{void task.destroy();};
  const doc=await task.promise;
  if(doc.numPages<1||doc.numPages>20||doc.numPages!==workerData.pageCount||doc.isPureXfa
    ||await doc.getAttachments()||await doc.getJSActions()||await doc.getFieldObjects()||await doc.getOutline()
    ||await doc.getPermissions()!==null)throw Error();
  // A passive initial page destination is harmless. All actual actions fail.
  const open=await doc.getOpenAction();if(open && (open.action||open.url))throw Error();
  const pages=[],renderHash=createHash('sha256');let total=0;
  for(let n=1;n<=doc.numPages;n++){
    const page=await doc.getPage(n);
    if((await page.getAnnotations()).length||await page.getJSActions())throw Error();
    const base=page.getViewport({scale:1});
    if(!Number.isFinite(base.width)||!Number.isFinite(base.height)||base.width<100||base.height<100
      ||base.width>2000||base.height>2000||base.width/base.height<0.4||base.width/base.height>2.5)throw Error();
    const viewport=page.getViewport({scale:Math.min(1200/base.width,1600/base.height)});
    const width=Math.ceil(viewport.width),height=Math.ceil(viewport.height),canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
    await page.render({canvasContext:ctx,viewport,background:'rgb(255,255,255)'}).promise;
    if(warned)throw Error();
    const pixels=ctx.getImageData(0,0,width,height).data;
    let ink=0;for(let i=0;i<pixels.length;i+=4)if(Math.min(pixels[i],pixels[i+1],pixels[i+2])<200)ink++;
    if(ink<100||ink>width*height*0.85)throw Error();
    const png=canvas.toBuffer('image/png');total+=png.length;
    if(png.length>2097152||total>32*1024*1024)throw Error();
    renderHash.update(`${n}:${width}:${height}:`).update(pixels);
    pages.push({bytes:png,sha256:hash(png),width,height});page.cleanup();canvas.width=1;canvas.height=1;
  }
  parentPort.postMessage({ok:true,pages,renderSha256:renderHash.digest('hex')});
}catch{parentPort.postMessage({ok:false});}
finally{await task?.destroy();}
