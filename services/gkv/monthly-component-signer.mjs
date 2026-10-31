import {MonthlyOriginalStore} from './monthly-original-store.mjs';
import {isUuid} from './storage.mjs';
import {KonnektorCertificateClient} from '../kim/connector-certificates.mjs';
import {TslOcspStatusClient} from '../kim/tsl-ocsp.mjs';
import {prepareSmcbPin,assertPreparedSmcbPin} from '../kim/connector-pin.mjs';
import {cardFingerprint,cardSelector} from '../kim/connector-cards.mjs';
import {validTelematikId} from '../kim/certificate-admission.mjs';
import {canonicalOid} from '../kim/der-oid.mjs';

/** Private, tenant-bound host composition. No software signing key, KIM address,
 * browser certificate or retry flag. All key operations use the configured
 * connector. Local test peers cannot attest physical hardware or TI access. */
export class MonthlyComponentSigner {
  #tenant;#store;#connector;#status;#settings;#busy=false;
  constructor({tenantId,store,connector,statusClient,expectedTelematikId,requiredRoles,iccsn,ctId,slotId}) {
    if(!isUuid(tenantId)||!(store instanceof MonthlyOriginalStore)||!(connector instanceof KonnektorCertificateClient)
      ||!(statusClient instanceof TslOcspStatusClient)||connector.environment!==statusClient.environment
      ||!validTelematikId(expectedTelematikId)||!Array.isArray(requiredRoles)||!requiredRoles.length||requiredRoles.length>32
      ||new Set(requiredRoles).size!==requiredRoles.length||requiredRoles.some(r=>!canonicalOid(r)||r.length>100))throw Error('MONTHLY_COMPONENT_CONFIGURATION');
    cardSelector({iccsn,ctId,slotId});
    this.#tenant=tenantId;this.#store=store;this.#connector=connector;this.#status=statusClient;
    this.#settings={expectedTelematikId,requiredRoles:[...requiredRoles],iccsn,ctId,slotId,mandantWide:false,allowPrompt:false};
  }
  assertScope(tenant,store) {
    if(tenant!==this.#tenant||store!==this.#store)throw Error('MONTHLY_COMPONENT_CONFIGURATION');
  }
  async signCaptured({tenantId,captureId,candidate,assertCurrent}) {
    this.assertScope(tenantId,this.#store);
    if(!isUuid(captureId)||typeof assertCurrent!=='function')throw Error('MONTHLY_COMPONENT_CONFIGURATION');
    if(this.#busy)throw Error('MONTHLY_COMPONENT_BUSY');
    this.#busy=true;
    let archive,attempt;
    const stop=AbortSignal.timeout(120000),connector=this.#connector,statusClient=this.#status;
    let fingerprint,certificateHashes;
    const prepare=async()=>{
      const p=await prepareSmcbPin({...this.#settings,connector,statusClient,signal:stop});
      if(p.state!=='pin-verified')throw Error('MONTHLY_COMPONENT_PIN_REQUIRED');
      assertPreparedSmcbPin(p,connector,statusClient);
      const current=cardFingerprint(p.bundle.selection.card),hashes=p.bundle.certificates.map(c=>c.certificateSha256).join(':');
      if(fingerprint&&(current!==fingerprint||hashes!==certificateHashes))throw Error('MONTHLY_COMPONENT_CARD_CHANGED');
      fingerprint=current;certificateHashes=hashes;return p;
    };
    const sig=p=>p.bundle.certificates.find(c=>c.certRef==='C.SIG');
    try {
      // Candidate and its exact patient receipt precede the durable reservation.
      archive=candidate?this.#store.reserveComponent(tenantId,captureId,candidate):this.#store.getComponent(tenantId,captureId);
      if(!archive)throw Error('MONTHLY_COMPONENT_BINDING');
      await assertCurrent();
      if(archive.record.state==='complete')return archive;
      if(!['prepared','signed'].includes(archive.record.state))throw Error('MONTHLY_COMPONENT_HELD');
      let p=await prepare();await assertCurrent();assertPreparedSmcbPin(p,connector,statusClient);
      if(archive.record.state==='prepared') {
        archive=this.#store.beginComponent(tenantId,captureId);attempt=archive.record.attemptId;
        const c=sig(p);
        const signed=await KonnektorCertificateClient.prototype.signSmcbComponent.call(connector,
          {status:p.status,certificate:c.certificate,verification:c.verification,data:archive.xml,signal:stop});
        // Persist CMS before any subsequent asynchronous check. A crash here
        // leaves a signed row that can resume read-only verification, never sign again.
        archive=this.#store.saveComponentSignature(tenantId,captureId,attempt,signed,c.certificate);
        p=await prepare();
      } else attempt=archive.record.attemptId;
      const c=sig(p);
      if(c.certificateSha256!==archive.record.signing.certificateSha256)throw Error('MONTHLY_COMPONENT_CARD_CHANGED');
      await assertCurrent();assertPreparedSmcbPin(p,connector,statusClient);
      const verified=await KonnektorCertificateClient.prototype.verifySmcbComponent.call(connector,
        {data:archive.cms,certificate:c.certificate,verification:c.verification,signal:stop});
      p=await prepare();await assertCurrent();assertPreparedSmcbPin(p,connector,statusClient);
      return this.#store.completeComponent(tenantId,captureId,attempt,verified);
    } catch(error) {
      // No raw remote exception is persisted. Interrupted or uncertain attempts
      // remain blocked across clients/process restarts and all new captures.
      if(attempt){const current=this.#store.getComponent(tenantId,captureId);
        if(['in-flight','signed'].includes(current?.record.state))this.#store.holdComponent(tenantId,captureId,attempt);}
      if(attempt)throw Error('MONTHLY_COMPONENT_HELD',{cause:error});
      throw error;
    } finally {this.#busy=false;}
  }
}
