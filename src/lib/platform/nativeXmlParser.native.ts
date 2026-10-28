import {DOMParser} from '@xmldom/xmldom';
/** The existing bounded XML preflight runs first; this parser loads no resources. */
export function parseNativeInvoiceXml(xml:string):Document{let invalid=false;const parsed=new DOMParser({errorHandler:{warning(){invalid=true;},error(){invalid=true;},fatalError(){invalid=true;}}}).parseFromString(xml,'application/xml');if(invalid||!parsed.documentElement)throw Error('Die XML-Datei ist nicht korrekt aufgebaut.');return parsed;}
