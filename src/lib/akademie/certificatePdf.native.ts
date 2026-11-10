import {createAcademyCertificatePdf} from './certificatePdf.ts';
import type {AcademyCertificate} from './workspaceModel';
import {shareNativeFile} from '@/lib/platform/nativeFileDelivery.native';
export {createAcademyCertificatePdf};
export async function downloadAcademyCertificate(certificate:AcademyCertificate):Promise<void>{const pdf=await createAcademyCertificatePdf(certificate);await shareNativeFile(new Uint8Array(pdf.output('arraybuffer')),(certificate.qualification?'Zertifikat-':'Teilnahmenachweis-')+(certificate.number||certificate.id)+'.pdf','application/pdf');}
