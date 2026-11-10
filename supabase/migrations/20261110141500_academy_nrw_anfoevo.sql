-- The NRW course uses the existing Academy permissions and immutable versions.
BEGIN;

CREATE FUNCTION academy_private.nrw_course_id(tenant uuid) RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT md5('caresuite:academy:anfoevo-nrw:v1:' || tenant::text)::uuid
$$;

CREATE FUNCTION academy_private.nrw_content() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $function$
 SELECT $content$
{
  "title": "Schulung Nordrhein-Westfalen (AnFöVO)",
  "summary": "Alltagsbegleitung in acht Modulen mit 40 Unterrichtseinheiten à 45 Minuten, bebilderten Praxisfällen, Fallübungen und Abschlussprüfung. Die praktische Notfallschulung oder der anerkannte Erste-Hilfe-Nachweis wird separat geprüft.",
  "category": "Alltagsbegleitung NRW",
  "audiences": [
    "employee"
  ],
  "estimatedMinutes": 1800,
  "mandatory": true,
  "passPercent": 75,
  "maxAttempts": 1,
  "lessons": [
    {
      "id": "nrw-01-ue1",
      "title": "Die Rolle der Alltagsbegleitung",
      "kind": "text",
      "body": "UE 01 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Mertens möchte zum Markt, ihr Sohn wünscht eine gründliche Reinigung. Der Einsatzplan sieht 90 Minuten Begleitung vor.\n\n10 Min. · Einordnung\nDie betreute Person entscheidet mit. Maßgeblich sind ihre Wünsche, der vereinbarte Leistungsrahmen und die tatsächliche Sicherheit. Angehörige können Anregungen geben. Prüfen Sie, wer bei Bedarf vertretungsberechtigt ist. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSpielen Sie beide Gespräche durch. Klären Sie mit Frau Mertens, wie viel Zeit für Markt, Rückweg und gewünschte Haushaltsaufgaben bleibt. Formulieren Sie eine Rückmeldung an den Sohn mit ihrer Zustimmung. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nVereinbart sind Markt und Rückweg. Eine zusätzliche Reinigung wird beim nächsten Termin besprochen. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-01-ue2",
      "title": "Angebote und Zuständigkeiten",
      "kind": "text",
      "body": "UE 02 · 45 Minuten\n\n5 Min. · Einstieg\nHerr Bartels fragt, ob seine Unterstützung über seine Pflegekasse bezahlt wird.\n\n10 Min. · Einordnung\n§ 45a SGB XI beschreibt Angebote zur Unterstützung im Alltag. § 45b regelt den Entlastungsbetrag. Das Land regelt die Anerkennung der Angebote. Die konkrete Finanzierung klären Pflegekasse oder Beratung anhand der persönlichen Voraussetzungen. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nOrdnen Sie drei Fragen den Zuständigen zu: Kann eine Leistung angeboten werden, ist das Angebot anerkannt, kann die Rechnung erstattet werden? Formulieren Sie eine Antwort ohne Zusage zur Kostenerstattung. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nDer Anbieter klärt sein Angebot, die zuständige Stelle die Anerkennung und die Pflegekasse die Erstattung im Einzelfall. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-01-ue3",
      "title": "Auftrag und Grenzen",
      "kind": "text",
      "body": "UE 03 · 45 Minuten\n\n5 Min. · Einstieg\nEine Nachbarin bittet Sie, Herrn Bartels die Tabletten für die Woche zu richten.\n\n10 Min. · Einordnung\nEin klarer Auftrag schützt alle Beteiligten. Medizinische Maßnahmen gehören in die Verantwortung der dafür zuständigen Fachpersonen. Prüfen Sie bei Anfragen außerhalb Ihres Auftrags den vereinbarten Meldeweg. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nÜben Sie eine freundliche Ablehnung. Finden Sie eine sofort mögliche Unterstützung und notieren Sie, welche Stelle die Medikamentenfrage übernimmt. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nSie können auf Wunsch den Kontakt zur zuständigen Fachperson herstellen und die Anfrage sachlich weitergeben. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-01-ue4",
      "title": "Vertraulichkeit im Alltag",
      "kind": "text",
      "body": "UE 04 · 45 Minuten\n\n5 Min. · Einstieg\nIn der Bäckerei fragt jemand, warum Ihre Klientin begleitet wird.\n\n10 Min. · Einordnung\nInformationen zur Gesundheit und Betreuung bleiben im autorisierten Kreis. Besprechen Sie sensible Angaben diskret und dokumentieren Sie sie in den vorgesehenen Systemen. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nEntwerfen Sie Antworten für die Bäckerei, einen nicht bevollmächtigten Anrufer und eine berechtigte Kollegin. Markieren Sie jeweils, welche Information zur Aufgabe gehört. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nIn der Bäckerei genügt eine höfliche, allgemeine Antwort. Die Kollegin erhält auf dem vorgesehenen Weg die für ihre Aufgabe nötige Information. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-01-ue5",
      "title": "Beobachten und festhalten",
      "kind": "text",
      "body": "UE 05 · 45 Minuten\n\n5 Min. · Einstieg\nHeute hat Herr Yilmaz den Spaziergang nach wenigen Minuten beendet.\n\n10 Min. · Einordnung\nBeobachtung, Aussage und Schlussfolgerung gehören auseinander. Erfassen Sie Zeit, Situation, Wunsch, Maßnahme und gegebenenfalls die Übergabe. Diagnosen treffen die dafür zuständigen Fachpersonen. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSchreiben Sie eine kurze Doku zu dem Fall. Überarbeiten Sie die Formulierung »war heute wieder schwierig« so, dass eine Kollegin daraus einen nächsten Schritt ableiten kann. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nBeispiel: Herr Yilmaz bat nach fünf Minuten um eine Pause. Auf seinen Wunsch sind wir nach der Pause zurückgegangen. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-01-case",
      "title": "Marktbesuch oder Haushaltsaufgabe?",
      "kind": "text",
      "body": "Bildbeispiel\nAm Eingang hält Frau Mertens eine Einkaufstasche bereit. Ihr Sohn kommt mit einem Putztuch dazu. Die Begleitung hört Frau Mertens zu.\n\nBeobachtungsfrage\nWer hat welchen Wunsch? Formulieren Sie eine Frage an Frau Mertens, mit der Sie die Reihenfolge gemeinsam klären.\n\nAuflösung\nFragen Sie Frau Mertens, was ihr heute wichtig ist. Prüfen Sie gemeinsam den vereinbarten Auftrag und die verfügbare Zeit. Mit ihrer Zustimmung können Sie dem Sohn sagen, was vereinbart wurde."
    },
    {
      "id": "nrw-01-check",
      "title": "Wissenscheck · Grundlagen und Begriffe",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-01-check-q1",
          "prompt": "Wer bestimmt zwischen zwei sicheren und vereinbarten Tätigkeiten?",
          "options": [
            {
              "id": "b166cea75bdf",
              "text": "Die Nachbarin legt den Ablauf fest."
            },
            {
              "id": "ac00c4d9cd29",
              "text": "Die Reihenfolge steht grundsätzlich fest."
            },
            {
              "id": "ef8d88e15750",
              "text": "Die begleitete Person entscheidet mit."
            }
          ],
          "correctOptionId": "ef8d88e15750"
        },
        {
          "id": "nrw-01-check-q2",
          "prompt": "An wen geht eine konkrete Frage zur Erstattung?",
          "options": [
            {
              "id": "0dc9b9710a5f",
              "text": "An den Fahrdienst."
            },
            {
              "id": "3241aa7962f0",
              "text": "An die Pflegekasse oder geeignete Beratung."
            },
            {
              "id": "751024989002",
              "text": "An beliebige Angehörige."
            }
          ],
          "correctOptionId": "3241aa7962f0"
        },
        {
          "id": "nrw-01-check-q3",
          "prompt": "Was gehört in die Verlaufsdokumentation?",
          "options": [
            {
              "id": "5f77a8b90919",
              "text": "Beobachtung, Handlung und notwendige Weitergabe."
            },
            {
              "id": "e1438fc6bf53",
              "text": "Eine Vermutung als Diagnose."
            },
            {
              "id": "675c139ca6a1",
              "text": "Eine wertende Beschreibung der Person."
            }
          ],
          "correctOptionId": "5f77a8b90919"
        }
      ]
    },
    {
      "id": "nrw-02-ue1",
      "title": "Beziehung aufbauen",
      "kind": "text",
      "body": "UE 06 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Aydin antwortet beim ersten Besuch knapp und bleibt im Flur stehen.\n\n10 Min. · Einordnung\nVorstellen, das Anliegen erklären und um Zustimmung bitten hilft beim Ankommen. Achten Sie auf das Tempo und fragen Sie, wie die Person angesprochen werden möchte. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nFühren Sie ein dreiminütiges Erstgespräch mit zurückhaltender Person. Variieren Sie den Einstieg und besprechen Sie, wie Sie Zustimmung erkennen. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEine klare Vorstellung und eine kleine Auswahl geben der Person Orientierung und Kontrolle. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-02-ue2",
      "title": "Ressourcen erkennen",
      "kind": "text",
      "body": "UE 07 · 45 Minuten\n\n5 Min. · Einstieg\nHerr Kranz braucht Hilfe beim Einkauf. Er kennt die Angebote im Laden sehr gut.\n\n10 Min. · Einordnung\nRessourcen sind Fähigkeiten, Erfahrungen, Interessen, Hilfsmittel und Unterstützung im Umfeld. Eine Aufgabe lässt sich teilen, damit die Person ihren Teil selbst übernimmt. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nZerlegen Sie den Einkauf in Planung, Weg, Auswahl, Bezahlen und Verstauen. Ordnen Sie gemeinsam zu, wo Begleitung hilft. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nHerr Kranz kann zum Beispiel die Auswahl treffen, während die Begleitung die Wege und das Tragen unterstützt. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-02-ue3",
      "title": "Wünsche, Einwilligung und Tagesform",
      "kind": "text",
      "body": "UE 08 · 45 Minuten\n\n5 Min. · Einstieg\nDie sonst beliebte Gartenrunde wird heute abgelehnt.\n\n10 Min. · Einordnung\nEinwilligung gilt für die konkrete Situation und kann geändert werden. Erfragen Sie den Grund ohne Druck. Gehen Sie bei einer möglichen akuten Gefährdung nach dem vereinbarten Notfallweg vor. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nFormulieren Sie je eine Antwort bei Müdigkeit, Regen und geäußertem Schwindel. Legen Sie für jede Antwort den passenden nächsten Schritt fest. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nBei Müdigkeit passt eine ruhige Alternative. Akute Warnzeichen brauchen eine Sicherheitsentscheidung. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-02-ue4",
      "title": "Umfeld und Entlastung",
      "kind": "text",
      "body": "UE 09 · 45 Minuten\n\n5 Min. · Einstieg\nEine Tochter sagt beim Abholen, sie habe seit Tagen kaum geschlafen.\n\n10 Min. · Einordnung\nAngehörige brauchen häufig verlässliche Absprachen und Hinweise auf Beratung. Halten Sie die Wünsche der betreuten Person im Blick und teilen Sie Informationen mit Zustimmung oder auf tragfähiger Grundlage. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie eine Übersicht mit Entlastungswunsch, passender Anlaufstelle und vereinbartem Kontakt. Spielen Sie ein kurzes Gespräch, das beide Seiten einbezieht. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nDie Tochter erhält beispielsweise den Hinweis auf örtliche Pflegeberatung. Ein nächster Kontakt wird gemeinsam vereinbart. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-02-ue5",
      "title": "Einen Besuch planen",
      "kind": "text",
      "body": "UE 10 · 45 Minuten\n\n5 Min. · Einstieg\nZwei Stunden sind angesetzt. Die Person möchte ein Rezept ausprobieren und Post sortieren.\n\n10 Min. · Einordnung\nPlanen Sie mit der Person Ziel, Zeit, Pausen und geeignete Hilfen. Halten Sie einen Spielraum für Tagesform und wichtige Rückmeldungen frei. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie einen Ablauf für 120 Minuten und eine Alternative für einen kürzeren Besuch. Prüfen Sie, welche Aufgaben Zustimmung oder besondere Vorsicht erfordern. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nPlanen Sie einen Einstieg, zwei abgrenzbare Tätigkeiten, eine Pause und eine kurze gemeinsame Rückschau. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-02-case",
      "title": "Wer wählt die Äpfel aus?",
      "kind": "text",
      "body": "Bildbeispiel\nEin älterer Mann vergleicht Äpfel. Die Begleitung hält einen Beutel offen. Auf der Theke liegt die Einkaufsliste.\n\nBeobachtungsfrage\nWelche Entscheidung kann der Mann selbst treffen? Welche kleine Hilfe macht den Einkauf leichter?\n\nAuflösung\nDer Mann wählt die Äpfel. Die Begleitung hält nach Absprache den Beutel und unterstützt dort, wo der Mann Hilfe wünscht."
    },
    {
      "id": "nrw-02-check",
      "title": "Wissenscheck · Grundlagen der Betreuungsarbeit",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-02-check-q1",
          "prompt": "Was stärkt vorhandene Fähigkeiten?",
          "options": [
            {
              "id": "e118049fb200",
              "text": "Alle Entscheidungen werden abgenommen."
            },
            {
              "id": "717e31a45a44",
              "text": "Hilfsmittel bleiben weg, damit es schneller geht."
            },
            {
              "id": "689a26d7f28f",
              "text": "Die Person übernimmt passende Teile der Aufgabe."
            }
          ],
          "correctOptionId": "689a26d7f28f"
        },
        {
          "id": "nrw-02-check-q2",
          "prompt": "Wie reagieren Sie auf die Ablehnung eines Spaziergangs?",
          "options": [
            {
              "id": "a2f8e3cffe7f",
              "text": "Den Angehörigen um eine Erlaubnis gegen den Wunsch bitten."
            },
            {
              "id": "6a084ee9cd3e",
              "text": "Die Entscheidung respektieren und eine Alternative anbieten."
            },
            {
              "id": "63f87fc8f368",
              "text": "Auf der ursprünglichen Planung bestehen."
            }
          ],
          "correctOptionId": "6a084ee9cd3e"
        },
        {
          "id": "nrw-02-check-q3",
          "prompt": "Worauf achten Sie bei einer Besuchsplanung?",
          "options": [
            {
              "id": "1cd8fca1ef18",
              "text": "Auf Wünsche, sichere Schritte, Pausen und Spielraum."
            },
            {
              "id": "1a766bc32e73",
              "text": "Nur auf die Zahl abgehakter Tätigkeiten."
            },
            {
              "id": "9b4bb12439bf",
              "text": "Auf die unveränderte Routine der Vorwoche."
            }
          ],
          "correctOptionId": "1cd8fca1ef18"
        }
      ]
    },
    {
      "id": "nrw-03-ue1",
      "title": "Einsatzort sichern",
      "kind": "text",
      "body": "UE 11 · 45 Minuten\n\n5 Min. · Einstieg\nIm Flur liegt nach einem Sturz eine Person, daneben steht ein beschädigtes Elektrogerät.\n\n10 Min. · Einordnung\nBeurteilen Sie zuerst, ob Sie sich sicher nähern können. Holen Sie Hilfe. Bei akuter Gefahr oder einem schweren Notfall wählen Sie 112 und befolgen die Anweisungen der Leitstelle. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nÜben Sie die ersten Handlungen anhand des Beispiels. Markieren Sie Gefahren, einen Zugang für Rettungskräfte und Personen, die Sie gezielt um Hilfe bitten können. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nDie eigene Sicherheit steht am Anfang. Ortsangabe und freie Zufahrt können für die Rettung entscheidend sein. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-03-ue2",
      "title": "Den Notruf absetzen",
      "kind": "text",
      "body": "UE 12 · 45 Minuten\n\n5 Min. · Einstieg\nEine Person ist plötzlich nicht ansprechbar. Der Einsatz ist in einem Mehrfamilienhaus.\n\n10 Min. · Einordnung\nNennen Sie der Leitstelle zuerst den genauen Ort und beschreiben Sie, was passiert ist. Antworten Sie auf Rückfragen und folgen Sie den Anweisungen. Nutzen Sie, soweit möglich, den Lautsprecher. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSimulieren Sie einen Notruf mit Etage, Klingel und Zugang. Wechseln Sie die Rollen und prüfen Sie, ob die Einsatzkräfte den Ort schnell finden würden. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nDas Team kann später informiert werden. Der Notruf hat bei akuter Gefahr Vorrang. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-03-ue3",
      "title": "Bewusstsein und Atmung",
      "kind": "text",
      "body": "UE 13 · 45 Minuten\n\n5 Min. · Einstieg\nHerr Kranz reagiert weder auf Ansprache noch auf vorsichtiges Berühren an der Schulter.\n\n10 Min. · Einordnung\nRufen Sie um Hilfe und prüfen Sie nach Erste-Hilfe-Standard die Atmung. Bei fehlender normaler Atmung alarmieren Sie 112 und beginnen unverzüglich mit Wiederbelebung nach Leitstellenanweisung. Bei Bewusstlosigkeit mit normaler Atmung sorgen Sie für stabile Seitenlage, Notruf und fortlaufende Kontrolle. Üben Sie das praktisch unter Anleitung. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nOrdnen Sie für normale und fehlende normale Atmung jeweils die Handlungen. Besprechen Sie, wie eine zweite Person einen AED bringen und den Rettungsdienst einweisen kann. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nDie Unterscheidung normaler Atmung ist wichtig. Lernen Sie die Handgriffe in der praktischen Schulung. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-03-ue4",
      "title": "Akute Veränderungen erkennen",
      "kind": "text",
      "body": "UE 14 · 45 Minuten\n\n5 Min. · Einstieg\nEine Person spricht plötzlich undeutlich und kann einen Arm nicht wie gewohnt heben.\n\n10 Min. · Einordnung\nPlötzliche deutliche Sprachstörung oder einseitige Schwäche sind Warnzeichen. Alarmieren Sie bei diesem Verdacht sofort 112. Teilen Sie den beobachteten Beginn mit und bleiben Sie nach Möglichkeit bei der Person. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nEntwerfen Sie eine knappe Übergabe mit Uhrzeit, Beobachtung und Hilfe. Besprechen Sie, welche Maßnahmen die Leitstelle anleiten würde. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEine konkrete Beobachtung mit Zeitpunkt hilft. Eigene Diagnosen und Verzögerungen durch Rückfragen im Büro vermeiden Sie. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-03-ue5",
      "title": "Nach einem Notfall übergeben",
      "kind": "text",
      "body": "UE 15 · 45 Minuten\n\n5 Min. · Einstieg\nDer Rettungsdienst hat übernommen. Sie sind aufgeregt und wissen, dass die Verwaltung eine Rückmeldung braucht.\n\n10 Min. · Einordnung\nNach der unmittelbaren Hilfe dokumentieren Sie sachlich Zeit, Beobachtungen, Notruf, Maßnahmen und Übergabe. Nutzen Sie die Meldekette. Wenn nötig, bitten Sie um ein Nachgespräch. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nFüllen Sie eine fiktive Einsatzchronik aus. Prüfen Sie, welche Information medizinisches Personal, Verwaltung und Angehörige auf dem vorgesehenen Weg brauchen. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nErfassen Sie Fakten und den Empfänger der Übergabe. Persönliche Belastung kann in einem geschützten Gespräch aufgefangen werden. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-03-case",
      "title": "Für den Notruf vorbereitet",
      "kind": "text",
      "body": "Bildbeispiel\nIm Wohnungsflur liegen ein Telefon, ein Kontaktzettel und Schlüssel griffbereit. Der Eingang ist frei.\n\nBeobachtungsfrage\nWelche Angaben können Sie beim Notruf in diesem Haus schnell nennen? Was sollte an der Kontaktkarte ergänzt werden?\n\nAuflösung\nMerken Sie sich Anschrift, Etage, Klingel und einen erreichbaren Zugang. Im Ernstfall nennen Sie der 112 den Ort und beschreiben die Beobachtung. Die Leitstelle leitet Sie an."
    },
    {
      "id": "nrw-03-check",
      "title": "Wissenscheck · Grund- und Notfallwissen",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-03-check-q1",
          "prompt": "Was tun Sie bei Bewusstlosigkeit und fehlender normaler Atmung?",
          "options": [
            {
              "id": "7150e106c0eb",
              "text": "Die Person allein lassen, um das Büro anzurufen."
            },
            {
              "id": "832c76e2ec6e",
              "text": "Etwas zu trinken geben."
            },
            {
              "id": "b841499f79a9",
              "text": "112 alarmieren und unverzüglich Wiederbelebung beginnen."
            }
          ],
          "correctOptionId": "b841499f79a9"
        },
        {
          "id": "nrw-03-check-q2",
          "prompt": "Was ist für den Notruf besonders wichtig?",
          "options": [
            {
              "id": "ccbba4d1a375",
              "text": "Vor dem Anruf die interne Erlaubnis einholen."
            },
            {
              "id": "ab3bf9a048d0",
              "text": "Genauer Ort, Beobachtung und Rückfragen abwarten."
            },
            {
              "id": "d42fe7e6801d",
              "text": "Zuerst die vollständige Vorgeschichte vortragen."
            }
          ],
          "correctOptionId": "ab3bf9a048d0"
        },
        {
          "id": "nrw-03-check-q3",
          "prompt": "Plötzlich treten Sprachstörung und einseitige Schwäche auf. Wie handeln Sie?",
          "options": [
            {
              "id": "eb9881e7dce2",
              "text": "Sofort 112 rufen und den beobachteten Beginn mitteilen."
            },
            {
              "id": "8531a562fb0e",
              "text": "Bis zum nächsten Besuch beobachten."
            },
            {
              "id": "c62352326d82",
              "text": "Mit einem Spaziergang prüfen, ob es besser wird."
            }
          ],
          "correctOptionId": "eb9881e7dce2"
        }
      ]
    },
    {
      "id": "nrw-04-ue1",
      "title": "Demenz und Orientierung",
      "kind": "text",
      "body": "UE 16 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Lenz fragt nach ihrer Mutter. Die Antwort »Sie ist gestorben« erschreckt sie wiederholt.\n\n10 Min. · Einordnung\nErleben und Orientierung können sich verändern. Sprechen Sie ruhig, greifen Sie Gefühle auf und bieten Sie vertraute Orientierungshilfen an. Neue, plötzliche Veränderungen gehören abgeklärt. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nÜben Sie drei Antworten mit Gefühlsbezug, Orientierung und einer freiwilligen Aktivität. Tauschen Sie aus, wie Reaktionen beobachtet werden können. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEine Antwort kann lauten: »Sie vermissen Ihre Mutter gerade. Möchten Sie mir von ihr erzählen?« Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-04-ue2",
      "title": "Mobilität und Parkinson",
      "kind": "text",
      "body": "UE 17 · 45 Minuten\n\n5 Min. · Einstieg\nBeim Gehen stockt Herr Rothe am Türrahmen. Er nutzt ein Hilfsmittel.\n\n10 Min. · Einordnung\nGeben Sie Zeit und Platz. Klären Sie mit Person und Fachteam, welche Hinweise oder Hilfen erprobt sind. Ziehen und eigenständige Transfers können die Sicherheit verschlechtern. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nPrüfen Sie eine fiktive Wohnung auf Engstellen und Stolperstellen. Entwerfen Sie eine Frage zu gewohnten Hilfen und eine kurze Übergabenotiz. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nSichern Sie den Bereich, bieten Sie vereinbarte Unterstützung an und teilen Sie wiederkehrende Schwierigkeiten mit. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-04-ue3",
      "title": "Sehen und Hören",
      "kind": "text",
      "body": "UE 18 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Brandt antwortet oft mit »ja«, obwohl sie die Frage nicht gehört hat.\n\n10 Min. · Einordnung\nGute Beleuchtung, wenig Hintergrundgeräusch, Blickkontakt und sichtbares Sprechen erleichtern Verständigung. Fragen Sie, welche Hilfe die Person bevorzugt. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nVerändern Sie eine kurze Gesprächsszene in drei Schritten. Verwenden Sie am Ende eine offene Verständnisfrage, ohne die Person zu prüfen. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEin leiser Raum und die Frage »Wie möchten Sie vorgehen?« geben Gelegenheit zur Rückmeldung. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-04-ue4",
      "title": "Psychische Belastung und Rückzug",
      "kind": "text",
      "body": "UE 19 · 45 Minuten\n\n5 Min. · Einstieg\nHerr Yilmaz sagt mehrere Besuche ab und erwähnt, alles sei ihm zu viel.\n\n10 Min. · Einordnung\nRückzug hat verschiedene Ursachen. Nehmen Sie die Aussage ernst, bieten Sie ein kurzes Gespräch an und klären Sie mit Zustimmung geeignete Hilfe. Bei akuter Selbst- oder Fremdgefährdung ist der Notfallweg nötig. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nFormulieren Sie einen ruhigen Gesprächseinstieg. Unterscheiden Sie planbare Rücksprache, zeitnahe fachliche Abklärung und akute Gefährdung. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nBieten Sie einen konkreten, überschaubaren nächsten Kontakt an und halten Sie die beobachtete Veränderung fest. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-04-ue5",
      "title": "Veränderungen einordnen",
      "kind": "text",
      "body": "UE 20 · 45 Minuten\n\n5 Min. · Einstieg\nEine gewohnte Aufgabe fällt plötzlich schwer. Eine Kollegin hat gestern etwas Ähnliches notiert.\n\n10 Min. · Einordnung\nVergleichen Sie mit dem üblichen Zustand und dokumentieren Sie, seit wann und wie häufig sich etwas verändert. Sprechen Sie fachliche Unterstützung an. Akute Warnzeichen brauchen sofortiges Handeln. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie eine Übergabe in vier Sätzen: Ausgangslage, Änderung, Beobachtungszeit und gewünschter nächster Schritt. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEine nützliche Übergabe trennt das beobachtete Ereignis von möglichen Erklärungen. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-04-case",
      "title": "Wenn ein Foto Erinnerungen weckt",
      "kind": "text",
      "body": "Bildbeispiel\nEine ältere Frau betrachtet ein Familienfoto. Ihre Begleitung sitzt auf Augenhöhe und hört zu. Eine Uhr und ein Kalender hängen in Sichtweite.\n\nBeobachtungsfrage\nDie Frau fragt besorgt nach ihrer Mutter. Formulieren Sie eine Antwort, die an das Gefühl anknüpft.\n\nAuflösung\nSie können sagen: »Sie vermissen Ihre Mutter gerade. Möchten Sie mir von ihr erzählen?« Bieten Sie das Foto oder eine Pause an, wenn die Frau das möchte."
    },
    {
      "id": "nrw-04-check",
      "title": "Wissenscheck · Häufige Krankheitsbilder",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-04-check-q1",
          "prompt": "Wie reagieren Sie bei einer wiederholten Frage, die von Sorge begleitet ist?",
          "options": [
            {
              "id": "4b5455d0bdd7",
              "text": "Die Frage als Störung unterbinden."
            },
            {
              "id": "75d4865e5445",
              "text": "Jedes Mal ein Gedächtnistraining daraus machen."
            },
            {
              "id": "0922a1770f14",
              "text": "Ruhig antworten und das Gefühl aufgreifen."
            }
          ],
          "correctOptionId": "0922a1770f14"
        },
        {
          "id": "nrw-04-check-q2",
          "prompt": "Was hilft bei eingeschränktem Hören?",
          "options": [
            {
              "id": "ec5446b0bb5c",
              "text": "Sich zur Tür drehen und aus der Ferne rufen."
            },
            {
              "id": "704447becca2",
              "text": "Blickkontakt, wenig Hintergrundlärm und klare kurze Sätze."
            },
            {
              "id": "ac18a6ea5e90",
              "text": "Immer lauter und schneller sprechen."
            }
          ],
          "correctOptionId": "704447becca2"
        },
        {
          "id": "nrw-04-check-q3",
          "prompt": "Was tun bei einer neuen deutlichen Veränderung?",
          "options": [
            {
              "id": "2ea8d709075a",
              "text": "Beobachtung festhalten und passend zur Dringlichkeit Hilfe veranlassen."
            },
            {
              "id": "6c73d9336abb",
              "text": "Sie grundsätzlich dem Alter zuschreiben."
            },
            {
              "id": "e3f2edd8a6c0",
              "text": "Bis zum Ende der Woche auf weitere Zeichen warten."
            }
          ],
          "correctOptionId": "2ea8d709075a"
        }
      ]
    },
    {
      "id": "nrw-05-ue1",
      "title": "Zuhören und nachfragen",
      "kind": "text",
      "body": "UE 21 · 45 Minuten\n\n5 Min. · Einstieg\n»Sie kommen immer zu spät«, sagt eine betreute Person am Beginn des Besuchs.\n\n10 Min. · Einordnung\nGeben Sie Gehörtem Raum. Klären Sie, worauf sich der Vorwurf bezieht. Eine kurze Zusammenfassung und eine konkrete Vereinbarung helfen mehr als eine lange Rechtfertigung. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSpielen Sie das Gespräch mit und ohne Rückfrage. Prüfen Sie, ob Uhrzeit, Erwartung und nächster Termin für beide Seiten eindeutig sind. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\n»Sie haben seit 14 Uhr auf mich gewartet. Welche Zeit wurde Ihnen genannt? Ich prüfe die Absprache.« Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-05-ue2",
      "title": "Körpersprache und Abstand",
      "kind": "text",
      "body": "UE 22 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Lenz weicht zurück, als Sie ihren Arm berühren wollen.\n\n10 Min. · Einordnung\nKörpersignale sind Hinweise. Schaffen Sie Abstand, kündigen Sie Schritte an und bitten Sie vor einer Berührung um Erlaubnis. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nÜben Sie eine Ansage vor einer Hilfestellung. Spielen Sie mit einem klaren Nein, einem Zögern und einem Ja drei Reaktionen durch. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nBei Zögern halten Sie inne und klären den Wunsch. Die Person kann Berührung ablehnen. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-05-ue3",
      "title": "Konflikte entschärfen",
      "kind": "text",
      "body": "UE 23 · 45 Minuten\n\n5 Min. · Einstieg\nIm engen Flur wird Herr Klee laut und sagt, alle sollen gehen.\n\n10 Min. · Einordnung\nSprechen Sie leise, halten Sie Abstand und einen freien Ausgang. Bieten Sie eine Pause an. Ziehen Sie sich bei Gefahr zurück und alarmieren Sie nach Lage Hilfe. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nEntwerfen Sie einen Satz zur Entlastung, einen zur eigenen Grenze und einen klaren Abbruch. Besprechen Sie, ab wann das Team oder 112 eingebunden wird. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\n»Ich gehe einen Schritt zurück. Wir können das Gespräch später fortsetzen.« Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-05-ue4",
      "title": "Sicher im Team übergeben",
      "kind": "text",
      "body": "UE 24 · 45 Minuten\n\n5 Min. · Einstieg\nDie Vertretung übernimmt am Montag und kennt die Person noch nicht.\n\n10 Min. · Einordnung\nEine Übergabe enthält den vereinbarten Auftrag, aktuelle Beobachtungen, gewünschte Hilfen und einen nächsten Schritt. Beschränken Sie sich auf notwendige Informationen und sichere Kanäle. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSchreiben Sie eine Übergabe für den Montag. Streichen Sie private Details, die für den Einsatz ohne Bedeutung sind. Lesen Sie sie in höchstens 45 Sekunden vor. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nErfassen Sie zum Beispiel eine neue Klingelvereinbarung und die bestätigte Startzeit. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-05-ue5",
      "title": "Mit Fachstellen zusammenarbeiten",
      "kind": "text",
      "body": "UE 25 · 45 Minuten\n\n5 Min. · Einstieg\nEine Person meldet ein Versorgungsproblem, das Ihren vereinbarten Auftrag übersteigt.\n\n10 Min. · Einordnung\nKlären Sie mit der Person und dem Team, welche zuständige Stelle helfen kann. Dokumentieren Sie die Übergabe, vereinbaren Sie eine Rückmeldung und beachten Sie bei Gefahr die Notfallkette. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie eine Kontaktkarte für Fachleitung, Pflegeberatung und Notfall. Üben Sie zwei kurze, datensparsame Übergaben. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nZuständigkeit, Dringlichkeit und vereinbarte Rückmeldung sind klar voneinander getrennt. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-05-case",
      "title": "Ein Gespräch über die Wartezeit",
      "kind": "text",
      "body": "Bildbeispiel\nDer Klient zeigt auf die Uhr. Die Begleitung sitzt mit Abstand und offenen Händen. Der Weg zur Tür ist frei.\n\nBeobachtungsfrage\nWas erkennen Sie im Bild? Woran würden Sie überprüfen, ob der Klient tatsächlich verärgert ist?\n\nAuflösung\nErfragen Sie die Wartezeit und die vereinbarte Uhrzeit. Eine kurze Rückfrage ist hilfreicher als eine Vermutung über die Stimmung."
    },
    {
      "id": "nrw-05-check",
      "title": "Wissenscheck · Wahrnehmung und Kommunikation",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-05-check-q1",
          "prompt": "Was ist eine hilfreiche Reaktion auf ein Zurückweichen?",
          "options": [
            {
              "id": "0d25db36c1b7",
              "text": "Die Hilfe schneller durchführen."
            },
            {
              "id": "0ee0197b89c5",
              "text": "Das Signal grundsätzlich ignorieren."
            },
            {
              "id": "8a3603bf4227",
              "text": "Innehalten, Abstand lassen und um Zustimmung fragen."
            }
          ],
          "correctOptionId": "8a3603bf4227"
        },
        {
          "id": "nrw-05-check-q2",
          "prompt": "Was hilft bei einem Konflikt im engen Flur?",
          "options": [
            {
              "id": "51abdbaabe84",
              "text": "Die eigene Stimme deutlich anheben."
            },
            {
              "id": "cf9df20696ce",
              "text": "Abstand, ruhiger Ton und ein freier Rückweg."
            },
            {
              "id": "fdbcd74d3f07",
              "text": "Den Ausgang verstellen."
            }
          ],
          "correctOptionId": "cf9df20696ce"
        },
        {
          "id": "nrw-05-check-q3",
          "prompt": "Welche Information gehört in die Übergabe?",
          "options": [
            {
              "id": "9849c06c49d4",
              "text": "Was das Team für die nächste Unterstützung braucht."
            },
            {
              "id": "9ccda58675f7",
              "text": "Sämtliche privaten Gesprächsinhalte."
            },
            {
              "id": "e4fb2d8848bf",
              "text": "Vermutungen über persönliche Absichten."
            }
          ],
          "correctOptionId": "9849c06c49d4"
        }
      ]
    },
    {
      "id": "nrw-06-ue1",
      "title": "Händehygiene im Ablauf",
      "kind": "text",
      "body": "UE 26 · 45 Minuten\n\n5 Min. · Einstieg\nNach dem Müll möchte Herr Yilmaz gemeinsam einen Imbiss vorbereiten.\n\n10 Min. · Einordnung\nWaschen Sie die Hände gründlich vor der Lebensmittelzubereitung und nach Kontakt mit Abfällen, Schmutz oder Toilette. Beachten Sie den Hygienestandard des Anbieters. Handschuhe ersetzen Händehygiene nicht. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSkizzieren Sie einen Arbeitsablauf vom Müll bis zum gedeckten Tisch. Markieren Sie alle Stellen für Händehygiene und einen Wechsel von Tüchern oder Handschuhen. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nTrennen Sie schmutzige und saubere Tätigkeiten, damit Keime nicht über Hände und Flächen übertragen werden. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-06-ue2",
      "title": "Reinigung sicher organisieren",
      "kind": "text",
      "body": "UE 27 · 45 Minuten\n\n5 Min. · Einstieg\nUnter der Spüle stehen mehrere Reiniger, darunter ein unbeschriftetes Gefäß.\n\n10 Min. · Einordnung\nNutzen Sie geeignete, gekennzeichnete Mittel nach Gebrauchshinweis. Reiniger werden nicht gemischt. Klären Sie Zuständigkeit und benötigten Schutz vor Beginn. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nOrdnen Sie sichere Arbeitsschritte für Bad und Küche. Beschreiben Sie, was Sie mit dem unbeschrifteten Gefäß und mit einer unklaren Oberfläche tun. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nUnklare Mittel bleiben stehen. Fragen Sie nach geeigneten Produkten und verwenden Sie frische, getrennte Tücher. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-06-ue3",
      "title": "Lebensmittel und Kühlung",
      "kind": "text",
      "body": "UE 28 · 45 Minuten\n\n5 Min. · Einstieg\nNach dem Einkauf stehen leicht verderbliche Lebensmittel noch auf der Arbeitsplatte.\n\n10 Min. · Einordnung\nKühlbedürftige Ware kommt zügig in die Kühlung. Rohes und verzehrfertiges Essen werden getrennt gelagert und verarbeitet. Beziehen Sie die Person in Entscheidungen ein. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nPlanen Sie das Verstauen eines fiktiven Einkaufs. Markieren Sie Lebensmittel für den Kühlschrank und prüfen Sie, welche Packungshinweise den Ablauf ändern. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nBeachten Sie Packung, Kühlung und saubere Arbeitsflächen. Unklare Lebensmittel besprechen Sie vor der Verwendung. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-06-ue4",
      "title": "Wäsche und persönliche Dinge",
      "kind": "text",
      "body": "UE 29 · 45 Minuten\n\n5 Min. · Einstieg\nDie Wäsche mehrerer Personen liegt auf einem Tisch. Ein Teil ist deutlich verschmutzt.\n\n10 Min. · Einordnung\nTrennen Sie nach Person, Material und Hygieneanforderung. Beachten Sie Pflegeetiketten und die betrieblichen Regeln. Sprechen Sie den Umgang mit empfindlichen oder persönlichen Gegenständen ab. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie einen Sortierplan. Legen Sie fest, wann Arbeitsmittel gewechselt und verschmutzte Kontaktflächen gereinigt werden. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nGetrennte Ablage und ein abgestimmter Ablauf vermeiden Verwechslungen und zusätzliche Verschmutzung. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-06-ue5",
      "title": "Sicher arbeiten und beteiligen",
      "kind": "text",
      "body": "UE 30 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Mertens möchte beim Putzen helfen und greift nach einem wackeligen Hocker.\n\n10 Min. · Einordnung\nPassen Sie Tätigkeiten und Hilfsmittel an die Situation an. Eine sichere, freiwillige Teilaufgabe kann zum Beispiel das Sortieren leichter Gegenstände sein. Lassen Sie Flucht- und Gehwege frei. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSuchen Sie drei Risiken in einer fiktiven Wohnung. Bieten Sie eine sichere Beteiligung an und stimmen Sie Prioritäten für den Besuch ab. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nNutzen Sie passende Arbeitsmittel und vereinbaren Sie Aufgaben, die von der Person gut übernommen werden können. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-06-case",
      "title": "Vom Abfall zur sauberen Arbeitsfläche",
      "kind": "text",
      "body": "Bildbeispiel\nAbfallbehälter, Waschplatz und frische Lebensmittel liegen in getrennten Bereichen. Das Schneidebrett liegt auf einer sauberen Fläche.\n\nBeobachtungsfrage\nOrdnen Sie Müllentsorgung, Händewaschen und Apfelschneiden. Wo bewahren Sie das benutzte Tuch auf?\n\nAuflösung\nNach der Müllentsorgung waschen Sie die Hände. Benutzte Tücher bleiben im vorgesehenen Schmutzbereich. Das Schneidebrett und die Lebensmittel bleiben davon getrennt."
    },
    {
      "id": "nrw-06-check",
      "title": "Wissenscheck · Hauswirtschaft und Hygiene",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-06-check-q1",
          "prompt": "Wie verwenden Sie unterschiedliche Reinigungsmittel?",
          "options": [
            {
              "id": "0b609901ff14",
              "text": "Gemischt, wenn es schneller gehen soll."
            },
            {
              "id": "897b55a30efa",
              "text": "In einem unbeschrifteten Gefäß für alle Flächen."
            },
            {
              "id": "1e77ffda72a6",
              "text": "Einzeln und nach den gekennzeichneten Gebrauchshinweisen."
            }
          ],
          "correctOptionId": "1e77ffda72a6"
        },
        {
          "id": "nrw-06-check-q2",
          "prompt": "Was tun vor dem Vorbereiten von Essen nach Kontakt mit Abfall?",
          "options": [
            {
              "id": "cc227b070c5a",
              "text": "Mit denselben Handschuhen weitermachen."
            },
            {
              "id": "b32c93e1a7dd",
              "text": "Hände gründlich waschen und sauber weiterarbeiten."
            },
            {
              "id": "ff6e0c40bbf2",
              "text": "Nur die Schürze wechseln."
            }
          ],
          "correctOptionId": "b32c93e1a7dd"
        },
        {
          "id": "nrw-06-check-q3",
          "prompt": "Wie vermeiden Sie Übertragung bei der Lebensmittelzubereitung?",
          "options": [
            {
              "id": "1b26cc0f59fe",
              "text": "Rohes und Verzehrfertiges getrennt verarbeiten."
            },
            {
              "id": "1e1caf210bdd",
              "text": "Ein Brett ohne Reinigung für alles benutzen."
            },
            {
              "id": "19dd8100e2ff",
              "text": "Kühlware bis zum Besuchsende draußen lassen."
            }
          ],
          "correctOptionId": "1b26cc0f59fe"
        }
      ]
    },
    {
      "id": "nrw-07-ue1",
      "title": "Zeit und Prioritäten",
      "kind": "text",
      "body": "UE 31 · 45 Minuten\n\n5 Min. · Einstieg\nDer Besuch läuft schon 20 Minuten länger. Ein weiterer Termin beginnt bald.\n\n10 Min. · Einordnung\nStimmen Sie Prioritäten und ein realistisches Ende ab. Melden Sie Verzögerungen rechtzeitig über die vorgesehenen Wege. Bei akuter Gefahr gilt der Notfallablauf. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nPlanen Sie für drei konkurrierende Aufgaben einen Abschluss. Spielen Sie die Information an die betreute Person und die Verwaltung durch. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nWählen Sie mit der Person den sinnvollen letzten Schritt und teilen Sie eine nötige Terminänderung rechtzeitig mit. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-07-ue2",
      "title": "Nähe und professionelle Grenzen",
      "kind": "text",
      "body": "UE 32 · 45 Minuten\n\n5 Min. · Einstieg\nEine Familie möchte Ihre private Handynummer und bietet ein größeres Geschenk an.\n\n10 Min. · Einordnung\nFreundliche Beziehungen brauchen verlässliche Grenzen. Nutzen Sie offizielle Kanäle und betriebliche Regeln zu Geschenken, Geld und Schlüsselübergaben. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nÜben Sie eine respektvolle Antwort auf beide Bitten. Entwerfen Sie einen offiziellen Kontaktweg und beschreiben Sie, wann Sie eine Rückfrage dokumentieren. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nSie können die Wertschätzung annehmen und auf die für alle geltenden Absprachen verweisen. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-07-ue3",
      "title": "Belastung erkennen",
      "kind": "text",
      "body": "UE 33 · 45 Minuten\n\n5 Min. · Einstieg\nNach mehreren herausfordernden Besuchen fällt Ihnen das Abschalten schwer.\n\n10 Min. · Einordnung\nFrühe Zeichen können Anspannung, Schlafprobleme oder Konzentrationsschwierigkeiten sein. Pausen, klare Zuständigkeiten und geeignete Fachgespräche helfen, die Belastung anzusprechen. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie einen persönlichen Plan mit zwei Frühzeichen, einer kurzfristigen Maßnahme und einer Ansprechperson. Halten Sie private Fallangaben aus der Übung heraus. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEin vereinbartes Nachgespräch und regelmäßige Pausen machen Unterstützung konkret. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-07-ue4",
      "title": "Haupt- und Ehrenamt abstimmen",
      "kind": "text",
      "body": "UE 34 · 45 Minuten\n\n5 Min. · Einstieg\nEine Ehrenamtliche begleitet die Person regelmäßig und übernimmt inzwischen immer weitere Aufgaben.\n\n10 Min. · Einordnung\nZuständigkeiten und Grenzen des Engagements gehören in eine klare Absprache. Haupt- und Ehrenamt, Angehörige und Fachbegleitung ergänzen sich mit unterschiedlichen Aufträgen. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErstellen Sie eine kleine Aufgabenmatrix und formulieren Sie, wer bei Überlastung anspricht, zurückmeldet und neu plant. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nLegen Sie feste Ansprechpersonen und eine erreichbare Vertretung fest. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-07-ue5",
      "title": "Aus einem Besuch lernen",
      "kind": "text",
      "body": "UE 35 · 45 Minuten\n\n5 Min. · Einstieg\nEin Gespräch war angespannt. Erst im Teamgespräch wird klar, dass zwei unterschiedliche Zeiten vereinbart waren.\n\n10 Min. · Einordnung\nReflexion fragt nach Beobachtung, eigener Handlung, Wirkung und einer nächsten Änderung. Nutzen Sie sie zum Lernen und zur Abstimmung des Teams. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nHalten Sie in vier Sätzen fest, was passiert ist, wie Sie gehandelt haben, was geholfen hat und was das Team beim nächsten Mal anders abstimmt. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEin klar bestätigter Termin vor dem Einsatz kann den konkreten Konflikt vermeiden. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-07-case",
      "title": "Ein kurzer Halt zwischen Besuchen",
      "kind": "text",
      "body": "Bildbeispiel\nEine Begleitung sitzt mit einem Glas Wasser, einem Notizbuch und einem Terminplan am Tisch. Eine Kollegin ist in der Nähe.\n\nBeobachtungsfrage\nWelche Beobachtung aus einem anstrengenden Besuch würden Sie mit dem Team besprechen? Wo ist der richtige Ort dafür?\n\nAuflösung\nVereinbaren Sie einen geschützten Austausch. Benennen Sie eine konkrete Belastung und überlegen Sie, welche Absprache oder Unterstützung beim nächsten Besuch hilft."
    },
    {
      "id": "nrw-07-check",
      "title": "Wissenscheck · Selbstmanagement",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-07-check-q1",
          "prompt": "Wie reagieren Sie auf eine Bitte um Ihre private Erreichbarkeit?",
          "options": [
            {
              "id": "3ac067391fb7",
              "text": "Private Erreichbarkeit rund um die Uhr versprechen."
            },
            {
              "id": "b98cf2c85049",
              "text": "Eine persönliche Nummer ohne Rücksprache weitergeben."
            },
            {
              "id": "7abd2b736bfa",
              "text": "Den vereinbarten Dienstkontakt anbieten."
            }
          ],
          "correctOptionId": "7abd2b736bfa"
        },
        {
          "id": "nrw-07-check-q2",
          "prompt": "Was tun bei anhaltender Belastung durch mehrere Einsätze?",
          "options": [
            {
              "id": "3fd5e3df3b69",
              "text": "Klientendetails in öffentlichen Kanälen teilen."
            },
            {
              "id": "e1aa9bd9bb3c",
              "text": "Die Belastung früh im vorgesehenen Rahmen ansprechen."
            },
            {
              "id": "17f1c8159e6a",
              "text": "Pausen dauerhaft ausfallen lassen."
            }
          ],
          "correctOptionId": "e1aa9bd9bb3c"
        },
        {
          "id": "nrw-07-check-q3",
          "prompt": "Was hilft bei Zusammenarbeit mit Ehrenamtlichen?",
          "options": [
            {
              "id": "7f07884e3b2c",
              "text": "Aufgaben, Grenzen und Ansprechpersonen vereinbaren."
            },
            {
              "id": "abf6291b8f14",
              "text": "Unklare Aufgaben spontan immer weitergeben."
            },
            {
              "id": "a3a430b6022a",
              "text": "Nur über Dritte kommunizieren."
            }
          ],
          "correctOptionId": "7f07884e3b2c"
        }
      ]
    },
    {
      "id": "nrw-08-ue1",
      "title": "Biografisch anknüpfen",
      "kind": "text",
      "body": "UE 36 · 45 Minuten\n\n5 Min. · Einstieg\nHerr Klee hat früher Gemüse angebaut und schaut gern aus dem Fenster in den Hof.\n\n10 Min. · Einordnung\nPersönliche Interessen geben Hinweise auf passende Aktivitäten. Fragen Sie, welche Erinnerung oder Tätigkeit gerade erwünscht ist. Halten Sie Privates geschützt. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nEntwerfen Sie eine kurze Gartenaktivität im Sitzen und eine Variante für draußen. Stimmen Sie Zeit und Material gemeinsam ab. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nSaatgut sortieren oder Kräuter riechen kann passen. Die Person entscheidet, ob und wie lange sie mitmacht. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-08-ue2",
      "title": "Aktivitäten anpassen",
      "kind": "text",
      "body": "UE 37 · 45 Minuten\n\n5 Min. · Einstieg\nFrau Brandt liest gern, ermüdet aber bei kleinem Druck.\n\n10 Min. · Einordnung\nPassen Sie Dauer, Kontrast, Material und Tempo an. Geben Sie eine klare Wahl und lassen Sie Pausen. Prüfen Sie, ob die Unterstützung angenehm ist. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nErarbeiten Sie eine große, kontrastreiche Vorlage und eine mündliche Alternative. Probieren Sie, wie eine Pause oder ein kürzerer Abschnitt angeboten werden kann. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nMit einem selbst gewählten kurzen Text und guter Beleuchtung bleibt Lesen zugänglich. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-08-ue3",
      "title": "Bewegung im Alltag",
      "kind": "text",
      "body": "UE 38 · 45 Minuten\n\n5 Min. · Einstieg\nDie Person möchte in den Park. Die Wege sind nass und sie ist heute unsicher auf den Beinen.\n\n10 Min. · Einordnung\nPrüfen Sie Tagesform, Weg, Wetter und vereinbarte Hilfen. Wählen Sie einen sicheren, freiwilligen Rahmen und kennen Sie den Umkehrpunkt. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nPlanen Sie zwei Optionen mit Sitzpause, geeignetem Weg und Rückkehr. Besprechen Sie, wie Wünsche und Sicherheit bei wechselnder Tagesform berücksichtigt werden. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nEin kurzer ebener Weg oder eine vereinbarte Aktivität drinnen hält Auswahl und Sicherheit offen. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-08-ue4",
      "title": "Gemeinsame Beschäftigung",
      "kind": "text",
      "body": "UE 39 · 45 Minuten\n\n5 Min. · Einstieg\nBei einer kleinen Runde mag eine Person lieber zuschauen, während andere singen.\n\n10 Min. · Einordnung\nTeilnahme kann Zuhören, Mitmachen oder eine eigene Rolle bedeuten. Geben Sie jeder Person Raum und vermeiden Sie Überforderung. Stimmen Sie die Gruppensituation mit der verantwortlichen Fachbegleitung ab. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nPlanen Sie eine zehnminütige Runde mit zwei Wahlmöglichkeiten und einem ruhigen Rückzugsort. Vereinbaren Sie, wie die Gruppe endet. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nFreiwilliges Zuhören ist eine Teilnahmeform. Ein klares Ende hilft bei der Orientierung. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-08-ue5",
      "title": "Eine Aktivität auswerten",
      "kind": "text",
      "body": "UE 40 · 45 Minuten\n\n5 Min. · Einstieg\nDie angebotene Bastelidee hat nach zehn Minuten ihren Reiz verloren. Die Person erzählt stattdessen von früher.\n\n10 Min. · Einordnung\nHalten Sie fest, was Freude, Ruhe oder Interesse ausgelöst hat und was verändert werden sollte. Stimmen Sie die nächste Idee mit der Person ab. Lesen Sie den Fall ein zweites Mal und halten Sie schriftlich fest, welche Information für Ihre Entscheidung fehlt.\n\n15 Min. · Übung\nSchreiben Sie eine kurze Doku und planen Sie einen nächsten Besuch. Prüfen Sie, wie Sie die spontane Erzählung einbeziehen können. Halten Sie Ihre Entscheidung und einen möglichen alternativen Verlauf in Stichpunkten fest.\n\n10 Min. · Abgleich\nDie Bastelidee kann beendet werden. Eine vereinbarte Gesprächszeit oder ein Fotoalbum wäre ein möglicher nächster Einstieg. Vergleichen Sie Ihren Ablauf mit diesem Beispiel. Spielen Sie die Alternative durch und prüfen Sie die Auswirkungen auf die betreute Person.\n\n5 Min. · Transfer\nNotieren Sie, was Sie im nächsten passenden Einsatz konkret erfragen, vereinbaren oder festhalten würden. Verwenden Sie in Ihren Lernnotizen fiktive Namen."
    },
    {
      "id": "nrw-08-case",
      "title": "Zwei Töpfe zur Auswahl",
      "kind": "text",
      "body": "Bildbeispiel\nEin älterer Mann sortiert Samen. Zwei kleine Basilikumpflanzen stehen für ihn erreichbar bereit. Die Begleitung hilft bei der Vorbereitung.\n\nBeobachtungsfrage\nWelche Schritte kann er übernehmen? Was ändern Sie, falls seine Hände heute schnell ermüden?\n\nAuflösung\nLassen Sie ihn auswählen, Samen sortieren oder gießen. Stellen Sie bei Bedarf größere Gefäße bereit und bieten Sie eine Pause oder einen kürzeren Ablauf an."
    },
    {
      "id": "nrw-08-check",
      "title": "Wissenscheck · Alltagsaktivierung und Betreuung",
      "kind": "quiz",
      "body": "Wählen Sie für jede Situation die passende Handlung. Zwei von drei richtigen Antworten genügen für den Modulcheck. Sie können nachlesen und erneut üben.",
      "questions": [
        {
          "id": "nrw-08-check-q1",
          "prompt": "Woran erkennen Sie, dass eine Aktivität passt?",
          "options": [
            {
              "id": "05a5cb0e8b86",
              "text": "Jede Aufgabe wird vollständig erledigt."
            },
            {
              "id": "c1ee6f8dc645",
              "text": "Die Aktivität folgt immer demselben Schema."
            },
            {
              "id": "5d887c555a8a",
              "text": "Die Person wählt mit und zeigt Interesse oder Wohlbefinden."
            }
          ],
          "correctOptionId": "5d887c555a8a"
        },
        {
          "id": "nrw-08-check-q2",
          "prompt": "Wie passen Sie eine Leseaufgabe bei rascher Ermüdung an?",
          "options": [
            {
              "id": "977307e35211",
              "text": "Das Tempo unabhängig vom Wunsch erhöhen."
            },
            {
              "id": "251a2e7e2ab4",
              "text": "Kontrast verbessern, kürzere Abschnitte und Pausen anbieten."
            },
            {
              "id": "3b352b10be70",
              "text": "Den Text kleiner drucken."
            }
          ],
          "correctOptionId": "251a2e7e2ab4"
        },
        {
          "id": "nrw-08-check-q3",
          "prompt": "Was ist bei einem geplanten Spaziergang wichtig?",
          "options": [
            {
              "id": "76288938628b",
              "text": "Tagesform, sicherer Weg und Zustimmung."
            },
            {
              "id": "45a894b32bca",
              "text": "Die vorgesehene Dauer um jeden Preis."
            },
            {
              "id": "34cdbd1320f8",
              "text": "Den bekannten Weg bei Glätte beibehalten."
            }
          ],
          "correctOptionId": "76288938628b"
        }
      ]
    },
    {
      "id": "nrw-final",
      "title": "Abschlussprüfung",
      "kind": "quiz",
      "body": "16 Fragen, je zwei pro Modul. Mit mindestens 12 richtigen Antworten bestehen Sie die Prüfung. Ihre Auswahl wird während der Prüfung gespeichert.",
      "questions": [
        {
          "id": "nrw-01-final-q1",
          "prompt": "Wer bestimmt zwischen zwei sicheren und vereinbarten Tätigkeiten?",
          "options": [
            {
              "id": "16451e41cb6a",
              "text": "Die Nachbarin legt den Ablauf fest."
            },
            {
              "id": "66c646711c64",
              "text": "Die Reihenfolge steht grundsätzlich fest."
            },
            {
              "id": "4d416823847f",
              "text": "Die begleitete Person entscheidet mit."
            }
          ],
          "correctOptionId": "4d416823847f"
        },
        {
          "id": "nrw-01-final-q2",
          "prompt": "An wen geht eine konkrete Frage zur Erstattung?",
          "options": [
            {
              "id": "57b0a3a95eb0",
              "text": "An den Fahrdienst."
            },
            {
              "id": "838c74d51bce",
              "text": "An die Pflegekasse oder geeignete Beratung."
            },
            {
              "id": "16af9bbcfd8c",
              "text": "An beliebige Angehörige."
            }
          ],
          "correctOptionId": "838c74d51bce"
        },
        {
          "id": "nrw-01-final-q3",
          "prompt": "Was gehört in die Verlaufsdokumentation?",
          "options": [
            {
              "id": "cd3437923b74",
              "text": "Beobachtung, Handlung und notwendige Weitergabe."
            },
            {
              "id": "144f13d4601f",
              "text": "Eine Vermutung als Diagnose."
            },
            {
              "id": "d42aa317a7b4",
              "text": "Eine wertende Beschreibung der Person."
            }
          ],
          "correctOptionId": "cd3437923b74"
        },
        {
          "id": "nrw-01-final-q4",
          "prompt": "Was tun bei einer Aufgabe außerhalb Ihres Auftrags?",
          "options": [
            {
              "id": "0057624a537d",
              "text": "Bei Zeitdruck ungeprüft übernehmen."
            },
            {
              "id": "c5bd25cffc38",
              "text": "Die Aufgabe aus dem Einsatzbericht streichen."
            },
            {
              "id": "7bdfab5ce135",
              "text": "Grenze erklären und passende Fachstelle einbeziehen."
            }
          ],
          "correctOptionId": "7bdfab5ce135"
        },
        {
          "id": "nrw-02-final-q1",
          "prompt": "Was stärkt vorhandene Fähigkeiten?",
          "options": [
            {
              "id": "af11fead65d5",
              "text": "Alle Entscheidungen werden abgenommen."
            },
            {
              "id": "b97b83b9f7d6",
              "text": "Hilfsmittel bleiben weg, damit es schneller geht."
            },
            {
              "id": "9828fb0f1611",
              "text": "Die Person übernimmt passende Teile der Aufgabe."
            }
          ],
          "correctOptionId": "9828fb0f1611"
        },
        {
          "id": "nrw-02-final-q2",
          "prompt": "Wie reagieren Sie auf die Ablehnung eines Spaziergangs?",
          "options": [
            {
              "id": "b8e7522c783f",
              "text": "Den Angehörigen um eine Erlaubnis gegen den Wunsch bitten."
            },
            {
              "id": "803622ecb56f",
              "text": "Die Entscheidung respektieren und eine Alternative anbieten."
            },
            {
              "id": "e2097846878d",
              "text": "Auf der ursprünglichen Planung bestehen."
            }
          ],
          "correctOptionId": "803622ecb56f"
        },
        {
          "id": "nrw-02-final-q3",
          "prompt": "Worauf achten Sie bei einer Besuchsplanung?",
          "options": [
            {
              "id": "9d54a299e713",
              "text": "Auf Wünsche, sichere Schritte, Pausen und Spielraum."
            },
            {
              "id": "4bc29a8abd17",
              "text": "Nur auf die Zahl abgehakter Tätigkeiten."
            },
            {
              "id": "5c363768d715",
              "text": "Auf die unveränderte Routine der Vorwoche."
            }
          ],
          "correctOptionId": "9d54a299e713"
        },
        {
          "id": "nrw-02-final-q4",
          "prompt": "Wie lässt sich ein überlasteter Angehöriger unterstützen?",
          "options": [
            {
              "id": "018d98174ff3",
              "text": "Eine private Rufbereitschaft versprechen."
            },
            {
              "id": "51da9f5e361e",
              "text": "Vertrauliche Details im Bekanntenkreis besprechen."
            },
            {
              "id": "923324b2cdec",
              "text": "Zuhören und mit Zustimmung passende Beratung vermitteln."
            }
          ],
          "correctOptionId": "923324b2cdec"
        },
        {
          "id": "nrw-03-final-q1",
          "prompt": "Was tun Sie bei Bewusstlosigkeit und fehlender normaler Atmung?",
          "options": [
            {
              "id": "7e03822ba1c5",
              "text": "Die Person allein lassen, um das Büro anzurufen."
            },
            {
              "id": "778d2fc5b896",
              "text": "Etwas zu trinken geben."
            },
            {
              "id": "68fc0661461e",
              "text": "112 alarmieren und unverzüglich Wiederbelebung beginnen."
            }
          ],
          "correctOptionId": "68fc0661461e"
        },
        {
          "id": "nrw-03-final-q2",
          "prompt": "Was ist für den Notruf besonders wichtig?",
          "options": [
            {
              "id": "7afa3d2093fa",
              "text": "Vor dem Anruf die interne Erlaubnis einholen."
            },
            {
              "id": "1ddf3d49844d",
              "text": "Genauer Ort, Beobachtung und Rückfragen abwarten."
            },
            {
              "id": "74cdd3824cb3",
              "text": "Zuerst die vollständige Vorgeschichte vortragen."
            }
          ],
          "correctOptionId": "1ddf3d49844d"
        },
        {
          "id": "nrw-03-final-q3",
          "prompt": "Plötzlich treten Sprachstörung und einseitige Schwäche auf. Wie handeln Sie?",
          "options": [
            {
              "id": "4eec778394cc",
              "text": "Sofort 112 rufen und den beobachteten Beginn mitteilen."
            },
            {
              "id": "d14fea00256d",
              "text": "Bis zum nächsten Besuch beobachten."
            },
            {
              "id": "b3d1a1ae2f63",
              "text": "Mit einem Spaziergang prüfen, ob es besser wird."
            }
          ],
          "correctOptionId": "4eec778394cc"
        },
        {
          "id": "nrw-03-final-q4",
          "prompt": "Welche Notiz hilft bei der Übergabe?",
          "options": [
            {
              "id": "cd0468babc8f",
              "text": "Ein allgemeiner Eindruck ohne Zeitbezug."
            },
            {
              "id": "d68297f4e22d",
              "text": "Eine gesicherte Diagnose aus der eigenen Beobachtung."
            },
            {
              "id": "05dbf46a1867",
              "text": "Uhrzeit, beobachtete Zeichen und eingeleitete Maßnahmen."
            }
          ],
          "correctOptionId": "05dbf46a1867"
        },
        {
          "id": "nrw-04-final-q1",
          "prompt": "Wie reagieren Sie bei einer wiederholten Frage, die von Sorge begleitet ist?",
          "options": [
            {
              "id": "d794f70ad81d",
              "text": "Die Frage als Störung unterbinden."
            },
            {
              "id": "5f1774d675b8",
              "text": "Jedes Mal ein Gedächtnistraining daraus machen."
            },
            {
              "id": "fa2f80308f9e",
              "text": "Ruhig antworten und das Gefühl aufgreifen."
            }
          ],
          "correctOptionId": "fa2f80308f9e"
        },
        {
          "id": "nrw-04-final-q2",
          "prompt": "Was hilft bei eingeschränktem Hören?",
          "options": [
            {
              "id": "152453f2c3af",
              "text": "Sich zur Tür drehen und aus der Ferne rufen."
            },
            {
              "id": "8abb58c118ac",
              "text": "Blickkontakt, wenig Hintergrundlärm und klare kurze Sätze."
            },
            {
              "id": "de911d58384c",
              "text": "Immer lauter und schneller sprechen."
            }
          ],
          "correctOptionId": "8abb58c118ac"
        },
        {
          "id": "nrw-04-final-q3",
          "prompt": "Was tun bei einer neuen deutlichen Veränderung?",
          "options": [
            {
              "id": "abeed4f7a269",
              "text": "Beobachtung festhalten und passend zur Dringlichkeit Hilfe veranlassen."
            },
            {
              "id": "d493bcf90989",
              "text": "Sie grundsätzlich dem Alter zuschreiben."
            },
            {
              "id": "481955d257ba",
              "text": "Bis zum Ende der Woche auf weitere Zeichen warten."
            }
          ],
          "correctOptionId": "abeed4f7a269"
        },
        {
          "id": "nrw-04-final-q4",
          "prompt": "Wie helfen Sie bei einem stockenden Gang?",
          "options": [
            {
              "id": "2e1283c2e4dd",
              "text": "Die Person zügig durch die Tür ziehen."
            },
            {
              "id": "a1d37b45fee1",
              "text": "Das Hilfsmittel zur Seite stellen."
            },
            {
              "id": "b51c113863dd",
              "text": "Zeit geben und die individuell vereinbarte Hilfe anbieten."
            }
          ],
          "correctOptionId": "b51c113863dd"
        },
        {
          "id": "nrw-05-final-q1",
          "prompt": "Was ist eine hilfreiche Reaktion auf ein Zurückweichen?",
          "options": [
            {
              "id": "68da79a69735",
              "text": "Die Hilfe schneller durchführen."
            },
            {
              "id": "65f74eab5f17",
              "text": "Das Signal grundsätzlich ignorieren."
            },
            {
              "id": "904e50b578ef",
              "text": "Innehalten, Abstand lassen und um Zustimmung fragen."
            }
          ],
          "correctOptionId": "904e50b578ef"
        },
        {
          "id": "nrw-05-final-q2",
          "prompt": "Was hilft bei einem Konflikt im engen Flur?",
          "options": [
            {
              "id": "fedeeb849c67",
              "text": "Die eigene Stimme deutlich anheben."
            },
            {
              "id": "a353cfffdf51",
              "text": "Abstand, ruhiger Ton und ein freier Rückweg."
            },
            {
              "id": "bac291d1d3ac",
              "text": "Den Ausgang verstellen."
            }
          ],
          "correctOptionId": "a353cfffdf51"
        },
        {
          "id": "nrw-05-final-q3",
          "prompt": "Welche Information gehört in die Übergabe?",
          "options": [
            {
              "id": "92d502352129",
              "text": "Was das Team für die nächste Unterstützung braucht."
            },
            {
              "id": "dc8a8d4b231b",
              "text": "Sämtliche privaten Gesprächsinhalte."
            },
            {
              "id": "7e705947ee66",
              "text": "Vermutungen über persönliche Absichten."
            }
          ],
          "correctOptionId": "92d502352129"
        },
        {
          "id": "nrw-05-final-q4",
          "prompt": "Wie klären Sie einen Vorwurf zum Einsatzbeginn?",
          "options": [
            {
              "id": "1b4b86f3bdcc",
              "text": "Ein Streitgespräch über frühere Besuche beginnen."
            },
            {
              "id": "c5c7858c6d0f",
              "text": "Eine neue Zeit ohne Rücksprache eintragen."
            },
            {
              "id": "149fc58b15e4",
              "text": "Die Erwartung erfragen und die Zeitabsprache prüfen."
            }
          ],
          "correctOptionId": "149fc58b15e4"
        },
        {
          "id": "nrw-06-final-q1",
          "prompt": "Wie verwenden Sie unterschiedliche Reinigungsmittel?",
          "options": [
            {
              "id": "b236c4fee0a8",
              "text": "Gemischt, wenn es schneller gehen soll."
            },
            {
              "id": "73442d3c31b7",
              "text": "In einem unbeschrifteten Gefäß für alle Flächen."
            },
            {
              "id": "3f6a668a2c60",
              "text": "Einzeln und nach den gekennzeichneten Gebrauchshinweisen."
            }
          ],
          "correctOptionId": "3f6a668a2c60"
        },
        {
          "id": "nrw-06-final-q2",
          "prompt": "Was tun vor dem Vorbereiten von Essen nach Kontakt mit Abfall?",
          "options": [
            {
              "id": "cc851ac003b0",
              "text": "Mit denselben Handschuhen weitermachen."
            },
            {
              "id": "570e56e0bbae",
              "text": "Hände gründlich waschen und sauber weiterarbeiten."
            },
            {
              "id": "0de1ae092f36",
              "text": "Nur die Schürze wechseln."
            }
          ],
          "correctOptionId": "570e56e0bbae"
        },
        {
          "id": "nrw-06-final-q3",
          "prompt": "Wie vermeiden Sie Übertragung bei der Lebensmittelzubereitung?",
          "options": [
            {
              "id": "349aa50f37d2",
              "text": "Rohes und Verzehrfertiges getrennt verarbeiten."
            },
            {
              "id": "c685cc138fe8",
              "text": "Ein Brett ohne Reinigung für alles benutzen."
            },
            {
              "id": "cc7aa4539e0d",
              "text": "Kühlware bis zum Besuchsende draußen lassen."
            }
          ],
          "correctOptionId": "349aa50f37d2"
        },
        {
          "id": "nrw-06-final-q4",
          "prompt": "Wie beteiligen Sie eine Person sicher an Hausarbeit?",
          "options": [
            {
              "id": "ab75a6a0a6a6",
              "text": "Sie zum Steigen auf einen instabilen Hocker ermuntern."
            },
            {
              "id": "5305ac15fc8a",
              "text": "Die Aufgabe allein wegen der Zeitplanung erzwingen."
            },
            {
              "id": "46c0fbe8b2a4",
              "text": "Eine passende, freiwillige Teilaufgabe anbieten."
            }
          ],
          "correctOptionId": "46c0fbe8b2a4"
        },
        {
          "id": "nrw-07-final-q1",
          "prompt": "Wie reagieren Sie auf eine Bitte um Ihre private Erreichbarkeit?",
          "options": [
            {
              "id": "857785358725",
              "text": "Private Erreichbarkeit rund um die Uhr versprechen."
            },
            {
              "id": "fd1d9b3081bb",
              "text": "Eine persönliche Nummer ohne Rücksprache weitergeben."
            },
            {
              "id": "65f4d5892180",
              "text": "Den vereinbarten Dienstkontakt anbieten."
            }
          ],
          "correctOptionId": "65f4d5892180"
        },
        {
          "id": "nrw-07-final-q2",
          "prompt": "Was tun bei anhaltender Belastung durch mehrere Einsätze?",
          "options": [
            {
              "id": "c3917d975f64",
              "text": "Klientendetails in öffentlichen Kanälen teilen."
            },
            {
              "id": "09a631cd27dc",
              "text": "Die Belastung früh im vorgesehenen Rahmen ansprechen."
            },
            {
              "id": "585e2a620ae3",
              "text": "Pausen dauerhaft ausfallen lassen."
            }
          ],
          "correctOptionId": "09a631cd27dc"
        },
        {
          "id": "nrw-07-final-q3",
          "prompt": "Was hilft bei Zusammenarbeit mit Ehrenamtlichen?",
          "options": [
            {
              "id": "adb2a8653763",
              "text": "Aufgaben, Grenzen und Ansprechpersonen vereinbaren."
            },
            {
              "id": "f73a4ae73552",
              "text": "Unklare Aufgaben spontan immer weitergeben."
            },
            {
              "id": "1c932bb8fb7e",
              "text": "Nur über Dritte kommunizieren."
            }
          ],
          "correctOptionId": "adb2a8653763"
        },
        {
          "id": "nrw-07-final-q4",
          "prompt": "Was zeichnet eine gute Reflexion aus?",
          "options": [
            {
              "id": "26c4d03de9c8",
              "text": "Eine Schuldzuweisung ohne Handlungsschritt."
            },
            {
              "id": "eb71e6224530",
              "text": "Ein privates Urteil über die Person."
            },
            {
              "id": "462f27c77844",
              "text": "Eine konkrete Beobachtung und eine umsetzbare Änderung."
            }
          ],
          "correctOptionId": "462f27c77844"
        },
        {
          "id": "nrw-08-final-q1",
          "prompt": "Woran erkennen Sie, dass eine Aktivität passt?",
          "options": [
            {
              "id": "566402d92e71",
              "text": "Jede Aufgabe wird vollständig erledigt."
            },
            {
              "id": "086cb288d77f",
              "text": "Die Aktivität folgt immer demselben Schema."
            },
            {
              "id": "7a2f9f547c47",
              "text": "Die Person wählt mit und zeigt Interesse oder Wohlbefinden."
            }
          ],
          "correctOptionId": "7a2f9f547c47"
        },
        {
          "id": "nrw-08-final-q2",
          "prompt": "Wie passen Sie eine Leseaufgabe bei rascher Ermüdung an?",
          "options": [
            {
              "id": "9fd119a268c0",
              "text": "Das Tempo unabhängig vom Wunsch erhöhen."
            },
            {
              "id": "ef9598adeaf5",
              "text": "Kontrast verbessern, kürzere Abschnitte und Pausen anbieten."
            },
            {
              "id": "35de80fa1861",
              "text": "Den Text kleiner drucken."
            }
          ],
          "correctOptionId": "ef9598adeaf5"
        },
        {
          "id": "nrw-08-final-q3",
          "prompt": "Was ist bei einem geplanten Spaziergang wichtig?",
          "options": [
            {
              "id": "7402f991b00f",
              "text": "Tagesform, sicherer Weg und Zustimmung."
            },
            {
              "id": "b856f5980153",
              "text": "Die vorgesehene Dauer um jeden Preis."
            },
            {
              "id": "5d911fcbc370",
              "text": "Den bekannten Weg bei Glätte beibehalten."
            }
          ],
          "correctOptionId": "7402f991b00f"
        },
        {
          "id": "nrw-08-final-q4",
          "prompt": "Wie reagieren Sie, wenn eine Person in der Gruppe nur zuschauen möchte?",
          "options": [
            {
              "id": "1f7224c39241",
              "text": "Eine aktive Rolle zuweisen."
            },
            {
              "id": "04f063791d66",
              "text": "Sie sofort aus der Gruppe ausschließen."
            },
            {
              "id": "17cd56831628",
              "text": "Zuschauen respektieren und spätere Beteiligung offenlassen."
            }
          ],
          "correctOptionId": "17cd56831628"
        }
      ]
    }
  ]
}
 $content$::jsonb
