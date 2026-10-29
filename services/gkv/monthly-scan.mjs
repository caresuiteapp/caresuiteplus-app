import {Worker} from 'node:worker_threads';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {readPaperBox} from '../../src/lib/gkvExchange/monthlyPaper.ts';
import {pngCrc} from './monthly-signature-png.mjs';

function rgbaPng(width,height,pixels){
  const chunk=(kind,data)=>{const type=Buffer.from(kind),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(pngCrc(Buffer.concat([type,data])));return Buffer.concat([size,type,data,crc]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  const stride=width*4,raw=Buffer.alloc(height*(stride+1)),bytes=Buffer.from(pixels);
  for(let y=0;y<height;y++)bytes.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

export async function inspectMonthlyScan(input,pageCount){
  if(!(input instanceof Uint8Array)||input.length>2097152||!input.length||!Number.isInteger(pageCount)||pageCount<1||pageCount>20)throw Error('MONTHLY_PAPER_INPUT');
  const bytes=Buffer.from(input);
  const result=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./monthly-scan-worker.mjs',import.meta.url),{workerData:{bytes,pageCount},
      execArgv:[],resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32,stackSizeMb:4}});
    let settled=false;
    const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);void worker.terminate();error?reject(error):resolve(value);};
    const timer=setTimeout(()=>finish(Error('MONTHLY_PAPER_INPUT')),20000);
    worker.once('message',v=>finish(v?.ok?null:Error('MONTHLY_PAPER_INPUT'),v));
    worker.once('error',()=>finish(Error('MONTHLY_PAPER_INPUT')));
    worker.once('exit',()=>finish(Error('MONTHLY_PAPER_INPUT')));
  });
  return {bytes,sha256:createHash('sha256').update(bytes).digest('hex'),renderSha256:result.renderSha256,
    pages:result.pages.map(p=>({...p,bytes:Buffer.from(p.bytes)}))};
}
/** Crop only our already-rendered, archived PNG, never a browser-supplied image. */
export async function cropMonthlyScan(page,input,pageCount){
  const box=readPaperBox(input,pageCount),image=await loadImage(page.bytes);
  if(image.width!==page.width||image.height!==page.height)throw Error('MONTHLY_STORE_INTEGRITY');
  const x=Math.round(box.x*page.width/1000),y=Math.round(box.y*page.height/1000);
  const width=Math.floor(box.width*page.width/1000),height=Math.floor(box.height*page.height/1000);
  const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,x,y,width,height,0,0,width,height);
  // The native encoder embeds ICC metadata. Encode our decoded sRGB pixels in
  // the same minimal RGBA8 format accepted by the existing signature verifier.
  const bytes=rgbaPng(width,height,ctx.getImageData(0,0,width,height).data);canvas.width=1;canvas.height=1;return bytes;
}
