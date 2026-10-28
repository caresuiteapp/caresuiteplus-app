// Generated native presentation from src/screens/inventory/InventoryConsumablesBoundaryPanel.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { StyleSheet, View } from 'react-native';
import { getInventoryConsumablesBoundaryWeb } from "../../lib/inventory/inventoryConsumablesBoundary.native.ts";
import { getInventoryBatchTraceabilityBoundaryWeb } from "../../lib/inventory/inventoryBatchTraceabilityBoundary.native.ts";
import { getInventoryMedicalDeviceMaintenanceBoundaryWeb } from "../../lib/inventory/inventoryMedicalDeviceMaintenanceBoundary.native.ts";
import { getInventoryCleaningDisposalBoundaryWeb } from "../../lib/inventory/inventoryCleaningDisposalBoundary.native.ts";
import { getInventoryKeyAccessBoundaryWeb } from "../../lib/inventory/inventoryKeyAccessBoundary.native.ts";
import { getInventoryProcurementReceiptBoundaryWeb } from "../../lib/inventory/inventoryProcurementReceiptBoundary.native.ts";
import { getInventoryCountBoundaryWeb } from "../../lib/inventory/inventoryCountBoundary.native.ts";
import { useCareLightPalette } from '@/design/tokens/carelightadaptive';
import { careSpacing } from '@/design/tokens/spacing';
export function InventoryConsumablesBoundaryPanel() {
    const { c } = useCareLightPalette();
    const boundary = getInventoryConsumablesBoundaryWeb();
    const batchBoundary = getInventoryBatchTraceabilityBoundaryWeb();
    const maintenanceBoundary = getInventoryMedicalDeviceMaintenanceBoundaryWeb();
    const cleaningBoundary = getInventoryCleaningDisposalBoundaryWeb();
    const keyAccessBoundary = getInventoryKeyAccessBoundaryWeb();
    const procurementBoundary = getInventoryProcurementReceiptBoundaryWeb();
    const countBoundary = getInventoryCountBoundaryWeb();
    return <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
    <Text style={[styles.title, { color: c.text }]}>Verbrauchsmaterial · Vertragsgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Der aktuelle Bestand verwaltet einzeln identifizierte Arbeitsmittel und deren Ausgabe/Rücknahme. Er liefert keine native Mengeneinheit, keinen Mengen- oder Mindestbestand, keine Lieferantenrelation und kein Lagerbuch für Verbrauchsmaterial.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Einsatzbezogene Verbrauchsereignisse und ein Schutz gegen doppelte Abbuchung sind im aktuellen Vertrag nicht nachweisbar. Wundmaterial-Freitext oder eine Inventarausgabe werden deshalb nicht als Bestandsbewegung übernommen.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {boundary.capability} · Verbrauch {boundary.consumptionEvent} · Einsatzbezug {boundary.visitRelation} · Doppelabbuchung {boundary.duplicateConsumptionGuard}</Text>
    <View style={[styles.divider, { backgroundColor: c.border }]}/>
    <Text style={[styles.title, { color: c.text }]}>Chargen und Haltbarkeit · Vertragsgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Kaufdatum, Garantiefrist und Lagerort beschreiben im aktuellen Vertrag ein dauerhaftes Arbeitsmittel. Sie sind keine Charge, kein Verfallsdatum und keine chargenbezogene Bestandsposition.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Rückruf, Sperrung, Entsorgung und betroffene Versorgungen sind nicht strukturiert verknüpft. Wundmaterial-Freitext oder allgemeine Auditangaben werden deshalb nicht als dokumentierte Anwendung einer Charge gewertet.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {batchBoundary.capability} · Charge {batchBoundary.batchIdentity} · Verfall {batchBoundary.expiryDate} · Rückrufsuche {batchBoundary.recallImpactSearch}</Text>
    <View style={[styles.divider, { backgroundColor: c.border }]}/>
    <Text style={[styles.title, { color: c.text }]}>Medizinprodukte und Wartung · Vertragsgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Gerätekategorie, Seriennummer, Hersteller, Modell, Kaufdatum und Garantie beschreiben nur ein Inventarobjekt. Sie klassifizieren kein Medizinprodukt und belegen weder Wartung, Prüfung, Kalibrierung noch Einweisung.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Der Status „In Wartung“, MDM-Angaben und allgemeine Auditwerte enthalten keine native Wartungshistorie, Fälligkeit oder Freigabe. Eine geplante Nutzung eines nicht freigegebenen Geräts kann deshalb im aktuellen Vertrag nicht verlässlich beanstandet werden.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {maintenanceBoundary.capability} · Wartung {maintenanceBoundary.maintenanceEvent} · Einweisung {maintenanceBoundary.instructionRecord} · Nutzungsbeanstandung {maintenanceBoundary.unapprovedUseObjection}</Text>
    <View style={[styles.divider, { backgroundColor: c.border }]}/>
    <Text style={[styles.title, { color: c.text }]}>Reinigung und Entsorgung · Vertragsgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Rückgabe, Zustand, Vollständigkeit, Geräte-Reset und Datenlöschung beschreiben eine Inventarrücknahme. Sie dokumentieren keine Reinigung, Desinfektion, hygienische Freigabe oder Entsorgung.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Tätigkeit, verantwortliche Identität, Verfahren, Mittel, tatsächliche Durchführungszeit, Abweichung und Nachweis sind nicht strukturiert verknüpft. Notizen und allgemeine Auditwerte bestätigen deshalb keine hygienische Durchführung.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {cleaningBoundary.capability} · Durchführung {cleaningBoundary.actualExecutionProof} · Verantwortliche {cleaningBoundary.responsibleIdentity} · Entsorgung {cleaningBoundary.disposalEvent}</Text>
    <View style={[styles.divider, { backgroundColor: c.border }]}/>
    <Text style={[styles.title, { color: c.text }]}>Schlüssel und Zugang · Nachweisgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Ausgabe, Status, Verlustmeldung, Rücknahme und ein technischer Zugangsreferenzwert bleiben Inventarangaben. Sie bilden keine vollständige Übergabe-, Verwahrungs- und Rückgabehistorie und enthalten keine Zugangscodes, Passwörter oder sonstigen Geheimnisse.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Eine Verlustmeldung belegt noch keine zuständige Bearbeitung. Auch ein gesetzter Erledigungszeitpunkt nennt weder verantwortliche Person noch konkrete Sperr-, Austausch- oder Rückholmaßnahme und bestätigt keine Zugangssperre.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {keyAccessBoundary.capability} · Verlustbearbeitung {keyAccessBoundary.responsibleHandlingProof} · Zugangssperre {keyAccessBoundary.accessRevocationProof} · Geheimnisse {keyAccessBoundary.secretMaterialExposure}</Text>
    <View style={[styles.divider, { backgroundColor: c.border }]}/>
    <Text style={[styles.title, { color: c.text }]}>Bestellungen und Lieferungen · Nachweisgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Das aktuelle Inventar enthält keine nativen Bedarfs-, Bestell-, Bestellpositions-, Liefer-, Wareneingangs-, Differenz- oder Lieferantenrechnungsdaten. Kaufdatum, Hersteller, Notiz und der Status eines einzeln identifizierten Arbeitsmittels ersetzen diese Belege nicht.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Ein bestellter oder angekündigter Artikel wird nicht als verfügbar gewertet. Dafür wären ein getrenntes tatsächliches Wareneingangsereignis, die eingegangene Menge und eine nachvollziehbare Bestandsbuchung erforderlich; diese Nachweise stellt der aktuelle Vertrag nicht bereit.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {procurementBoundary.capability} · Bestellung {procurementBoundary.purchaseOrder} · Wareneingang {procurementBoundary.goodsReceiptEvent} · Verfügbarkeit aus Bestellstatus {procurementBoundary.availabilityFromOrderStatus}</Text>
    <View style={[styles.divider, { backgroundColor: c.border }]}/>
    <Text style={[styles.title, { color: c.text }]}>Lagerorte und Inventur · Nachweisgrenze</Text>
    <Text style={[styles.body, { color: c.muted }]}>Lagerort, Gebäude und Raum ordnen ein einzeln identifiziertes Arbeitsmittel räumlich zu. Die Anzahl der angezeigten Inventarobjekte ist weder Sollbestand noch gezählter Bestand und belegt keine tatsächliche Inventur.</Text>
    <Text style={[styles.warning, { color: c.text }]}>Zählereignis, Zählposition, Soll-/Ist-Menge, Abweichung, Freigabe und Korrekturbuchung fehlen im aktuellen Vertrag. Eine Inventurdifferenz darf deshalb weder aus Status oder Objektzahl berechnet noch durch stilles Ändern eines Bestandswerts erledigt werden.</Text>
    <Text selectable style={[styles.meta, { color: c.muted }]}>Status: {countBoundary.capability} · Zählung {countBoundary.countEvent} · Differenz {countBoundary.varianceRecord} · stille Überschreibung {countBoundary.silentQuantityOverwrite}</Text>
  </View>;
}
const styles = StyleSheet.create({
    panel: { marginTop: careSpacing.md, padding: careSpacing.lg, borderWidth: 1, borderRadius: 18, gap: careSpacing.xs },
    title: { fontSize: 17, fontWeight: '800' },
    body: { fontSize: 14, lineHeight: 21 },
    warning: { fontSize: 14, lineHeight: 21, fontWeight: '700' },
    meta: { fontSize: 12, lineHeight: 18 },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: careSpacing.sm },
});
