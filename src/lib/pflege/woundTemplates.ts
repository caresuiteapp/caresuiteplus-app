export type WoundTemplateKind = 'description' | 'treatment';
type Snippet = readonly [key: string, name: string, text: string];

function group(kind: WoundTemplateKind, label: string, snippets: readonly Snippet[]) {
  return { kind, label, snippets };
}

export const WOUND_TEMPLATE_FIELDS = {
  location: group('description', 'Wundlokalisation', [
    ['sacrum', 'Kreuzbein', 'Sakralregion über dem Kreuzbein'],
    ['heel', 'Ferse', 'Rückseite der Ferse über dem Fersenbein'],
    ['ankle', 'Innenknöchel', 'Unterschenkel distal, über dem Innenknöchel'],
    ['outer_ankle', 'Außenknöchel', 'Unterschenkel distal, über dem Außenknöchel'],
    ['sole', 'Fußsohle am Vorfuß', 'Plantar am Vorfuß'],
    ['toes', 'Zehenzwischenraum', 'Interdigital am Fuß'],
    ['elbow', 'Ellenbogen', 'Streckseite über dem Ellenbogen'],
    ['forearm', 'Unterarm', 'Unterarm auf der Streckseite'],
    ['hip', 'Seitliche Hüfte', 'Seitliche Hüfte über dem großen Rollhügel'],
    ['abdomen', 'Bauch', 'Vordere Bauchwand'],
  ]),
  wound_type: group('description', 'Wundart und Einordnung', [
    ['unknown', 'Einordnung noch offen', 'Wundart zum Zeitpunkt der Erfassung ungeklärt.'],
    ['pressure', 'Druckbedingte Wunde', 'Druckbedingte Wunde. Fachliche Kategorie noch zu klären.'],
    ['skin_tear', 'Hautriss', 'Hautriss (Skin Tear). Ausmaß im Befund beschrieben.'],
    ['abrasion', 'Schürfwunde', 'Oberflächliche Schürfwunde.'],
    ['surgical', 'Postoperative Wunde', 'Postoperative Wunde im Bereich des Operationszugangs.'],
    ['leg_ulcer', 'Unterschenkelulkus', 'Unterschenkelulkus. Ätiologische Einordnung noch offen.'],
    ['foot_ulcer', 'Fußulkus bei Diabetes', 'Fußulkus bei vorbekanntem Diabetes mellitus.'],
    ['trauma', 'Traumatische Wunde', 'Traumatisch entstandene Wunde.'],
  ]),
  cause: group('description', 'Ursache und Klärungsstand', [
    ['unknown', 'Ursache ungeklärt', 'Die Ursache ist anhand der vorliegenden Angaben noch nicht sicher zu bestimmen.'],
    ['pressure', 'Mögliche Druckbelastung', 'In der Vorgeschichte ist eine Druckbelastung an der betroffenen Stelle beschrieben. Der ursächliche Zusammenhang ist offen.'],
    ['shoe', 'Reibung durch Schuhwerk berichtet', 'Die betroffene Person berichtet über Reibung durch Schuhwerk an der betroffenen Stelle.'],
    ['trauma', 'Verletzungsereignis berichtet', 'Die betroffene Person berichtet ein vorausgegangenes Verletzungsereignis an dieser Stelle.'],
    ['postop', 'Operationsgebiet', 'Die Veränderung liegt im Bereich eines dokumentierten Operationszugangs.'],
    ['course', 'Wiederauftreten berichtet', 'Nach Angaben der betroffenen Person bestand an derselben Stelle bereits früher eine Wunde.'],
  ]),
  origin: group('description', 'Ort und Umstände der Entstehung', [
    ['unknown', 'Entstehungsumstände offen', 'Ort und Umstände der Entstehung sind zum Dokumentationszeitpunkt unbekannt.'],
    ['admission', 'Bei Aufnahme bereits vorhanden', 'Die Wunde war bei der ersten eigenen Erhebung bereits vorhanden.'],
    ['home', 'Im häuslichen Umfeld bemerkt', 'Die betroffene Person bemerkte die Veränderung nach eigener Angabe im häuslichen Umfeld.'],
    ['transfer', 'Bei Übernahme mitgeteilt', 'Die Wunde wurde bei der Übernahme der Versorgung mitgeteilt. Eigene Beobachtungen beginnen mit dem Erstbefund.'],
    ['dressing', 'Beim Verbandwechsel gesehen', 'Die Wunde wurde beim Öffnen des vorhandenen Verbands erstmals selbst gesehen.'],
  ]),
  onset_unknown: group('description', 'Unbekanntes Entstehungsdatum', [
    ['first_seen', 'Erstbeobachtung bekannt', 'Der tatsächliche Beginn ist unbekannt. Der Zeitpunkt des ersten eigenen Befunds ist gesondert erfasst.'],
    ['approximate', 'Nur ungefähr bekannt', 'Die betroffene Person kann den Beginn ungefähr eingrenzen. Ein genaues Kalenderdatum ist nicht nachvollziehbar.'],
    ['records', 'Vordokumentation ohne Datum', 'Die vorliegenden Unterlagen nennen kein Entstehungsdatum.'],
    ['conflicting', 'Unterschiedliche Angaben', 'Zum Beginn liegen voneinander abweichende Angaben vor. Ein genaues Datum ist derzeit offen.'],
  ]),
  description: group('description', 'Wundbeschreibung', [
    ['bed', 'Wundbett und Wundrand', 'Das Wundbett ist teilweise einsehbar. Die nicht einsehbaren Anteile lassen sich bei diesem Befund nicht beurteilen.'],
    ['environment', 'Wundumgebung', 'Die Haut der Wundumgebung wurde in dem zugänglichen Bereich auf Feuchtigkeit, Verfärbung und weitere Auffälligkeiten betrachtet.'],
    ['superficial', 'Oberflächlicher Hautdefekt', 'Oberflächlicher Hautdefekt mit sichtbarem Wundgrund.'],
    ['multiple', 'Mehrere getrennte Areale', 'Im betroffenen Körperbereich liegen mehrere räumlich getrennte Hautdefekte vor.'],
    ['draining', 'Sekret am Verband', 'Am abgenommenen Verband ist eine Durchfeuchtung im Bereich der Wundauflage sichtbar.'],
    ['covered', 'Befund bei liegendem Verband', 'Befund bei liegendem Verband. Beurteilt wurde nur die zugängliche Haut außerhalb der Auflage.'],
    ['compared', 'Vergleich zum Vorbefund', 'Im Vergleich zum letzten dokumentierten Befund erscheint die sichtbare Wundfläche kleiner.'],
    ['new', 'Erster eigener Befund', 'Erste eigene Beurteilung. Für einen Verlauf stehen noch keine vergleichbaren eigenen Befunde zur Verfügung.'],
  ]),
  medical_basis: group('treatment', 'Anordnung und Klärungsstand', [
    ['pending', 'Anordnung zur Klärung angefragt', 'Der Bezug der vorhandenen Anordnung zu dieser Wunde ist noch offen. Klärung ist angefragt.'],
    ['missing', 'Anordnung noch nicht verfügbar', 'Zum Erfassungszeitpunkt liegt keine einsehbare ärztliche Anordnung für die vorgesehene Maßnahme vor.'],
    ['scope', 'Geltungsbereich offen', 'Bei der Anordnung ist noch zu klären, auf welche Wunde und auf welche Maßnahmen sie sich bezieht.'],
    ['incomplete', 'Festlegung unvollständig', 'Zur vorliegenden Grundlage fehlen Angaben zur konkreten Durchführung.'],
    ['observation', 'Pflegerische Beobachtung', 'Der Eintrag erfasst die pflegerische Beobachtung. Daraus wurde keine ärztliche Maßnahme abgeleitet.'],
  ]),
  planned_care: group('treatment', 'Geplante Wundversorgung', [
    ['review', 'Weiteres Vorgehen', 'Die Versorgung wird nach der dokumentierten Abstimmung geplant. Die nächste Kontrolle ist Bestandteil der Planung.'],
    ['check', 'Befundkontrolle einplanen', 'Bei der vorgesehenen Kontrolle sollen Wundbett, Wundrand, Umgebung und Exsudat erneut dokumentiert werden.'],
    ['cover', 'Auflage nach Plan', 'Geplant ist der Wechsel der in der gültigen Versorgungsgrundlage festgelegten Wundauflage.'],
    ['tolerance', 'Beschwerden und Verträglichkeit', 'Vor und nach der geplanten Versorgung sollen Beschwerden und Verträglichkeit erfragt oder beobachtet werden.'],
    ['pending', 'Einzelheiten abstimmen', 'Reinigung, Auflage und Wechselintervall stehen zur Abstimmung mit den zuständigen Beteiligten an.'],
    ['self', 'Unterstützung bei Selbstversorgung', 'Umfang und Zeitpunkt der Unterstützung bei der Wundversorgung sollen mit der betroffenen Person abgestimmt werden.'],
  ]),
  measurement: group('description', 'Messmethode und Messgrenzen', [
    ['ruler', 'Lineare Messung', 'Länge und Breite wurden in der Ebene der sichtbaren Wundfläche gemessen.'],
    ['planimetric', 'Kontur am Foto', 'Die sichtbare Kontur wurde auf einem Foto mit Maßstabsreferenz in der Wundebene erfasst.'],
    ['same_method', 'Vergleichbare Erhebung', 'Die Messung erfolgte mit derselben Methode wie beim datierten Vergleichsbefund.'],
    ['angle', 'Eingeschränkt vergleichbare Ansicht', 'Durch Aufnahmewinkel und Körperkrümmung ist die Vergleichbarkeit der Fotomessung eingeschränkt.'],
    ['covered', 'Messung nur sichtbarer Anteile', 'Messwerte beziehen sich auf den einsehbaren Bereich der Wunde.'],
  ]),
  measurement_unavailable: group('description', 'Grund für fehlenden Messwert', [
    ['covered', 'Wunde nicht vollständig einsehbar', 'Die relevante Ausdehnung war aufgrund der Abdeckung nicht vollständig einsehbar.'],
    ['scale', 'Maßstab im Bild fehlt', 'Im Foto ist keine ausreichend verlässliche Referenz in derselben Ebene sichtbar.'],
    ['pain', 'Erhebung abgebrochen', 'Die Messung wurde auf Wunsch der betroffenen Person wegen Beschwerden abgebrochen.'],
    ['depth', 'Wundgrund nicht einsehbar', 'Der Wundgrund war nicht vollständig einsehbar. Daher konnte die Tiefe nicht verlässlich angegeben werden.'],
    ['visit', 'Keine Messung vorgesehen', 'Bei diesem Kontakt war keine verlässliche Messung möglich. Es wurde kein Wert geschätzt.'],
  ]),
  wound_bed: group('description', 'Wundbett und Gewebe', [
    ['granulation', 'Granulationsgewebe', 'Im einsehbaren Wundbett ist rötliches Granulationsgewebe sichtbar.'],
    ['fibrin', 'Fibrinbelag', 'Im Wundbett ist abschnittsweise ein gelblicher, haftender Belag sichtbar.'],
    ['necrosis', 'Trockenes schwarzes Areal', 'Ein trockenes, dunkel verfärbtes Areal ist im Wundbett sichtbar.'],
    ['epithelium', 'Epithel am Rand', 'Am Übergang vom Wundbett zum Rand ist ein schmaler rosafarbener Epithelsaum sichtbar.'],
    ['mixed', 'Unterschiedliche Gewebeanteile', 'Im Wundbett zeigen sich rötliche Bereiche und gelbliche Belaganteile.'],
    ['blood', 'Punktuelle Blutung', 'Im sichtbaren Wundbett zeigt sich punktueller Blutaustritt.'],
    ['not_visible', 'Wundbett nicht beurteilbar', 'Das Wundbett ist bei diesem Kontakt nicht ausreichend einsehbar.'],
  ]),
  exudate: group('description', 'Exsudat', [
    ['none', 'Kein sichtbares Exsudat', 'Zum Beobachtungszeitpunkt ist an der sichtbaren Wundfläche kein Exsudat erkennbar.'],
    ['small', 'Geringe Exsudatmenge', 'Die abgenommene Auflage zeigt eine geringe, lokal begrenzte Durchfeuchtung.'],
    ['medium', 'Mäßige Exsudatmenge', 'Die Wundauflage zeigt eine flächige Durchfeuchtung. Die äußere Fixierung ist trocken.'],
    ['large', 'Stark durchfeuchteter Verband', 'Die Auflage ist stark durchfeuchtet. Feuchtigkeit reicht bis in äußere Verbandsschichten.'],
    ['serous', 'Klares, seröses Exsudat', 'Das sichtbare Exsudat ist klar und dünnflüssig.'],
    ['bloody', 'Blutig tingiertes Exsudat', 'Das sichtbare Exsudat ist rötlich tingiert.'],
    ['turbid', 'Trübes, zähes Exsudat', 'Das sichtbare Exsudat ist trüb und zähflüssig.'],
    ['unknown', 'Exsudat nicht beurteilbar', 'Die Exsudatmenge ließ sich bei diesem Kontakt nicht sicher einschätzen.'],
  ]),
  odor: group('description', 'Wundgeruch', [
    ['none', 'Kein auffälliger Geruch', 'Beim Öffnen des Verbands war kein auffälliger Geruch wahrnehmbar.'],
    ['opening', 'Geruch beim Öffnen', 'Beim Öffnen des Verbands war ein auffälliger Geruch wahrnehmbar.'],
    ['after', 'Geruch nach Reinigung', 'Nach der dokumentierten Reinigung blieb ein auffälliger Geruch wahrnehmbar.'],
    ['resolved', 'Nach Reinigung abgeklungen', 'Der beim Öffnen wahrgenommene Geruch war nach der dokumentierten Reinigung nicht mehr wahrnehmbar.'],
    ['unavailable', 'Geruch nicht beurteilt', 'Eine Geruchsbeurteilung erfolgte bei diesem Kontakt nicht.'],
  ]),
  wound_edge: group('description', 'Wundrand', [
    ['flat', 'Flacher, abgrenzbarer Rand', 'Der sichtbare Wundrand ist flach und gut von der Umgebung abgrenzbar.'],
    ['uneven', 'Unregelmäßiger Rand', 'Der Wundrand ist abschnittsweise unregelmäßig konturiert.'],
    ['maceration', 'Mazerierter Rand', 'Der sichtbare Wundrand ist abschnittsweise weißlich aufgeweicht.'],
    ['callus', 'Verhornter Rand', 'Am sichtbaren Wundrand zeigen sich verhornte Anteile.'],
    ['detached', 'Rand teilweise abgehoben', 'Ein Teil des Wundrands ist vom sichtbaren Wundbett abgehoben.'],
    ['epithelium', 'Fortschreitender Epithelsaum', 'Am sichtbaren Rand ist ein schmaler, zum Wundbett hin reichender Epithelsaum erkennbar.'],
    ['unknown', 'Rand nur teilweise einsehbar', 'Der Wundrand kann nur in den frei einsehbaren Abschnitten beurteilt werden.'],
  ]),
  skin: group('description', 'Wundumgebung und Haut', [
    ['intact', 'Einsehbare Haut intakt', 'Die einsehbare Haut um die Wunde ist geschlossen.'],
    ['redness', 'Begrenzte Rötung', 'In der Wundumgebung zeigt sich eine örtlich begrenzte Rötung.'],
    ['moisture', 'Aufgeweichte Haut', 'Die wundnahe Haut wirkt weißlich und aufgeweicht.'],
    ['dry', 'Trockene, schuppende Haut', 'Die Haut in der Wundumgebung ist trocken und schuppt.'],
    ['swelling', 'Sichtbare Schwellung', 'In der Wundumgebung ist eine Schwellung sichtbar.'],
    ['adhesive', 'Veränderung am Kleberand', 'Die sichtbare Hautveränderung liegt im Bereich des Kleberands der Auflage.'],
    ['unknown', 'Teils verdeckte Haut', 'Die Wundumgebung war nur in den nicht abgedeckten Bereichen beurteilbar.'],
  ]),
  infection_observation: group('description', 'Beobachtungen zur Infektionsfrage', [
    ['warm', 'Rötung und Wärme', 'Die Wundumgebung wirkt gerötet und im Seitenvergleich wärmer.'],
    ['increasing', 'Rötung weiter ausgedehnt', 'Die sichtbare Rötung reicht über den Bereich hinaus, der im Vergleichsbefund beschrieben ist.'],
    ['secretion', 'Verändertes Sekret', 'Das Sekret wirkt im Vergleich zum letzten Befund trüber.'],
    ['pain', 'Zunehmender Schmerz berichtet', 'Die betroffene Person berichtet über zunehmenden Schmerz im Bereich der Wunde.'],
    ['none_seen', 'Keine lokal sichtbare Rötung', 'In den einsehbaren Bereichen zeigt sich zum Beobachtungszeitpunkt keine Rötung.'],
    ['unclear', 'Eingeschränkte Beurteilung', 'Auf Grundlage der heutigen Befunderhebung ist die Infektionsfrage offen.'],
  ]),
  pain_unavailable: group('description', 'Grund für fehlende Schmerzerhebung', [
    ['declined', 'Skalenangabe abgelehnt', 'Die betroffene Person wollte den Schmerz nicht auf der angebotenen Skala angeben.'],
    ['communication', 'Skala nicht anwendbar', 'Eine zuverlässige Selbsteinschätzung auf der angebotenen Skala war in dieser Situation nicht möglich.'],
    ['interrupted', 'Erhebung unterbrochen', 'Die Schmerzerhebung wurde vor einer eindeutigen Skalenangabe unterbrochen.'],
    ['remote', 'Kein direkter Kontakt', 'Zum erfassten Zeitpunkt bestand kein direkter Kontakt zur betroffenen Person.'],
  ]),
  impact: group('description', 'Alltag und Wohlbefinden', [
    ['walking', 'Gehen eingeschränkt', 'Die betroffene Person berichtet, dass wundbedingte Beschwerden das Gehen erschweren.'],
    ['sleep', 'Schlaf unterbrochen', 'Die betroffene Person beschreibt nächtliche Unterbrechungen im Zusammenhang mit der Wunde.'],
    ['dressing', 'Ankleiden erschwert', 'Das Ankleiden ist nach Angaben der betroffenen Person durch die Lage der Wunde beziehungsweise des Verbands erschwert.'],
    ['social', 'Aktivitäten eingeschränkt', 'Die betroffene Person berichtet, dass sie Aktivitäten wegen der Wundsituation seltener wahrnimmt.'],
    ['no_report', 'Keine Beeinträchtigung berichtet', 'Im heutigen Gespräch wurden keine wundbedingten Einschränkungen des Alltags benannt.'],
  ]),
  person_decision: group('description', 'Wünsche und Entscheidung der Person', [
    ['questions', 'Rückfragen vor Entscheidung', 'Die betroffene Person möchte vor ihrer Entscheidung offene Fragen zur Versorgung klären.'],
    ['pause', 'Pause gewünscht', 'Die betroffene Person wünschte eine Unterbrechung und eine erneute Abstimmung zum weiteren Vorgehen.'],
    ['support', 'Unterstützung gewünscht', 'Die betroffene Person wünscht Unterstützung bei der Durchführung und Kontrolle der Versorgung.'],
    ['declined', 'Angebot abgelehnt', 'Die betroffene Person lehnte die besprochene Maßnahme bei diesem Kontakt ab.'],
    ['selected', 'Beteiligung gewünscht', 'Die betroffene Person möchte bei der Planung und Durchführung soweit möglich mitwirken.'],
    ['open', 'Erhebung derzeit nicht möglich', 'Eine eigene Entscheidung der betroffenen Person konnte bei diesem Kontakt nicht erhoben werden.'],
  ]),
  self_management: group('description', 'Eigenständigkeit und Unterstützung', [
    ['observation', 'Beobachtung selbstständig', 'Die betroffene Person kann die sichtbare Wundumgebung im zugänglichen Bereich selbst beobachten.'],
    ['access', 'Körperstelle schwer erreichbar', 'Die Lage der Wunde erschwert eine eigenständige Kontrolle und Versorgung.'],
    ['hands', 'Unterstützung bei Materialien', 'Beim Öffnen und Vorbereiten der Materialien wird Unterstützung benötigt.'],
    ['understanding', 'Erläuterung erwünscht', 'Die betroffene Person möchte den Ablauf vor der eigenständigen Durchführung noch einmal gemeinsam besprechen.'],
    ['network', 'Unterstützung im Umfeld', 'Die betroffene Person benennt Unterstützung aus ihrem Umfeld. Die konkret übernommene Aufgabe wird gesondert abgestimmt.'],
  ]),
  actual_action: group('treatment', 'Tatsächliche Reaktion und Wundbehandlung', [
    ['observation', 'Beobachtet und dokumentiert', 'Die zugänglichen Wundbereiche wurden beobachtet. Ein Versorgungsschritt erfolgte bei diesem Kontakt nicht.'],
    ['dressing', 'Verbandwechsel erfolgt', 'Der vorgesehene Verbandwechsel wurde durchgeführt. Die tatsächlich eingesetzten Materialien sind im Verbrauch erfasst.'],
    ['interrupted', 'Versorgung unterbrochen', 'Die begonnene Versorgung wurde auf Wunsch der betroffenen Person unterbrochen.'],
    ['contact', 'Rücksprache eingeleitet', 'Wegen des veränderten Befunds wurde die zuständige Stelle zur Rücksprache kontaktiert.'],
    ['existing', 'Auflage belassen', 'Der vorhandene Verband wurde bei diesem Kontakt belassen. Die einsehbare Umgebung wurde beobachtet.'],
  ]),
  response: group('treatment', 'Ergebnis und Verträglichkeit', [
    ['response', 'Versorgung und Reaktion', 'Die betroffene Person konnte sich während der Versorgung zu ihrem Befinden äußern.'],
    ['same', 'Keine Änderung berichtet', 'Die betroffene Person berichtete nach der Versorgung keine Veränderung ihrer Beschwerden.'],
    ['better', 'Beschwerden geringer', 'Nach der Versorgung beschrieb die betroffene Person geringere Beschwerden.'],
    ['pause', 'Pause wegen Beschwerden', 'Während der Versorgung wurden Beschwerden geäußert. Auf Wunsch wurde pausiert.'],
    ['external', 'Rückmeldung steht aus', 'Eine Rückmeldung zum weiteren Vorgehen stand beim Abschluss des Eintrags noch aus.'],
    ['unknown', 'Ergebnis nicht beurteilbar', 'Eine verlässliche Beurteilung des Ergebnisses war bei diesem Kontakt nicht möglich.'],
  ]),
  follow_up: group('treatment', 'Kontrolle und weitere Abstimmung', [
    ['requested', 'Kontrolltermin angefragt', 'Eine weitere Kontrolle wurde angefragt. Ein verbindlicher Termin lag zum Dokumentationszeitpunkt noch nicht vor.'],
    ['contact', 'Rückmeldung zur Planung offen', 'Die zuständige Stelle wurde zur Terminabstimmung kontaktiert. Die Antwort steht aus.'],
    ['person', 'Termin mit Person abstimmen', 'Der Zeitpunkt wird noch mit der betroffenen Person abgestimmt.'],
    ['transfer', 'Kontrolle nach Übergabe offen', 'Die Zuständigkeit für die nächste Kontrolle ist nach der Übergabe noch zu klären.'],
    ['scheduled', 'Kontrolle im Terminplan', 'Die nach der Abstimmung vereinbarte Kontrolle ist im Terminplan erfasst.'],
  ]),
  pressure_risk: group('description', 'Dekubitusrisiko und Beurteilung', [
    ['mobility', 'Eigenständige Lagewechsel eingeschränkt', 'Die betroffene Person wechselt die Lage im beobachteten Zeitraum nicht durchgehend eigenständig.'],
    ['seated', 'Längeres Sitzen', 'Längere Sitzphasen mit eingeschränkter Druckentlastung wurden beobachtet.'],
    ['moisture', 'Hautfeuchtigkeit', 'Eine erhöhte Feuchtigkeit wurde an druckgefährdeten Hautbereichen beobachtet.'],
    ['shear', 'Scherbelastung beim Transfer', 'Beim beobachteten Transfer kam es zu einem Rutschen über die Unterlage.'],
    ['sensation', 'Druckwahrnehmung eingeschränkt', 'Die betroffene Person konnte Druck an dem beobachteten Bereich nur eingeschränkt wahrnehmen oder rückmelden.'],
    ['change', 'Erneute Einschätzung bei Veränderung', 'Die Beurteilung erfolgt erneut wegen einer beobachteten Änderung der Eigenbewegung.'],
  ]),
  pressure_prevention: group('treatment', 'Geplante Dekubitusprophylaxe', [
    ['movement', 'Eigenbewegung berücksichtigen', 'Geplant ist, eigenständige Lagewechsel zu fördern und den tatsächlich benötigten Unterstützungsumfang zu prüfen.'],
    ['sites', 'Gefährdete Hautbereiche beobachten', 'Die individuell gefährdeten Hautbereiche sollen bei den vereinbarten Kontrollen erneut betrachtet werden.'],
    ['equipment', 'Hilfsmittel abstimmen', 'Verfügbarkeit und Eignung der vorgesehenen druckentlastenden Hilfsmittel werden geklärt.'],
    ['comfort', 'Verträglichkeit überprüfen', 'Der Plan berücksichtigt die Rückmeldung der betroffenen Person zu Lagerung, Komfort und Beschwerden.'],
    ['review', 'Plan erneut beurteilen', 'Die nächste Beurteilung wird mit dem Team abgestimmt und bei einer relevanten Zustandsänderung früher veranlasst.'],
  ]),
  general_status: group('description', 'Allgemeinzustand', [
    ['awake', 'Wach und ansprechbar', 'Die betroffene Person war bei der Erhebung wach und ansprechbar.'],
    ['tired', 'Ermüdung berichtet', 'Die betroffene Person berichtete über rasche Ermüdung bei alltäglichen Aktivitäten.'],
    ['mobility', 'Unterstützung bei Mobilität', 'Bei der beobachteten Mobilisation war personelle Unterstützung erforderlich.'],
    ['limited', 'Erhebung eingeschränkt', 'Der Allgemeinzustand konnte bei diesem Kontakt nur eingeschränkt erhoben werden.'],
  ]),
  nutrition: group('description', 'Ernährung und Flüssigkeit', [
    ['appetite', 'Verminderter Appetit berichtet', 'Die betroffene Person berichtet über verminderten Appetit.'],
    ['help', 'Unterstützung bei Mahlzeiten', 'Bei der Vorbereitung und Bereitstellung von Mahlzeiten wird Unterstützung benötigt.'],
    ['intake', 'Trinkmenge offen', 'Zur tatsächlichen Trinkmenge lagen bei der Erhebung keine verlässlichen Angaben vor.'],
    ['weight', 'Gewichtsabnahme berichtet', 'Die betroffene Person berichtet über eine unbeabsichtigte Gewichtsabnahme. Der gemessene Verlauf steht noch aus.'],
    ['preferences', 'Vorlieben erfragt', 'Die betroffene Person äußerte Vorlieben für die Auswahl und den Zeitpunkt ihrer Mahlzeiten.'],
  ]),
  psychosocial: group('description', 'Psychosoziale Situation', [
    ['concern', 'Verunsicherung geäußert', 'Die betroffene Person äußerte Unsicherheit über den weiteren Wundverlauf.'],
    ['support', 'Bezugsperson einbezogen', 'Auf Wunsch der betroffenen Person wurde eine Bezugsperson in das Gespräch einbezogen.'],
    ['participation', 'Rückzug von Aktivitäten', 'Die betroffene Person berichtet, dass sie vertraute Aktivitäten im Zusammenhang mit der Wundsituation seltener wahrnimmt.'],
    ['contact', 'Gespräch gewünscht', 'Die betroffene Person möchte die Belastung durch die Versorgung in einem weiteren Gespräch besprechen.'],
  ]),
  diagnoses: group('description', 'Bekannte Diagnosen und Quelle', [
    ['pending', 'Diagnosen noch abzugleichen', 'Der Abgleich mit dem aktuellen ärztlichen Befund steht noch aus.'],
    ['diabetes', 'Diabetes mellitus vorbekannt', 'Ein Diabetes mellitus ist in der vorliegenden Vordokumentation genannt.'],
    ['arterial', 'Arterielle Gefäßerkrankung vorbekannt', 'Eine periphere arterielle Verschlusskrankheit ist in der ärztlichen Vordokumentation genannt.'],
    ['venous', 'Venöse Insuffizienz vorbekannt', 'Eine chronisch venöse Insuffizienz ist in der ärztlichen Vordokumentation genannt.'],
  ]),
  influences: group('description', 'Weitere Einflussfaktoren', [
    ['mobility', 'Mobilität und Druckbelastung', 'Beim Sitzen oder Liegen sind eigenständige Lageänderungen erschwert.'],
    ['moisture', 'Wiederkehrende Hautfeuchtigkeit', 'An der betroffenen Region wird wiederkehrende Feuchtigkeit beobachtet.'],
    ['support', 'Versorgung im häuslichen Umfeld', 'Die Verfügbarkeit von Unterstützung im häuslichen Umfeld beeinflusst die Durchführung der Pflege.'],
    ['materials', 'Materialverfügbarkeit', 'Der Bezug des vorgesehenen Verbandsmaterials ist zum Erfassungszeitpunkt noch nicht gesichert.'],
  ]),
  notes: group('description', 'Notizen und Anmerkungen', [
    ['question', 'Rückfrage offen', 'Eine Rückfrage aus dem heutigen Gespräch ist noch zu klären.'],
    ['reported', 'Angabe aus dem Gespräch', 'Die zusätzliche Information beruht auf der Schilderung im Gespräch und wurde noch nicht anderweitig bestätigt.'],
    ['record', 'Unterlagen angefragt', 'Aktuelle Unterlagen wurden zur Ergänzung der Pflegeanamnese angefragt.'],
    ['update', 'Änderung seit dem letzten Kontakt', 'Die Angaben ergänzen die Pflegeanamnese um eine Veränderung seit dem letzten Kontakt.'],
  ]),
  foot_history: group('description', 'Diabetischer Fuß · Anamnese', [
    ['earlier', 'Frühere Fußwunde berichtet', 'Die betroffene Person berichtet über eine abgeheilte Fußwunde in der Vorgeschichte.'],
    ['amputation', 'Amputation vorbeschrieben', 'Eine frühere Amputation an der unteren Extremität ist in der Vordokumentation beschrieben.'],
    ['pain', 'Schmerzen beim Gehen', 'Die betroffene Person berichtet über Beschwerden beim Gehen.'],
    ['numbness', 'Taubheitsgefühl berichtet', 'Die betroffene Person berichtet über Taubheitsgefühl am untersuchten Fuß.'],
    ['self', 'Fußkontrolle erschwert', 'Die betroffene Person berichtet, dass sie Fußsohle und Zehenzwischenräume nicht vollständig selbst einsehen kann.'],
  ]),
  foot_exam: group('description', 'Diabetischer Fuß · Fußbefund', [
    ['callus', 'Schwiele am Vorfuß', 'Plantar am Vorfuß ist eine umschriebene Verhornung sichtbar.'],
    ['fissure', 'Fissur an der Ferse', 'An der Ferse ist eine Fissur sichtbar.'],
    ['marks', 'Druckabdruck nach Schuhabnahme', 'Nach Abnahme des Schuhs ist an der untersuchten Stelle ein Druckabdruck sichtbar.'],
    ['skin', 'Trockene Fußhaut', 'Die Haut am betrachteten Fuß ist trocken und schuppig.'],
    ['wound', 'Offener Hautdefekt', 'Bei der Fußinspektion wurde ein offener Hautdefekt im untersuchten Bereich gesehen.'],
    ['limited', 'Fußbefund eingeschränkt', 'Die Inspektion konnte nicht auf alle Bereiche des Fußes ausgedehnt werden.'],
  ]),
  foot_neurology: group('description', 'Diabetischer Fuß · Neurologie', [
    ['tingling', 'Kribbeln geschildert', 'Die betroffene Person schildert Kribbeln an dem untersuchten Fuß.'],
    ['touch', 'Berührung schwächer wahrgenommen', 'Die betroffene Person gab an den geprüften Stellen eine schwächere Berührungswahrnehmung an.'],
    ['test', 'Sensorischer Test im Befund', 'Ein sensorischer Test wurde durchgeführt. Die geprüften Stellen und Reaktionen sind im zugehörigen Untersuchungsbefund erfasst.'],
    ['pending', 'Sensibilität nicht zuverlässig prüfbar', 'Eine verlässliche Prüfung der Sensibilität war bei dieser Erhebung nicht möglich.'],
  ]),
  foot_vascular: group('description', 'Diabetischer Fuß · Durchblutung', [
    ['cool', 'Kühler im Seitenvergleich', 'Der betrachtete Fuß fühlte sich im Seitenvergleich kühler an.'],
    ['color', 'Veränderte Hautfarbe', 'Die Hautfarbe am betrachteten Fuß unterscheidet sich erkennbar von der Gegenseite.'],
    ['pulse', 'Fußpuls nicht sicher tastbar', 'Der geprüfte Fußpuls war bei dieser Erhebung nicht sicher tastbar.'],
    ['pending', 'Gefäßbefund steht aus', 'Zur Gefäßsituation liegt noch kein aktueller bestätigter Befund vor.'],
  ]),
  foot_shoes: group('description', 'Diabetischer Fuß · Schuhversorgung', [
    ['marks', 'Druckspuren am Schuhkontakt', 'Im Bereich des Schuhkontakts sind Druckspuren an der Haut sichtbar.'],
    ['space', 'Platz im Zehenbereich eingeschränkt', 'Bei der beobachteten Passform steht den Zehen wenig Raum zur Verfügung.'],
    ['insoles', 'Einlagen mitgebracht', 'Die vorhandenen Einlagen wurden beim Kontakt mitgebracht und betrachtet.'],
    ['none', 'Schuhwerk nicht beurteilbar', 'Das regelmäßig getragene Schuhwerk lag bei der Erhebung nicht zur Beurteilung vor.'],
  ]),
  foot_summary: group('treatment', 'Diabetischer Fuß · Beurteilung und Maßnahmen', [
    ['review', 'Fachliche Klärung angestoßen', 'Die erhobenen Fußbefunde wurden zur fachlichen Klärung weitergegeben.'],
    ['inspection', 'Kontrolle abstimmen', 'Der nächste Zeitpunkt für die Fußkontrolle wird mit der betroffenen Person abgestimmt.'],
    ['shoes', 'Schuhversorgung zum Abgleich', 'Die beobachtete Passform wird bei der Abstimmung zur Schuhversorgung berücksichtigt.'],
    ['limitations', 'Beurteilung noch unvollständig', 'Die zusammenfassende Beurteilung erfolgt nach Vorliegen der noch ausstehenden Befunde.'],
  ]),
  tracheo_stoma: group('description', 'Tracheostomie · Stoma und Haut', [
    ['dry', 'Sichtbare Umgebung trocken', 'Die einsehbare Haut um das Tracheostoma ist trocken.'],
    ['redness', 'Lokale Rötung', 'In der einsehbaren Stomaumgebung ist eine örtlich begrenzte Rötung sichtbar.'],
    ['moisture', 'Auflage befeuchtet', 'Die Auflage am Tracheostoma zeigt eine Durchfeuchtung.'],
    ['limited', 'Haut teilweise verdeckt', 'Die Haut ist nur im Bereich außerhalb der Abdeckung beurteilbar.'],
  ]),
  tracheo_device: group('description', 'Tracheostomie · Kanüle und Zubehör', [
    ['information', 'Kanülenangaben abgeglichen', 'Die sichtbaren Kanülenangaben wurden mit der vorhandenen Dokumentation abgeglichen.'],
    ['inner', 'Innenkanüle vorhanden', 'Eine Innenkanüle ist in der aktuellen Versorgung dokumentiert.'],
    ['fixation', 'Fixierung betrachtet', 'Die zugängliche Fixierung wurde betrachtet. Beobachtungen zur Haut sind im Stomabefund erfasst.'],
    ['pending', 'Kanülendaten noch offen', 'Die aktuelle Kanülenausführung konnte anhand der vorhandenen Angaben nicht sicher bestätigt werden.'],
  ]),
  tracheo_breathing: group('description', 'Tracheostomie · Sekret und Atmung', [
    ['thin', 'Dünnflüssiges sichtbares Sekret', 'Das sichtbare Sekret wirkt dünnflüssig.'],
    ['thick', 'Zähes sichtbares Sekret', 'Das sichtbare Sekret wirkt zähflüssig.'],
    ['cough', 'Husten beobachtet', 'Im Beobachtungszeitraum trat Husten auf.'],
    ['effort', 'Veränderte Atemarbeit', 'Die beobachtete Atemarbeit hat sich gegenüber dem dokumentierten Vergleich verändert.'],
    ['limited', 'Erhebung eingeschränkt', 'Sekret und Atemsituation waren bei diesem Kontakt nur eingeschränkt beurteilbar.'],
  ]),
  tracheo_care: group('treatment', 'Tracheostomie · Pflegerische Maßnahmen', [
    ['observation', 'Stoma kontrolliert', 'Das einsehbare Tracheostoma und die zugängliche Hautumgebung wurden beobachtet.'],
    ['dressing', 'Auflage gewechselt', 'Die vorgesehene Stomaauflage wurde gemäß dokumentierter Grundlage gewechselt.'],
    ['reported', 'Veränderung weitergegeben', 'Die beobachtete Veränderung wurde an die zuständige Stelle weitergegeben.'],
    ['pending', 'Versorgungsschritt noch abzustimmen', 'Der weitere Versorgungsschritt steht zur fachlichen Abstimmung an.'],
  ]),
  tracheo_training: group('treatment', 'Tracheostomie · Schulung und Rückdemonstration', [
    ['equipment', 'Zubehör besprochen', 'Die verwendeten Hilfsmittel und ihre Zuordnung zur vorhandenen Versorgung wurden gemeinsam besprochen.'],
    ['observation', 'Beobachtungen besprochen', 'Die besprochenen Beobachtungspunkte am Stoma und in seiner Umgebung wurden gemeinsam wiederholt.'],
    ['repeated', 'Rückdemonstration mit Unterstützung', 'Die geschulte Person zeigte den besprochenen Ablauf unter Anleitung. Einzelne Schritte wurden gemeinsam wiederholt.'],
    ['pending', 'Rückdemonstration noch offen', 'Die Inhalte wurden besprochen. Die praktische Rückdemonstration ist für einen weiteren Termin vorgesehen.'],
  ]),
  training_participants: group('description', 'Tracheostomie · Teilnehmende', [
    ['person', 'Betroffene Person', 'Die betroffene Person nahm an der Schulung teil.'],
    ['relative', 'Betroffene Person und Bezugsperson', 'Die betroffene Person und eine von ihr benannte Bezugsperson nahmen teil.'],
    ['team', 'Mitarbeitende des Pflegeteams', 'Die Einweisung erfolgte für die anwesenden Mitarbeitenden des Pflegeteams.'],
    ['partial', 'Teilweise Teilnahme', 'Die betroffene Person nahm an einem Teil der Schulung teil.'],
  ]),
  tracheo_follow_up: group('treatment', 'Tracheostomie · Kontrolle und Vereinbarung', [
    ['follow', 'Verlaufskontrolle einplanen', 'Die nächste Kontrolle des Stomabefunds wird mit den Beteiligten abgestimmt.'],
    ['review', 'Erneute Rückdemonstration', 'Für die noch offenen Schulungsinhalte ist eine erneute Rückdemonstration vorgesehen.'],
    ['information', 'Rückmeldung ausstehend', 'Die Rückmeldung zur weiteren Versorgung steht noch aus.'],
    ['equipment', 'Hilfsmittelstatus klären', 'Der aktuelle Stand der Hilfsmittelversorgung wird vor der nächsten Kontrolle abgeglichen.'],
  ]),
  professional_basis: group('treatment', 'Fachliche Beurteilung und Abstimmung', [
    ['assessment', 'Bezug auf aktuellen Befund', 'Die fachliche Beurteilung bezieht sich auf den zuletzt dokumentierten Wundbefund.'],
    ['with_team', 'Abstimmung im Pflegeteam', 'Die Beobachtungen wurden im zuständigen Pflegeteam besprochen.'],
    ['pending', 'Weitere Einschätzung angefragt', 'Eine ergänzende fachliche Einschätzung wurde angefragt.'],
    ['limits', 'Befundlage unvollständig', 'Die vorhandenen Angaben reichen für eine abschließende fachliche Beurteilung noch nicht aus.'],
  ]),
  plan_change: group('treatment', 'Änderungsgrund der Planfassung', [
    ['finding', 'Veränderter Wundbefund', 'Die neue Planfassung berücksichtigt eine dokumentierte Veränderung des Wundbefunds.'],
    ['material', 'Materialversorgung geändert', 'Die neue Planfassung berücksichtigt die geänderte abgestimmte Materialversorgung.'],
    ['comfort', 'Verträglichkeit neu beurteilt', 'Die Planfassung wird aufgrund der dokumentierten Rückmeldung zur Verträglichkeit angepasst.'],
    ['order', 'Neue ärztliche Grundlage', 'Die Anpassung bezieht sich auf eine neu dokumentierte ärztliche Grundlage.'],
  ]),
  qualification: group('treatment', 'Qualifikation und Delegation', [
    ['confirmed', 'Qualifikation im Einsatzbezug geprüft', 'Die für die geplante Aufgabe vorgesehene Qualifikation wurde im Einsatzbezug geprüft.'],
    ['scope', 'Delegationsumfang abzugleichen', 'Der Umfang der Delegation ist für diesen Versorgungsschritt noch abzugleichen.'],
    ['pending', 'Zuständigkeit offen', 'Die fachliche Zuständigkeit war zum Dokumentationszeitpunkt nicht abschließend geklärt.'],
    ['pending_proof', 'Nachweis steht aus', 'Der erforderliche Nachweis zur Qualifikation lag zum Erfassungszeitpunkt noch nicht vor.'],
  ]),
  goal: group('treatment', 'Individuelles Versorgungsziel', [
    ['comfort', 'Beschwerden bei Versorgung reduzieren', 'Ziel ist eine aus Sicht der betroffenen Person besser verträgliche Wundversorgung.'],
    ['skin', 'Wundumgebung schützen', 'Ziel ist es, die Haut der Wundumgebung vor weiterer Feuchtigkeitsbelastung zu schützen.'],
    ['exudate', 'Exsudat auffangen', 'Ziel ist eine ausreichende Aufnahme des Wundexsudats bis zur vereinbarten Kontrolle.'],
    ['independence', 'Eigenständigkeit fördern', 'Ziel ist die größtmögliche eigenständige Beteiligung der betroffenen Person an der Versorgung.'],
    ['comparison', 'Verlauf vergleichbar beurteilen', 'Ziel ist ein nachvollziehbarer Vergleich mit dem letzten Befund anhand gleichartig erhobener Angaben.'],
  ]),
  planned_material: group('treatment', 'Vorgesehenes Verbandsmaterial', [
    ['order', 'Material laut Versorgungsvorgabe', 'Vorgesehen ist das in der dokumentierten Versorgungsgrundlage bezeichnete Material.'],
    ['available', 'Verfügbarkeit vor Einsatz klären', 'Die Verfügbarkeit der vorgesehenen Auflage und Fixierung ist vor dem nächsten Einsatz zu klären.'],
    ['alternate', 'Materialalternative zur Abstimmung', 'Eine Materialalternative wurde zur Abstimmung vorgelegt. Eine abschließende Festlegung steht aus.'],
    ['reconcile', 'Ausführung und Größe abgleichen', 'Ausführung und Größe des vorhandenen Materials werden mit der dokumentierten Festlegung abgeglichen.'],
  ]),
  interval: group('treatment', 'Wechselintervall', [
    ['plan', 'Wechsel gemäß gültigem Plan', 'Der nächste Wechsel ist gemäß der dokumentierten Planfassung vorgesehen.'],
    ['pending', 'Wechselintervall noch offen', 'Eine verbindliche Festlegung des Wechselintervalls liegt derzeit nicht vor.'],
    ['change', 'Anlass für vorgezogene Prüfung', 'Bei einer beobachteten Abweichung wird der geplante Wechseltermin mit der zuständigen Stelle erneut abgestimmt.'],
    ['assigned', 'Abstimmung mit Zuständigen', 'Die Festlegung des Wechselintervalls wurde bei der zuständigen Stelle angefragt.'],
  ]),
  hygiene_plan: group('treatment', 'Geplantes hygienisches Vorgehen', [
    ['standard', 'Einrichtungsstandard zugrunde gelegt', 'Das geplante Vorgehen richtet sich nach dem geltenden Hygienestandard und der dokumentierten Versorgungsgrundlage.'],
    ['workspace', 'Arbeitsfläche und Material vorbereiten', 'Für die Versorgung sind eine geeignete Arbeitsfläche und die nach Plan benötigten Materialien vorgesehen.'],
    ['separate', 'Arbeitsbereiche vorbereiten', 'Die Vorbereitung sieht getrennte Ablagebereiche für bereitgestelltes und benutztes Material vor.'],
    ['limits', 'Umgebungsbedingungen abklären', 'Die Bedingungen für die hygienische Vorbereitung am Versorgungsort sind noch abzuklären.'],
  ]),
  pain_plan: group('treatment', 'Abgestimmtes Schmerzmanagement', [
    ['assess', 'Schmerz vor und nach Versorgung erheben', 'Vor und nach der Versorgung ist eine Erhebung mit der vereinbarten Skala geplant, soweit die betroffene Person diese anwenden kann.'],
    ['stop', 'Pause auf Wunsch vereinbart', 'Mit der betroffenen Person wurde eine Unterbrechungsmöglichkeit bei Beschwerden besprochen.'],
    ['review', 'Ausreichende Linderung klären', 'Die Rückmeldung zu den bisherigen Beschwerden wird mit der zuständigen Stelle besprochen.'],
    ['pending', 'Schmerzbezogene Festlegung offen', 'Zum geplanten Schmerzmanagement besteht noch Abstimmungsbedarf.'],
  ]),
  warning_signs: group('treatment', 'Abgestimmte Beobachtungspunkte', [
    ['environment', 'Veränderung der Wundumgebung', 'Als Beobachtungspunkte wurden Veränderungen von Rötung, Wärme und Schwellung der Wundumgebung besprochen.'],
    ['exudate', 'Veränderung von Exsudat', 'Die weitere Beobachtung berücksichtigt veränderte Menge, Farbe und Konsistenz des Wundexsudats.'],
    ['pain', 'Zunahme von Beschwerden', 'Eine Veränderung der geschilderten Beschwerden ist Bestandteil der abgestimmten Verlaufskontrolle.'],
    ['dressing', 'Verbandzustand', 'Sitz, Durchfeuchtung und Abdeckung des Verbands sollen bei der vereinbarten Kontrolle erfasst werden.'],
  ]),
  escalation: group('treatment', 'Kontaktweg und Eskalation', [
    ['team', 'Pflegefachliche Rücksprache vorgesehen', 'Bei einer beobachteten Veränderung ist die zuständige Pflegefachperson als erste Kontaktstelle vorgesehen.'],
    ['physician', 'Ärztliche Rücksprache vorgesehen', 'Für die ärztliche Klärung wird der in der Akte hinterlegte Kontaktweg verwendet.'],
    ['pending', 'Vertretung noch abzustimmen', 'Die erreichbare Vertretung und der Kontaktweg außerhalb der regulären Zeiten sind noch abzustimmen.'],
    ['handover', 'Übergabe mit aktuellem Befund', 'Bei der Übergabe sollen der aktuelle Befund und die offenen Rückfragen gemeinsam weitergegeben werden.'],
  ]),
  cleaning_done: group('treatment', 'Erfolgte Wundreinigung', [
    ['done', 'Reinigung nach dokumentierter Grundlage', 'Die sichtbare Wundfläche wurde mit der in der Versorgungsgrundlage festgelegten Lösung gereinigt.'],
    ['limited', 'Nur zugängliche Bereiche gereinigt', 'Die Reinigung umfasste die frei zugänglichen Bereiche. Verdeckte Abschnitte wurden nicht einbezogen.'],
    ['omitted', 'Verband belassen', 'Bei liegendem Verband wurde keine Wundreinigung durchgeführt.'],
    ['stopped', 'Reinigung abgebrochen', 'Die begonnene Reinigung wurde wegen geäußerter Beschwerden auf Wunsch der betroffenen Person beendet.'],
  ]),
  technique_done: group('treatment', 'Erfolgte Versorgung und Verbandtechnik', [
    ['change', 'Auflage und Fixierung gewechselt', 'Die abgenommene Auflage wurde durch die tatsächlich dokumentierte Wundauflage mit Fixierung ersetzt.'],
    ['outer', 'Äußere Fixierung erneuert', 'Die äußere Fixierung wurde erneuert. Die vorhandene Wundauflage blieb liegen.'],
    ['inspect', 'Verband kontrolliert', 'Der vorhandene Verband wurde auf Sitz und Durchfeuchtung kontrolliert.'],
    ['none', 'Versorgungsschritt nicht durchgeführt', 'Die vorgesehene Versorgung wurde bei diesem Kontakt nicht durchgeführt. Der Grund ist beim Ergebnis erfasst.'],
  ]),
  hygiene_done: group('treatment', 'Hygienische Bedingungen bei Durchführung', [
    ['surface', 'Arbeitsfläche vorbereitet', 'Die Arbeitsfläche am Versorgungsort wurde vor der Durchführung vorbereitet.'],
    ['standard', 'Vorgesehene Hygieneschritte eingehalten', 'Die für diese Versorgung vorgesehenen hygienischen Schritte wurden durchgeführt.'],
    ['separate', 'Material getrennt abgelegt', 'Bereitgestelltes und benutztes Material wurden getrennt abgelegt.'],
    ['pending', 'Bedingungen vor Beginn nicht erfüllt', 'Die vorgesehenen hygienischen Voraussetzungen waren zu Beginn nicht gegeben. Die Durchführung wurde zurückgestellt.'],
  ]),
  no_material: group('treatment', 'Kein Materialverbrauch', [
    ['inspection', 'Nur Sichtkontrolle', 'Bei der reinen Sichtkontrolle wurde kein Verbandsmaterial verbraucht.'],
    ['retained', 'Vorhandener Verband belassen', 'Der bereits vorhandene Verband blieb unverändert liegen.'],
    ['not_started', 'Versorgung nicht begonnen', 'Die vorgesehene Versorgung wurde nicht begonnen. Es wurde kein Material eingesetzt.'],
    ['discussion', 'Abstimmung ohne Versorgung', 'Der Kontakt diente der Abstimmung. Dabei wurde kein Material benötigt.'],
  ]),
  deviation: group('treatment', 'Abweichung, Ablehnung und Nichtdurchführung', [
    ['declined', 'Maßnahme abgelehnt', 'Die betroffene Person lehnte die vorgesehene Maßnahme nach dem Gespräch ab.'],
    ['partial', 'Nur Teil der Versorgung möglich', 'Die Versorgung konnte nur teilweise durchgeführt werden. Die ausgeführten Schritte sind im Durchführungsfeld erfasst.'],
    ['unavailable', 'Vorgesehenes Material nicht verfügbar', 'Das vorgesehene Material war zum Zeitpunkt des Einsatzes nicht verfügbar.'],
    ['stopped', 'Durchführung unterbrochen', 'Die begonnene Durchführung wurde auf Wunsch der betroffenen Person unterbrochen.'],
    ['pending', 'Durchführung wegen Klärung zurückgestellt', 'Die vorgesehene Durchführung wurde bis zur Klärung der dokumentierten Abweichung zurückgestellt.'],
  ]),
  contact: group('treatment', 'Tatsächliche Rücksprache', [
    ['requested', 'Kontaktversuch erfolgt', 'Die zuständige Stelle wurde kontaktiert. Eine Rückmeldung stand zum Erfassungszeitpunkt noch aus.'],
    ['discussed', 'Befund weitergegeben', 'Der aktuelle Befund und die beobachtete Veränderung wurden bei der Rücksprache weitergegeben.'],
    ['pending', 'Erneute Rücksprache vereinbart', 'Eine erneute Rücksprache zur Klärung der offenen Punkte wurde vereinbart.'],
    ['none', 'Keine akute Rücksprache erforderlich', 'Auf Grundlage der aktuellen Beobachtung ergab sich bei diesem Kontakt kein zusätzlicher Rücksprachebedarf.'],
  ]),
  contact_channel: group('treatment', 'Kontaktweg', [
    ['phone', 'Telefonisch', 'Telefonisch'],
    ['onsite', 'Persönlich vor Ort', 'Persönlich vor Ort'],
    ['secured', 'Über sicheren Nachrichtendienst', 'Über den vereinbarten sicheren Nachrichtendienst'],
    ['handover', 'In der Übergabe', 'Bei der persönlichen Übergabe'],
  ]),
  contact_party: group('treatment', 'Kontaktstelle', [
    ['practice', 'Hausärztliche Praxis', 'Hausärztliche Praxis'],
    ['wound', 'Wundambulanz', 'Zuständige Wundambulanz'],
    ['nursing', 'Pflegefachliche Leitung', 'Zuständige pflegefachliche Leitung'],
    ['specialist', 'Fachärztliche Praxis', 'Zuständige fachärztliche Praxis'],
  ]),
  contact_response: group('treatment', 'Erhaltene Rückmeldung', [
    ['pending', 'Rückmeldung steht aus', 'Zum Zeitpunkt der Dokumentation lag noch keine Rückmeldung auf die Anfrage vor.'],
    ['review', 'Fachliche Prüfung angekündigt', 'Die kontaktierte Stelle kündigte eine fachliche Prüfung des übermittelten Befunds an.'],
    ['more', 'Ergänzende Angaben angefragt', 'Die kontaktierte Stelle bat um ergänzende Angaben zum aktuellen Befund.'],
    ['callback', 'Rückruf angekündigt', 'Die kontaktierte Stelle kündigte einen Rückruf zur weiteren Abstimmung an.'],
  ]),
  path_title: group('description', 'Titel des Wundvorgangs', [
    ['change', 'Veränderung der Wundsituation', 'Veränderung der Wundsituation'],
    ['coordination', 'Abstimmung der Wundversorgung', 'Abstimmung der Wundversorgung'],
    ['contact', 'Rücksprache zum Wundbefund', 'Rücksprache zum Wundbefund'],
    ['check', 'Weitere Wundkontrolle', 'Weitere Wundkontrolle'],
    ['addendum', 'Ergänzung zum Wundvorgang', 'Ergänzung zum Wundvorgang'],
  ]),
  closure: group('treatment', 'Abschlussgrund', [
    ['closed', 'Wunde im Abschlussbefund geschlossen', 'Die sichtbare Wundfläche ist im zugehörigen Abschlussbefund als geschlossen beschrieben.'],
    ['transfer', 'Versorgung übergeben', 'Die zugehörige Versorgung wurde an eine andere Stelle übergeben. Der Befund zum Übergabezeitpunkt ist dokumentiert.'],
    ['arrangement', 'Erfassung endet mit Pflegeauftrag', 'Die Erfassung in dieser Pflegeakte endet mit dem zugehörigen Pflegeauftrag. Der letzte Befund ist in der Akte festgehalten.'],
    ['reason', 'Abschluss nach Prüfung', 'Die zuvor offenen Punkte des Wundfalls wurden mit dem aktuellen Befund abgeglichen.'],
  ]),
  reopening: group('treatment', 'Grund für Wiedereröffnung', [
    ['new_opening', 'Hautdefekt erneut sichtbar', 'An der dokumentierten Stelle ist erneut ein offener Hautdefekt sichtbar.'],
    ['returned', 'Versorgung erneut übernommen', 'Die Versorgung derselben Wunde wurde nach der zwischenzeitlichen Übergabe erneut übernommen.'],
    ['pending', 'Offene Befundklärung festgestellt', 'Bei der Prüfung des abgeschlossenen Falls wurde eine noch nicht abgeschlossene Befundklärung festgestellt.'],
    ['later_info', 'Neue Information zum Übergabebefund', 'Eine nach dem Abschluss eingegangene Information wird im weiteren Verlauf berücksichtigt.'],
  ]),
  decision_basis: group('treatment', 'Bezug der Fallentscheidung', [
    ['assessment', 'Dokumentierter Abschlussbefund', 'Die Entscheidung bezieht sich auf den dokumentierten Abschlussbefund.'],
    ['comparison', 'Vergleich mit Vorbefund', 'Für die Entscheidung wurden aktueller Befund und der zugehörige Vergleichsbefund gegenübergestellt.'],
    ['handover', 'Übergabegrundlage', 'Maßgeblich sind der bei der Übergabe dokumentierte Befund und die festgehaltene Zuständigkeit.'],
    ['pending', 'Weiterer fachlicher Abgleich', 'Ein abschließender fachlicher Abgleich steht noch aus.'],
  ]),
  handover: group('treatment', 'Weitere Versorgung und Übergabe', [
    ['shared', 'Befund bei Übergabe weitergegeben', 'Der aktuelle Befund und die dokumentierten offenen Punkte wurden bei der Übergabe weitergegeben.'],
    ['person', 'Weiteres Vorgehen mit Person besprochen', 'Das weitere Vorgehen wurde mit der betroffenen Person besprochen.'],
    ['open', 'Übernahme noch offen', 'Die künftige Zuständigkeit für weitere Kontrollen ist noch nicht bestätigt.'],
    ['no_need', 'Keine weitere Wundversorgung geplant', 'Nach der dokumentierten Abschlussbeurteilung ist aktuell keine weitere Wundversorgung vorgesehen.'],
  ]),
  correction_statement: group('description', 'Berichtigte Aussage und Kenntnisstand', [
    ['unknown', 'Ursprünglicher Wert nicht bestätigbar', 'Der ursprüngliche Wert kann anhand der vorliegenden Quelle nicht bestätigt werden. Der tatsächliche Wert bleibt offen.'],
    ['source', 'Eigenbeobachtung nicht bestätigt', 'Die Angabe beruhte auf einer Mitteilung. Eine eigene Beobachtung zu diesem Zeitpunkt ist nicht belegt.'],
    ['plan', 'Planung statt Durchführung', 'Die ursprüngliche Angabe beschreibt den geplanten Schritt. Seine tatsächliche Durchführung ist nicht bestätigt.'],
    ['time', 'Ereigniszeit nicht sicher belegt', 'Der dokumentierte Erfassungszeitpunkt belegt den tatsächlichen Ereigniszeitpunkt nicht. Dieser bleibt offen.'],
  ]),
  correction_reason: group('description', 'Grund für Berichtigung oder Nachtrag', [
    ['transfer', 'Übertragungsfehler festgestellt', 'Beim Abgleich mit der zugehörigen Quelle wurde ein Übertragungsfehler festgestellt.'],
    ['unit', 'Einheit verwechselt', 'Die zuvor erfasste Einheit stimmt nicht mit der in der Quelle angegebenen Einheit überein.'],
    ['source', 'Quelle nachträglich verfügbar', 'Eine zum Zeitpunkt der ursprünglichen Erfassung noch nicht verfügbare Quelle liegt jetzt zur Prüfung vor.'],
    ['timing', 'Erfassung und Beobachtung verwechselt', 'Der Zeitpunkt der Erfassung wurde mit dem Zeitpunkt der Beobachtung verwechselt.'],
    ['clarification', 'Abweichung im Verlauf erläutern', 'Die Erläuterung ergänzt den ursprünglichen Verlauf um die nachträglich geklärte Information.'],
  ]),
  evidence: group('description', 'Erkenntnisgrundlage und Quelle', [
    ['original', 'Ursprünglicher Durchführungsnachweis', 'Der ursprüngliche Nachweis wurde mit dem anderen dokumentierten Eintrag abgeglichen.'],
    ['photo', 'Zugeordnetes Foto geprüft', 'Das zugehörige Foto wurde im Hinblick auf den im Eintrag bezeichneten Befund geprüft.'],
    ['observation', 'Eigene spätere Beobachtung', 'Grundlage ist eine später erhobene eigene Beobachtung. Der frühere Befund ist damit nur eingeschränkt beurteilbar.'],
    ['reported', 'Spätere Rückmeldung', 'Grundlage ist eine nachträgliche Rückmeldung aus dem dokumentierten Kontakt.'],
  ]),
  clinical_impact: group('treatment', 'Auswirkungen und offene Prüfung', [
    ['comparison', 'Vergleichsgrundlage ändert sich', 'Die Berichtigung ist bei der weiteren Auswertung des Verlaufs zu berücksichtigen.'],
    ['decision', 'Frühere Entscheidung erneut prüfen', 'Die Auswirkung auf die damalige Entscheidung wird noch geprüft.'],
    ['evaluation', 'Auswirkung auf Planung offen', 'Ob die Korrektur eine Anpassung der weiteren Versorgung erfordert, steht noch zur Abstimmung an.'],
    ['documentary', 'Dokumentarische Klarstellung', 'Bei der Prüfung ergab sich eine Klarstellung des Eintrags. Eine Änderung der weiteren Versorgung ist aktuell nicht geplant.'],
  ]),
  review_reason: group('treatment', 'Anlass der fachlichen Wundprüfung', [
    ['change', 'Veränderter Befund', 'Der veränderte Wundbefund soll in Verbindung mit der bisherigen Versorgung fachlich beurteilt werden.'],
    ['difference', 'Abweichung im Nachweis', 'Zwischen Planung und dokumentierter Durchführung besteht Klärungsbedarf.'],
    ['photo', 'Bildzuordnung prüfen', 'Die Zuordnung des Bildnachweises zum dokumentierten Wundbefund soll geprüft werden.'],
    ['basis', 'Versorgungsgrundlage prüfen', 'Die Eindeutigkeit der dokumentierten Grundlage für die weitere Versorgung soll geprüft werden.'],
  ]),
  review_revision: group('treatment', 'Rückgabe und erforderliche Ergänzung', [
    ['source', 'Quelle eindeutig zuordnen', 'Den zugrunde liegenden Befund eindeutig benennen und mit dem betreffenden Eintrag verknüpfen.'],
    ['time', 'Zeitpunkt klarstellen', 'Tatsächlichen Zeitpunkt und späteren Erfassungszeitpunkt nachvollziehbar auseinanderhalten.'],
    ['plan', 'Planung und Durchführung präzisieren', 'Die geplante Maßnahme und den tatsächlich ausgeführten Schritt jeweils eindeutig beschreiben.'],
    ['limits', 'Beurteilungsgrenze präzisieren', 'Ergänzen, welcher Teil beurteilt werden konnte und welche Angaben weiterhin offen sind.'],
  ]),
  review_rationale: group('treatment', 'Begründung der fachlichen Annahme', [
    ['evidence', 'Befund und Bezug plausibel', 'Befund, zugehöriger Nachweis und Bezug zur dokumentierten Entscheidung wurden abgeglichen.'],
    ['boundary', 'Beurteilungsgrenzen benannt', 'Die Beurteilungsgrenzen sind im Eintrag nachvollziehbar beschrieben.'],
    ['changes', 'Geforderte Ergänzung geprüft', 'Die zuvor angefragte Ergänzung wurde anhand der vorliegenden Nachweise geprüft.'],
    ['planning', 'Versorgungsablauf nachvollziehbar', 'Planung und tatsächliche Durchführung sind im geprüften Vorgang getrennt nachvollziehbar.'],
  ]),
  body_mark: group('description', 'Beobachtung an der Körperstelle', [
    ['change', 'Örtliche Hautveränderung', 'An der markierten Stelle ist eine örtlich begrenzte Hautveränderung sichtbar.'],
    ['wound', 'Offener Hautdefekt', 'Die Markierung bezeichnet die sichtbare Stelle des offenen Hautdefekts.'],
    ['redness', 'Örtliche Rötung', 'Die Markierung kennzeichnet den Bereich der beobachteten Rötung.'],
    ['pressure', 'Druckgefährdeter Bereich', 'Die markierte Stelle wurde als druckgefährdeter Bereich beobachtet.'],
    ['reference', 'Position als Orientierung', 'Die Markierung dokumentiert die Körperstelle für spätere Vergleichsbefunde.'],
  ]),
};