$function$;

CREATE TABLE academy_private.nrw_exam_drafts (
 enrollment_id uuid PRIMARY KEY REFERENCES academy_private.enrollment_workspaces(enrollment_id),
 attempt integer NOT NULL CHECK(attempt>0),
 answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object')
);
ALTER TABLE academy_private.nrw_exam_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON academy_private.nrw_exam_drafts FROM PUBLIC,anon,authenticated;
CREATE INDEX academy_nrw_review_lookup ON academy_private.review_events(enrollment_id,action,created_at DESC,id)
 WHERE action IN ('nrw_practice','nrw_retry');

CREATE FUNCTION academy_private.nrw_questions(version_content jsonb, enrollment uuid, attempt_no integer) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 WITH bank AS (
  SELECT q, left(q->>'id',6) AS chapter
  FROM jsonb_array_elements(version_content->'lessons') l
  CROSS JOIN LATERAL jsonb_array_elements(l->'questions') q
  WHERE l->>'id'='nrw-final'
 ), drawn AS (
  SELECT q, chapter, row_number() OVER (
   PARTITION BY chapter ORDER BY md5(enrollment::text||':'||attempt_no||':'||(q->>'id')), q->>'id'
  ) AS position
  FROM bank
 )
 SELECT coalesce(jsonb_agg(
  jsonb_set(q,'{options}',(SELECT jsonb_agg(o ORDER BY md5(enrollment::text||':'||attempt_no||':'||(q->>'id')||':'||(o->>'id')))
   FROM jsonb_array_elements(q->'options') o))
  ORDER BY chapter,position
 ),'[]'::jsonb) FROM drawn WHERE position<=2
