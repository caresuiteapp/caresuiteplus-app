# Offene Zeiten beim Monatsabschluss

Die Office-Gehaltsstatistik rechnet nur abgeschlossene und freigegebene Zeiterfassungen ein. Offene, unvollständige, abgelehnte und ungeprüfte Zeilen werden als „Zurückgestellt“ gezeigt. Sie blockieren die Veröffentlichung der übrigen geprüften Monatsdaten nicht. Fehlende Vergütungsdaten, unklare bezahlte Abwesenheiten und andere strukturelle Berechnungsfehler bleiben Sperrgründe.

## Nachberechnung

Die Veröffentlichung speichert die zurückgestellten Quellen im unveränderlichen Monats-Snapshot (`deferredTimeEntries`). Der ursprüngliche Arbeitstag, die ursprüngliche Zeilenkennung und die Zuordnung zum Einsatz bleiben erhalten. Die Veröffentlichung verändert weder Arbeitszeiterfassungen noch deren Freigabe. Mitarbeitende bearbeiten ihre offenen Einsätze weiterhin im bestehenden Portal; die vorhandene Zeitprüfung bleibt erforderlich.

In einem späteren Monat werden noch nicht berücksichtigte Quellen erneut aus dem WFM gelesen. Erst ein gültiger Abschluss mit `approved`, `exported` oder `locked` macht die tatsächlichen Minuten zur Nachberechnung verfügbar. Geplante Dauer wird nicht ersatzweise vergütet. Für geplante Platzhalter ohne Erfassungskennung wird nur eine eindeutig zuordenbare spätere Erfassung desselben Einsatzes und Arbeitstags übernommen. Mehrdeutige Zuordnungen bleiben offen.

`currentPeriodWorkMinutes` enthält die freigegebene Zeit des gewählten Monats. `catchUpWorkMinutes` und `catchUpTimeEntries` weisen Nachberechnungen gesondert aus; zusammen ergeben sie `actualWorkMinutes` der Abrechnung. Die hinterlegte aktuelle Vergütung und Auszahlungsgrenze gelten auch für die nachberechneten Minuten. Dies ist keine historische Vergütungsneuberechnung oder steuerliche Lohnabrechnung. Dokumentierte, nach der Firmenregel nicht anrechenbare Fahrzeit wird nicht nachvergütet.

## Schutz vor mehrfacher Anrechnung

Alle veröffentlichten Versionen einschließlich ersetzter Versionen bilden den Nachweis. Der Schlüssel aus Ursprungsmonat und ursprünglicher Zeilenkennung darf nur in einem späteren Abrechnungsmonat berücksichtigt werden. Die tatsächlich verwendete Quellenkennung verhindert eine zweite Anrechnung über einen anderen Platzhalter. Eine neue Version des Ursprungsmonats schließt bereits zurückgestellte Zeiten weiterhin aus. Eine neue Version des Nachberechnungsmonats behält die dort bereits gespeicherten Nachberechnungen mit ihren damaligen Minuten bei.

Der atomare Veröffentlichungs-RPC sperrt konkurrierende Veröffentlichungen derselben Person auch über Monatsgrenzen. Er prüft Herkunft, gespeicherte frühere Berücksichtigungen und Summen. Bestehende Mandantenrechte, RLS, Quellenrevision, PDF-Upload-Nachweis, Versionsschutz und Audit-Transaktion bleiben erhalten. Eine fehlgeschlagene Prüfung speichert weder Monatsversion noch Audit-Eintrag.

## Verifikation

Die vorhandene Payroll-Releaseprüfung deckt das Überspringen, spätere Freigabe, Monats- und Jahreswechsel, ersetzte Versionen, mehrdeutige Quellen, unveränderte Wiederholungen und doppelte Nachberechnungsversuche ab. Der SQL-Ablauf wird mit den produktiven Funktionen, Rechten und Triggern in einer isolierten PGlite-Datenbank geprüft. Tests veröffentlichen keine echten Mitarbeiterabrechnungen. PDF-Ausgaben mit Nachberechnung und Zurückstellung wurden gerendert und visuell geprüft. Für die angemeldete Oberfläche liegt keine Live-Browserprüfung vor; die verfügbaren Interaktionstests berechnen kein Layout.
