import {jsPDF} from 'jspdf';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import {inspectMonthlyScan} from '../../services/gkv/monthly-scan.mjs';
import {signingPng} from './monthly-host-fixture.mjs';
/** Synthetic scan of the actual generated original; the added ink is a test
 * image, never a signature/identity or a physical printer/scanner attestation. */
export async function paperScanFixture(original,variant=100){
  const meta=original.original.paper,box=meta.signatureBox;
  const rendered=await inspectMonthlyScan(Buffer.from(original.pdfBase64,'base64'),meta.pageCount);
  const pdf=new jsPDF({unit:'mm',format:'a4',compress:true}),signature=await loadImage(Buffer.from(signingPng(variant),'base64'));
  for(let i=0;i<rendered.pages.length;i++){
    if(i)pdf.addPage();
    const page=rendered.pages[i],canvas=createCanvas(page.width,page.height),ctx=canvas.getContext('2d');
    ctx.drawImage(await loadImage(page.bytes),0,0);
    if(i+1===box.page){const x=box.x/1000*page.width,y=box.y/1000*page.height,w=box.width/1000*page.width,h=box.height/1000*page.height;
      ctx.drawImage(signature,x+w*0.1,y+h*0.1,w*0.7,h*0.8);}
    pdf.addImage(canvas.toBuffer('image/png'),'PNG',0,0,210,297);canvas.width=1;canvas.height=1;
  }
  return Buffer.from(pdf.output('arraybuffer'));
}
