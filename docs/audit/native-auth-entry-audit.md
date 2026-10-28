# Native Zugänge, Anmeldung und Start

Die Inventur verknüpft 28 tatsächlich ausgewählte Android-Einstiege mit Empfängern und kontrollierten Funktionsbelegen. Sie enthält die drei Portalzugänge, Aliasrouten, Registrierung, Passwortsetup/-wiederherstellung, Geräteanmeldung und den älteren Onboarding-Einstieg. Die maschinenlesbare Einzelmatrix steht in `native-auth-entry-audit.json`.

## Belegte Korrekturen

- Verwaltungs-, Mitarbeitenden- und Klientenlogin: Späte Antworten können nach Unmount/Fokusverlust keine weiteren lokalen Portalinstallations-/Weiterleitungsschritte auslösen. Ein synchroner Lock verhindert doppelte Aktivierungen; Passwörter/Codes werden bei Fokusverlust entfernt. Sieben neue Portal- und zwei zusätzliche Verwaltungs-Fokusfälle scheiterten vor der jeweiligen Korrektur.
- QR-Handyfreigabe: Zustimmung ist an Challenge und Konto/Sitzung gebunden. Challenge-/Kontowechsel bricht den laufenden Request ab und verwirft dessen späte Antwort. Ein unmittelbarer Lock verhindert doppelte Entscheidungen. Vier von fünf neuen Fällen scheiterten vor der Korrektur.
- Keine Aussage, dass ein lokaler Abbruch einen bereits gestarteten SDK- oder serverseitig angenommenen Vorgang rückgängig macht.

## Ausgeführte Prüfung

Der bisherige Auth-Gesamtblock bestand mit 587 Tests bereits vor diesen Ergänzungen; er enthielt die neuen Rennen nicht. Nach der Korrektur bestehen 100 gezielte Fälle: Registrierung/Login-Lifecycle, bisheriger nativer Registrierungsharness, QR-Entscheidung und die nativen/Web-Intro-Fälle. Diese Mengen überlappen andere Läufe und werden nicht zu einer Gesamtabnahmesumme addiert. Der breite Schlusslauf nach allen Auth-Korrekturen besteht mit 665 Fällen (Auth-Verzeichnis und beide Intro-Suiten, ein Worker).

## Offene Abnahme

Kein tatsächlicher Android-Geräte-, Tastatur-, Bild- oder produktiver Auth-/Mail-/QR-Nachweis. Für die erfassten Seiten wird daher keine visuelle oder vollständige Freigabe erteilt. Der frühere gemeinsame Web-Registrierungs-/Konsolenharness `desktopCompanyFlows` bricht vor Tests wegen transitiver Expo-Initialisierung im aktualisierten Dossierimport ab; dies ist separat vom Auth-Produktcode zu behandeln. Der Release-Build bleibt angehalten.

Die breite Nachprüfung nach Portal-/QR-Korrektur bestand mit 663 Fällen. Zwei danach ergänzte Verwaltungs-Fokusfälle scheiterten vor dem letzten engen Fix und bestehen im anschließenden 38-Fälle-Block. Der breite Schlusslauf nach dieser letzten Korrektur besteht mit 665/665 Fällen.

Der native QR-Empfänger wurde anschließend durch den zentralen Generator aktualisiert; die Scope-/Consent-Korrektur ist im tatsächlichen Android-Quellpfad vorhanden. Dies ist ein Quell-/Vertragsbeleg, kein Gerätebeleg.