export type WoundTemplateField = keyof typeof WOUND_TEMPLATE_FIELDS;

type FieldAssignments = Readonly<Partial<Record<string, WoundTemplateField>>>;

export const WOUND_DRAFT_TEMPLATE_FIELDS: FieldAssignments = {
  bodyLocation: 'location', woundType: 'wound_type', etiology: 'cause', acquiredWhere: 'origin',
  onsetUnknownReason: 'onset_unknown', description: 'description', basisReference: 'medical_basis',
  carePlan: 'planned_care', measurementMethod: 'measurement',
  lengthReason: 'measurement_unavailable', widthReason: 'measurement_unavailable', depthReason: 'measurement_unavailable',
  woundBed: 'wound_bed', exudate: 'exudate', odor: 'odor', woundEdge: 'wound_edge', surroundingSkin: 'skin',
  infectionObservation: 'infection_observation', painReason: 'pain_unavailable', personalImpact: 'impact',
  preferences: 'person_decision', selfManagement: 'self_management', actualAction: 'actual_action',
  response: 'response', reviewPendingReason: 'follow_up',
};

export const WOUND_CARE_TEMPLATE_FIELDS: FieldAssignments = {
  basisReason: 'medical_basis', professionalBasis: 'professional_basis', changeReason: 'plan_change',
  personDecision: 'person_decision', qualificationBasis: 'qualification', goal: 'goal', plannedCare: 'planned_care',
  plannedMaterials: 'planned_material', frequency: 'interval', hygienePlan: 'hygiene_plan', painPlan: 'pain_plan',
  warningSigns: 'warning_signs', escalationPath: 'escalation', actualCleaning: 'cleaning_done',
  actualTechnique: 'technique_done', hygiene: 'hygiene_done', noMaterialReason: 'no_material',
  painBeforeReason: 'pain_unavailable', painAfterReason: 'pain_unavailable', response: 'response',
  deviation: 'deviation', contact: 'contact', reviewPendingReason: 'follow_up',
};