$$;

CREATE FUNCTION academy_private.nrw_practice(enrollment uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT note::jsonb FROM academy_private.review_events
 WHERE enrollment_id=enrollment AND action='nrw_practice'
 ORDER BY created_at DESC,id DESC LIMIT 1
$$;

CREATE FUNCTION academy_private.nrw_certificate_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE e academy_private.enrollment_workspaces; practice jsonb; exam academy_private.quiz_attempts;
 personnel text;
BEGIN
 SELECT * INTO e FROM academy_private.enrollment_workspaces WHERE enrollment_id=NEW.enrollment_id AND tenant_id=NEW.tenant_id;
 IF e.course_id IS DISTINCT FROM academy_private.nrw_course_id(NEW.tenant_id) THEN RETURN NEW; END IF;
 SELECT * INTO exam FROM academy_private.quiz_attempts
 WHERE enrollment_id=e.enrollment_id AND lesson_id='nrw-final' AND passed ORDER BY attempt DESC LIMIT 1;
 practice:=academy_private.nrw_practice(e.enrollment_id);
 IF exam.id IS NULL OR practice IS NULL
  OR (practice->>'kind'='first_aid' AND (practice->>'date')::date < (current_date - interval '5 years')::date)
 THEN RAISE EXCEPTION 'Die bestandene Prüfung und ein gültiger Praxisnachweis sind für das Zertifikat erforderlich' USING ERRCODE='55000'; END IF;
 SELECT nullif(btrim(to_jsonb(p)->>'personnel_number'),'') INTO personnel FROM public.employees p
 WHERE p.id=e.target_id AND p.tenant_id=e.tenant_id;
 NEW.snapshot:=NEW.snapshot||jsonb_build_object('qualification',jsonb_build_object(
  'template','klarblatt','examScore',exam.score,'completedAt',exam.submitted_at,
  'practiceKind',practice->>'kind','practiceDate',practice->>'date','personnelNumber',personnel
 ));
 RETURN NEW;
END $$;
CREATE TRIGGER academy_nrw_certificate BEFORE INSERT ON academy_private.certificate_snapshots
 FOR EACH ROW EXECUTE FUNCTION academy_private.nrw_certificate_snapshot();

ALTER FUNCTION academy_private.workspace_load(uuid,text) RENAME TO workspace_load_before_nrw;
ALTER FUNCTION academy_private.workspace_mutate(uuid,text,text,uuid,uuid,integer,jsonb) RENAME TO workspace_mutate_before_nrw;
REVOKE ALL ON FUNCTION academy_private.workspace_load_before_nrw(uuid,text),
 academy_private.workspace_mutate_before_nrw(uuid,text,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION academy_private.workspace_load(p_tenant uuid,p_view text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb; enrollment jsonb; records jsonb:='[]'; courses jsonb:='[]'; course jsonb;
 course_id uuid:=academy_private.nrw_course_id(p_tenant); eid uuid; version_content jsonb;
 remaining integer; used integer; allowance integer; state text; practice jsonb; mistakes jsonb; answers jsonb; questions jsonb;
BEGIN
 result:=academy_private.workspace_load_before_nrw(p_tenant,p_view);
 IF p_view='office' THEN
  FOR course IN SELECT value FROM jsonb_array_elements(result->'courses') LOOP
   IF course->>'id'=course_id::text THEN
    course:=jsonb_set(course,'{content}',academy_private.redact(course->'content'));
    course:=jsonb_set(course,'{content,lessons}',(
     SELECT jsonb_agg(CASE WHEN l->>'id'='nrw-final' THEN l||'{"questions":[]}'::jsonb ELSE l END ORDER BY pos)
     FROM jsonb_array_elements(course#>'{content,lessons}') WITH ORDINALITY x(l,pos)));
   END IF;
   courses:=courses||jsonb_build_array(course);
  END LOOP;
  result:=result||jsonb_build_object('nrwCourseId',course_id,'courses',courses);
 END IF;
 FOR enrollment IN SELECT value FROM jsonb_array_elements(result->'enrollments') LOOP
  IF enrollment->>'courseId'=course_id::text THEN
   eid:=(enrollment->>'id')::uuid;
   SELECT content INTO version_content FROM academy_private.course_versions WHERE id=(enrollment->>'versionId')::uuid AND tenant_id=p_tenant;
   SELECT count(*) INTO remaining FROM jsonb_array_elements(version_content->'lessons') l
    WHERE l->>'id'<>'nrw-final' AND NOT (enrollment->'completedLessonIds' ? (l->>'id'));
   SELECT count(*) INTO used FROM academy_private.quiz_attempts a WHERE a.enrollment_id=eid AND a.lesson_id='nrw-final';
   SELECT 1+count(*) INTO allowance FROM academy_private.review_events r WHERE r.enrollment_id=eid AND r.action='nrw_retry';
   state:=CASE WHEN enrollment->'completedLessonIds' ? 'nrw-final' THEN 'passed'
    WHEN remaining>0 OR enrollment->>'state'='cancelled' THEN 'learning'
    WHEN used>=allowance THEN 'failed' ELSE 'ready' END;
   practice:=academy_private.nrw_practice(eid);
   answers:='{}'; questions:='[]'; mistakes:='[]';
   IF p_view='learner' AND state='ready' AND enrollment->>'state' IN ('in_progress','returned') THEN
    SELECT coalesce(jsonb_agg(q-'correctOptionId' ORDER BY pos),'[]') INTO questions
    FROM jsonb_array_elements(academy_private.nrw_questions(version_content,eid,used+1)) WITH ORDINALITY x(q,pos);
    SELECT d.answers INTO answers FROM academy_private.nrw_exam_drafts d WHERE d.enrollment_id=eid AND d.attempt=used+1;
   ELSIF p_view='office' AND (result#>>'{capabilities,review}')::boolean
    AND NOT academy_private.is_self(p_tenant,'employee',(enrollment#>>'{participant,id}')::uuid)
   THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object('attempt',a.attempt,'question',q->>'prompt','answer',o->>'text') ORDER BY a.attempt,q->>'id'),'[]') INTO mistakes
     FROM academy_private.quiz_attempts a
     CROSS JOIN LATERAL jsonb_array_elements(academy_private.nrw_questions(version_content,eid,a.attempt)) q
     CROSS JOIN LATERAL jsonb_array_elements(q->'options') o
     WHERE a.enrollment_id=eid AND a.lesson_id='nrw-final'
       AND o->>'id'=a.answers->>(q->>'id') AND o->>'id'<>q->>'correctOptionId';
   END IF;
   enrollment:=jsonb_set(enrollment,'{content,lessons}',(
    SELECT jsonb_agg(CASE WHEN l->>'id'='nrw-final' THEN l||jsonb_build_object('questions',questions) ELSE l END ORDER BY pos)
    FROM jsonb_array_elements(enrollment#>'{content,lessons}') WITH ORDINALITY x(l,pos)));
   enrollment:=enrollment||jsonb_build_object('nrwExam',jsonb_build_object(
    'state',state,'attemptLimit',allowance,'draftAnswers',coalesce(answers,'{}'::jsonb),
    'mistakes',mistakes,'practice',practice-'reference'-'provider'
   ));
  END IF;
  records:=records||jsonb_build_array(enrollment);
 END LOOP;
 RETURN jsonb_set(result,'{enrollments}',records);
END $$;

CREATE FUNCTION academy_private.workspace_mutate(p_tenant uuid,p_view text,p_action text,p_request uuid,p_record uuid,p_revision integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE actor uuid:=auth.uid(); course uuid:=academy_private.nrw_course_id(p_tenant);
 e academy_private.enrollment_workspaces; v jsonb; me jsonb; fingerprint text; cached academy_private.requests;
 used integer; allowance integer; question jsonb; questions jsonb; lesson jsonb; answers jsonb; selected text;
 target_lesson text:=p_data->>'lessonId'; result jsonb:='{}'; correct integer:=0; score integer; passed boolean;
 office_action boolean; practice_date date; note text; next_revision integer; allowed_keys text[];
BEGIN
 -- Ordinary Academy commands still use the existing code and authorisation.
 IF p_action='save_course' AND p_record=course THEN
  RAISE EXCEPTION 'Der integrierte NRW-Kurs hat eine feste Kursfassung' USING ERRCODE='42501';
 END IF;
 IF p_action='review_enrollment' AND p_data->>'decision'='approve' AND EXISTS(
  SELECT 1 FROM academy_private.enrollment_workspaces WHERE enrollment_id=p_record AND tenant_id=p_tenant AND course_id=course
 ) THEN
  IF p_data->'nrwConfirmed' IS DISTINCT FROM 'true'::jsonb OR length(btrim(coalesce(p_data->>'note','')))<3 THEN
   RAISE EXCEPTION 'Die fachliche Prüfung und die Eignung der Schulung müssen bestätigt werden' USING ERRCODE='22023';
  END IF;
  RETURN academy_private.workspace_mutate_before_nrw(p_tenant,p_view,p_action,p_request,p_record,p_revision,p_data-'nrwConfirmed');
 END IF;
 IF p_action NOT IN ('install_nrw_course','save_nrw_exam_answer','unlock_nrw_exam','record_nrw_practice')
  AND NOT (p_action='submit_quiz' AND EXISTS(SELECT 1 FROM academy_private.enrollment_workspaces
   WHERE enrollment_id=p_record AND tenant_id=p_tenant AND course_id=course))
  OR p_action IS NULL
 THEN RETURN academy_private.workspace_mutate_before_nrw(p_tenant,p_view,p_action,p_request,p_record,p_revision,p_data); END IF;

 IF actor IS NULL OR NOT coalesce(public.platform_tenant_access_allowed(p_tenant,false),false)
  OR p_tenant IS DISTINCT FROM public.current_tenant_id()
 THEN RAISE EXCEPTION 'Kein gültiger Mandantenzugang' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('office','learner') OR p_request IS NULL OR p_record IS NULL
  OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR length(p_data::text)>20000
 THEN RAISE EXCEPTION 'Ungültiger Akademievorgang' USING ERRCODE='22023'; END IF;
 allowed_keys:=CASE p_action WHEN 'install_nrw_course' THEN ARRAY[]::text[]
  WHEN 'record_nrw_practice' THEN ARRAY['kind','date','provider','reference']
  WHEN 'unlock_nrw_exam' THEN ARRAY['note']
  WHEN 'save_nrw_exam_answer' THEN ARRAY['questionId','optionId'] ELSE ARRAY['lessonId','answers'] END;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE NOT k=ANY(allowed_keys)) THEN
  RAISE EXCEPTION 'Unerwartete Vorgangsdaten' USING ERRCODE='22023';
 END IF;
 office_action:=p_action IN ('install_nrw_course','unlock_nrw_exam','record_nrw_practice');
 IF office_action THEN
  IF p_view<>'office' OR NOT academy_private.office_allowed(p_tenant,CASE WHEN p_action='install_nrw_course'
    THEN 'akademie.courses.manage' ELSE 'akademie.enrollments.review' END)
  THEN RAISE EXCEPTION 'Aktion nicht freigegeben' USING ERRCODE='42501'; END IF;
 ELSE
  me:=academy_private.learner(p_tenant);
  IF p_view<>'learner' OR me->>'kind' IS DISTINCT FROM 'employee'
  THEN RAISE EXCEPTION 'Persönlicher Lernzugang erforderlich' USING ERRCODE='42501'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('academy:'||p_tenant::text,0));

 IF p_action='install_nrw_course' THEN
  IF p_record IS DISTINCT FROM course OR p_revision IS NOT NULL THEN
   RAISE EXCEPTION 'Ungültige Kurskennung' USING ERRCODE='22023';
  END IF;
 ELSE
  SELECT * INTO e FROM academy_private.enrollment_workspaces
   WHERE enrollment_id=p_record AND tenant_id=p_tenant AND course_id=course AND target_kind='employee' FOR UPDATE;
  IF e.enrollment_id IS NULL OR (office_action AND (NOT academy_private.person_visible(p_tenant,'employee')
      OR academy_private.is_self(p_tenant,'employee',e.target_id)))
   OR (NOT office_action AND e.target_id IS DISTINCT FROM (me->>'id')::uuid)
  THEN RAISE EXCEPTION 'Teilnahme nicht freigegeben' USING ERRCODE='42501'; END IF;
 END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('tenant',p_tenant,'view',p_view,'action',p_action,'record',p_record,
  'revision',p_revision,'data',p_data)::text,'UTF8')),'hex');
 SELECT * INTO cached FROM academy_private.requests WHERE tenant_id=p_tenant AND actor_id=actor AND request_id=p_request;
 IF FOUND THEN
  IF cached.digest<>fingerprint THEN RAISE EXCEPTION 'Vorgangs-ID wurde mit anderen Daten wiederverwendet' USING ERRCODE='22023'; END IF;
  RETURN cached.result||'{"replayed":true}'::jsonb;
 END IF;

 IF p_action='install_nrw_course' THEN
  SELECT revision INTO next_revision FROM academy_private.course_workspaces WHERE course_id=course AND tenant_id=p_tenant;
  IF next_revision IS NULL THEN
   result:=academy_private.workspace_mutate_before_nrw(p_tenant,p_view,'save_course',gen_random_uuid(),course,NULL,
     jsonb_build_object('content',academy_private.nrw_content()));
   next_revision:=(result->>'revision')::integer;
  END IF;
 ELSE
  IF p_revision IS DISTINCT FROM e.revision THEN RAISE EXCEPTION 'Teilnahme wurde zwischenzeitlich geändert. Bitte neu laden.' USING ERRCODE='40001'; END IF;
  next_revision:=e.revision+1;
  IF p_action='record_nrw_practice' THEN
   IF e.state IN ('completed','cancelled') THEN RAISE EXCEPTION 'Diese Teilnahme ist abgeschlossen oder beendet' USING ERRCODE='55000'; END IF;
   IF coalesce(p_data->>'kind','') NOT IN ('first_aid','presence') OR coalesce(p_data->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR length(btrim(coalesce(p_data->>'provider',''))) NOT BETWEEN 2 AND 200
    OR length(btrim(coalesce(p_data->>'reference',''))) NOT BETWEEN 2 AND 200
   THEN RAISE EXCEPTION 'Bitte Art, Datum, Anbieter und Aktenreferenz des Praxisnachweises angeben' USING ERRCODE='22023'; END IF;
   BEGIN practice_date:=(p_data->>'date')::date;
   EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RAISE EXCEPTION 'Ungültiges Datum des Praxisnachweises' USING ERRCODE='22023';
   END;
   IF practice_date>current_date OR (p_data->>'kind'='first_aid' AND practice_date<(current_date-interval '5 years')::date) THEN
    RAISE EXCEPTION 'Das Datum des Praxisnachweises liegt außerhalb des zulässigen Zeitraums' USING ERRCODE='22023';
   END IF;
   INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note)
    VALUES(p_record,actor,'nrw_practice',jsonb_build_object('kind',p_data->>'kind','date',practice_date,
     'provider',btrim(p_data->>'provider'),'reference',btrim(p_data->>'reference'))::text);
   UPDATE academy_private.enrollment_workspaces SET revision=next_revision WHERE enrollment_id=p_record;
  ELSIF p_action='unlock_nrw_exam' THEN
   note:=btrim(coalesce(p_data->>'note',''));
   SELECT count(*) INTO used FROM academy_private.quiz_attempts a WHERE a.enrollment_id=p_record AND a.lesson_id='nrw-final' AND NOT a.passed;
   SELECT 1+count(*) INTO allowance FROM academy_private.review_events WHERE enrollment_id=p_record AND action='nrw_retry';
   IF length(note) NOT BETWEEN 3 AND 4000 THEN RAISE EXCEPTION 'Bitte die Wiederholung begründen' USING ERRCODE='22023'; END IF;
   IF e.state NOT IN ('in_progress','returned') OR used<allowance OR EXISTS(
    SELECT 1 FROM academy_private.quiz_attempts a WHERE a.enrollment_id=p_record AND a.lesson_id='nrw-final' AND a.passed
   ) THEN RAISE EXCEPTION 'Eine Wiederholung ist nur nach einem nicht bestandenen Versuch möglich' USING ERRCODE='55000'; END IF;
   INSERT INTO academy_private.review_events(enrollment_id,actor_id,action,note) VALUES(p_record,actor,'nrw_retry',note);
   UPDATE academy_private.enrollment_workspaces SET revision=next_revision WHERE enrollment_id=p_record;
  ELSE
   IF e.state NOT IN ('in_progress','returned') THEN RAISE EXCEPTION 'Teilnahme ist für die Bearbeitung gesperrt' USING ERRCODE='55000'; END IF;
   IF p_action='save_nrw_exam_answer' THEN target_lesson:='nrw-final'; END IF;
   SELECT content INTO v FROM academy_private.course_versions WHERE id=e.version_id AND tenant_id=p_tenant;
   SELECT l INTO lesson FROM jsonb_array_elements(v->'lessons') l WHERE l->>'id'=target_lesson AND l->>'kind'='quiz';
   IF lesson IS NULL THEN RAISE EXCEPTION 'Wissenscheck gehört nicht zur zugewiesenen Fassung' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM academy_private.lesson_completions c WHERE c.enrollment_id=p_record AND c.lesson_id=target_lesson) THEN
    RAISE EXCEPTION 'Diese Prüfung wurde bereits bestanden' USING ERRCODE='55000';
   END IF;
   SELECT count(*) INTO used FROM academy_private.quiz_attempts a WHERE a.enrollment_id=p_record AND a.lesson_id=target_lesson;
   IF target_lesson='nrw-final' THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v->'lessons') l WHERE l->>'id'<>'nrw-final' AND NOT EXISTS(
      SELECT 1 FROM academy_private.lesson_completions c WHERE c.enrollment_id=p_record AND c.lesson_id=l->>'id'
    )) THEN RAISE EXCEPTION 'Bitte zuerst alle acht Module abschließen' USING ERRCODE='55000'; END IF;
    SELECT 1+count(*) INTO allowance FROM academy_private.review_events WHERE enrollment_id=p_record AND action='nrw_retry';
    IF used>=allowance THEN RAISE EXCEPTION 'Die Verwaltung muss einen weiteren Versuch freigeben' USING ERRCODE='55000'; END IF;
    questions:=academy_private.nrw_questions(v,p_record,used+1);
    SELECT d.answers INTO answers FROM academy_private.nrw_exam_drafts d WHERE d.enrollment_id=p_record AND d.attempt=used+1;
   ELSE
    questions:=lesson->'questions';
    answers:=p_data->'answers';
   END IF;
   IF p_action='save_nrw_exam_answer' THEN
    SELECT q INTO question FROM jsonb_array_elements(questions) q WHERE q->>'id'=p_data->>'questionId';
    selected:=p_data->>'optionId';
    IF question IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') o WHERE o->>'id'=selected)
    THEN RAISE EXCEPTION 'Diese Antwort gehört nicht zum aktuellen Prüfungsbogen' USING ERRCODE='22023'; END IF;
    answers:=coalesce(answers,'{}')||jsonb_build_object(question->>'id',selected);
    INSERT INTO academy_private.nrw_exam_drafts(enrollment_id,attempt,answers) VALUES(p_record,used+1,answers)
     ON CONFLICT(enrollment_id) DO UPDATE SET attempt=excluded.attempt,answers=excluded.answers;
    UPDATE academy_private.enrollment_workspaces SET revision=next_revision WHERE enrollment_id=p_record;
   ELSE
    IF jsonb_typeof(answers) IS DISTINCT FROM 'object'
      OR (SELECT count(*) FROM jsonb_object_keys(answers))<>jsonb_array_length(questions)
    THEN RAISE EXCEPTION 'Bitte zuerst alle Fragen beantworten und speichern' USING ERRCODE='22023'; END IF;
    FOR question IN SELECT value FROM jsonb_array_elements(questions) LOOP
     selected:=answers->>(question->>'id');
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(question->'options') o WHERE o->>'id'=selected) THEN
      RAISE EXCEPTION 'Ungültige oder fehlende Antwortoption' USING ERRCODE='22023';
     END IF;
     IF selected=question->>'correctOptionId' THEN correct:=correct+1; END IF;
    END LOOP;
    score:=floor(100.0*correct/jsonb_array_length(questions));
    passed:=CASE WHEN target_lesson='nrw-final' THEN score>=75 ELSE correct>=2 END;
    INSERT INTO academy_private.quiz_attempts(enrollment_id,lesson_id,attempt,answers,score,passed,actor_id)
     VALUES(p_record,target_lesson,used+1,answers,score,passed,actor);
    IF passed THEN
     INSERT INTO academy_private.lesson_completions(enrollment_id,lesson_id,actor_id) VALUES(p_record,target_lesson,actor);
    END IF;
    IF target_lesson='nrw-final' THEN DELETE FROM academy_private.nrw_exam_drafts WHERE enrollment_id=p_record; END IF;
    UPDATE academy_private.enrollment_workspaces SET revision=next_revision,
      state=CASE WHEN passed AND target_lesson='nrw-final' THEN 'submitted' ELSE 'in_progress' END,
      submitted_at=CASE WHEN passed AND target_lesson='nrw-final' THEN now() ELSE submitted_at END
     WHERE enrollment_id=p_record;
    UPDATE public.course_enrollments SET status='active',last_activity_at=now(),updated_at=now(),
      progress_percent=round(100.0*(SELECT count(*) FROM academy_private.lesson_completions c WHERE c.enrollment_id=p_record)/jsonb_array_length(v->'lessons'))
     WHERE id=p_record;
    result:=jsonb_build_object('score',score,'passed',passed);
   END IF;
  END IF;
 END IF;
 result:=result||jsonb_build_object('recordId',p_record,'revision',next_revision);
 INSERT INTO academy_private.requests(tenant_id,actor_id,request_id,digest,action,record_id,view_name,result)
  VALUES(p_tenant,actor,p_request,fingerprint,p_action,p_record,p_view,result);
 RETURN result;
END $$;

-- Keep the established Data API contract and make helper functions inaccessible.
REVOKE ALL ON FUNCTION academy_private.nrw_course_id(uuid),academy_private.nrw_content(),
 academy_private.nrw_questions(jsonb,uuid,integer),academy_private.nrw_practice(uuid),
 academy_private.nrw_certificate_snapshot(),academy_private.workspace_load(uuid,text),
 academy_private.workspace_mutate(uuid,text,text,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION academy_private.workspace_load(uuid,text),
 academy_private.workspace_mutate(uuid,text,text,uuid,uuid,integer,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.academy_workspace_load(p_tenant uuid,p_view text) RETURNS jsonb
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT academy_private.workspace_load(p_tenant,p_view) $$;
CREATE OR REPLACE FUNCTION public.academy_workspace_mutate(p_tenant uuid,p_view text,p_action text,p_request uuid,p_record uuid,p_revision integer,p_data jsonb) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT academy_private.workspace_mutate(p_tenant,p_view,p_action,p_request,p_record,p_revision,p_data) $$;
NOTIFY pgrst,'reload schema';
COMMIT;
