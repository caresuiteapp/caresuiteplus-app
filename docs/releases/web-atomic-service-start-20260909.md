# Web-Einsatzstart: gemeinsame Speicherung von Status und Startzeit

Die Nutzeraufnahme zeigt nach dem Startversuch einen langen Ladezustand und danach einen pauschalen Datenbankfehler. Die lesende Serverdiagnose bestätigt einen angekommenen Einsatz ohne Startzeit und ohne service_start-Ereignis. Der genaue ursprüngliche Datenbankfehler lässt sich aus den vorhandenen Protokollen nicht nachweisen; die bisherige Fehlerkette entfernt die technischen Fehlercodes.

Der Web-Start verwendet jetzt eine zusätzliche Datenbankfunktion, die den konkreten Einsatz sperrt, Berechtigung und Ablauf prüft und Status sowie Startzeit in einer Transaktion speichert. Wiederholungen verwenden den bereits gespeicherten Start. Die Antwort enthält die tatsächliche Startzeit und Zeitereignisse für den Timer. Zusätzliche Detailabfragen, ältere Client-Synchronisierungen und nachgelagerte WFM-Anzeigen halten den Startknopf nicht mehr auf.

Die Funktion läuft mit SECURITY INVOKER unter bestehenden RLS-Regeln. Sie verlangt eine passende Anmeldung, Mandanten- und Mitarbeitendenzuordnung; abgeschlossene, pausierte und gesperrte Einsätze bleiben geschützt. Abweichungen von mehr als zehn gerundeten Minuten erfordern eine Begründung. Vergangene fehlende Zeiten werden nicht aus Planzeiten oder dem aktuellen Zeitpunkt rekonstruiert. Die vorhandene Android-Startimplementierung wird nicht geändert.

Die Migration ergänzt ausschließlich die neue Funktion und ihre Ausführungsrechte. Sie verändert beim Einspielen keine Einsatz-, Zeit-, GPS- oder Unterschriftsdaten. Funktion vor dem Web-Deployment bereitstellen. Bei einem Rollback darf die zusätzliche Funktion installiert bleiben.

Gemäß Nutzerauftrag keine automatisierten Tests, kein Lint/Typecheck und keine Browser-QA. Nur notwendiger Expo-Web-Build und Bereitstellungsstatus. Die Bedienprüfung und ein echter Mitarbeitendenstart erfolgen nach Bereitstellung durch den Nutzer.