export const WOUND_CORRECTION_TEMPLATE_FIELDS = {
  correctedStatement: 'correction_statement', reason: 'correction_reason', evidenceBasis: 'evidence',
  clinicalImpact: 'clinical_impact', communication: 'contact', personDecision: 'person_decision',
} as const satisfies FieldAssignments;

export const WOUND_ENTRY_TEMPLATE_FIELDS: Readonly<Record<string, FieldAssignments>> = {
  note: { description: 'description', treatment: 'actual_action' },
  risk: { assessment: 'pressure_risk', plan: 'pressure_prevention' },
  anamnesis: {
    general: 'general_status', nutrition: 'nutrition', psychosocial: 'psychosocial',
    diagnoses: 'diagnoses', effects: 'influences', notes: 'notes',
  },
  diabetic_foot: {
    history: 'foot_history', findings: 'foot_exam', neurology: 'foot_neurology',
    angiology: 'foot_vascular', footwear: 'foot_shoes', assessment: 'foot_summary',
  },
  tracheostomy: {
    stoma: 'tracheo_stoma', device: 'tracheo_device', secretion: 'tracheo_breathing',
    care: 'tracheo_care', training: 'tracheo_training', participants: 'training_participants', followUp: 'tracheo_follow_up',
  },
};

export function isWoundTemplateField(value: string): value is WoundTemplateField {
  return Object.hasOwn(WOUND_TEMPLATE_FIELDS, value);
}

export const DEFAULT_WOUND_SNIPPETS = Object.entries(WOUND_TEMPLATE_FIELDS).flatMap(([key, field]) =>
  field.snippets.map(([suffix, name, text]) => ({
    id: `${key}-${suffix}`,
    kind: field.kind,
    name,
    text,
    field: key as WoundTemplateField,
  })));

// Textvorlagen verwenden das vorhandene Katalogkennzeichen für Feld und Standardvorlage.
// Artikel behalten darin ihre Artikelnummer. Alteinträge ohne Kennzeichen bleiben allgemein verfügbar.
const TEMPLATE_CODE = /^t1\/([a-z_]+|-)\/([a-z0-9_-]+|-)$/;

export function woundTemplateCode(field: WoundTemplateField | null, standardId?: string) {
  return `t1/${field ?? '-'}/${standardId ?? '-'}`;
}

export function readWoundTemplateCode(code: string) {
  const encoded = TEMPLATE_CODE.exec(code);
  if (!encoded) return null;
  return {
    field: isWoundTemplateField(encoded[1]) ? encoded[1] : null,
    standardId: encoded[2] === '-' ? undefined : encoded[2],
  };
}

export function woundTemplateMatches(fields: readonly string[], search: string) {
  const normalize = (value: string) => value.toLocaleLowerCase('de').normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/ß/g, 'ss');
  const tokens = normalize(search).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const text = normalize(fields.join(' '));
  return tokens.every(token => text.includes(token));
}
