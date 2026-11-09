import AsyncStorage from '@react-native-async-storage/async-storage';

const messages = [
  'Die Frage nach der Lieblingssorte lässt jemanden den Einkauf mitbestimmen.',
  'Ein Spaziergang im eigenen Tempo lässt Raum für Gespräche, die drinnen oft keinen Platz finden.',
  'Manchmal beginnt ein guter Besuch damit, die Tasche abzustellen und erst einmal zuzuhören.',
  'Ein vertrautes Rezept gemeinsam zuzubereiten kann Erinnerungen wecken und Lust aufs Mitmachen machen.',
  'Die Entscheidung, was heute auf den Tisch kommt, gehört zu den kleinen Freiheiten des Alltags.',
  'Wer eine Frage ausreden lässt, gibt dem Gegenüber Zeit für eine eigene Antwort.',
  'Ein gemeinsamer Blick in den Kalender kann aus einem vollen Tag einen überschaubaren Plan machen.',
  'Die Bank vor dem Haus kann das richtige Ziel für einen guten Spaziergang sein.',
  'Wenn jemand die Einkaufsliste selbst diktiert, gestaltet er den Besuch von Anfang an mit.',
  'Eine Frage nach dem Lieblingsplatz im Viertel kann einen vertrauten Weg wieder ins Gespräch bringen.',
  'Auch beim Wäschefalten kann ein Gespräch entstehen, für das sonst selten Zeit bleibt.',
  'Ein bekannter Handgriff, den jemand wieder selbst übernimmt, kann Mut für den nächsten machen.',
  'Eine verlässliche Ankunft schafft Raum, den Besuch in Ruhe zu beginnen.',
  'Wer gemeinsam mit einer Person plant, lernt oft, was ihr an diesem Tag wirklich wichtig ist.',
  'Ein kleiner Umweg an einem vertrauten Ort kann einem Spaziergang eine persönliche Richtung geben.',
  'Ein Anruf, den jemand mit Ihrer Unterstützung selbst führt, kann eine Verbindung wieder stärken.',
  'Eine Teepause zur richtigen Zeit macht Platz für Dinge, die zwischen zwei Aufgaben leicht untergehen.',
  'Eine Geschichte darf länger dauern als der Handgriff, bei dem sie erzählt wird.',
  'Wer vor dem Aufräumen fragt, wohin etwas gehört, achtet die vertraute Ordnung eines anderen Menschen.',
  'Der Lieblingsbecher am richtigen Platz zeigt, dass Sie sich an ein persönliches Detail erinnern.',
  'Eine gemeinsam erledigte Besorgung kann den Mut wecken, einen vertrauten Weg bald wieder selbst zu gehen.',
  'Wenn jemand beim Backen die Reihenfolge vorgibt, wird aus Unterstützung ein gemeinsames Tun.',
  'Schon die Frage nach dem passenden Tempo kann einen Weg angenehmer machen.',
  'Ein Brief lässt sich leichter öffnen, wenn jemand bei schwierigen Worten geduldig dabeibleibt.',
  'Wer sich beim Besuch an ein früheres Gespräch erinnert, zeigt, dass die erzählte Geschichte angekommen ist.',
  'Die Wahl zwischen zwei gut erklärten Möglichkeiten kann eine Entscheidung leichter machen.',
  'Manchmal ist es genug, eine Weile am Fenster zu sitzen und das Gespräch von selbst beginnen zu lassen.',
  'Ein kleiner Einkauf kann sich gut anfühlen, wenn jemand den eigenen Korb mit vertrauten Dingen füllt.',
  'Die Frage nach einem Wunsch für den Nachmittag gibt dem Tag eine persönliche Richtung.',
  'Eine Pause auf halbem Weg kann dafür sorgen, dass der restliche Spaziergang wieder Freude macht.',
  'Wer den nächsten Schritt mit der begleiteten Person abspricht, gibt ihr Raum für eigene Ideen.',
  'Aus einem leisen Guten Morgen kann ein vertrauter Beginn werden, wenn sich jemand auf den Besuch freuen darf.',
];

// Keep this block's lengths and order stable so saved positions still refer to the same sentences.
const moments = [
  'Bei einem Besuch zu Hause',
  'Beim gemeinsamen Einkauf',
  'Vor dem nächsten Spaziergang',
  'Beim Planen der Woche',
  'An einem ruhigen Vormittag',
  'Beim Lesen der Post',
  'Auf einem vertrauten Weg',
  'Beim Vorbereiten einer Mahlzeit',
  'Bei einer Pause am Fenster',
  'Beim Start in einen vollen Tag',
  'Beim Gang zum Briefkasten',
  'Bei der Rückkehr nach Hause',
  'An einem ungewohnt stillen Tag',
  'Bei einem Treffen im Viertel',
  'Beim Abschied an der Haustür',
  'Bei der Begrüßung am Morgen',
  'Beim Einräumen der Einkäufe',
  'Vor einem Besuch im Café',
  'Beim Sortieren von Unterlagen',
  'Bei einer Besorgung im Viertel',
  'Beim Blick auf die Woche',
  'Bei einer Tasse Tee',
  'Auf dem Weg zu einem Termin',
  'Beim Zubereiten des Frühstücks',
  'Beim Warten auf den Bus',
  'Bei einer kleinen Pause unterwegs',
  'Beim Wiedersehen nach einigen Tagen',
  'Vor einem gemeinsam geplanten Nachmittag',
  'Beim Besuch eines vertrauten Ortes',
  'Beim Wechsel von einer Aufgabe zur nächsten',
  'Beim Erinnern an einen schönen Ausflug',
  'Am Ende eines gemeinsamen Besuchs',
  'Wenn ein Besuch gerade beginnt,',
  'Wenn der Tag unübersichtlich wird,',
  'Wenn ein vertrauter Ablauf sich ändert,',
  'Wenn jemand seine Kräfte einteilen möchte,',
  'Wenn für eine Entscheidung noch Zeit gebraucht wird,',
  'Wenn ein Weg anstrengender ist als gedacht,',
  'Wenn jemand von früher erzählen möchte,',
  'Wenn sich ein Plan kurzfristig ändert,',
  'Wenn ein Termin näher rückt,',
  'Wenn jemand gern selbst mithelfen möchte,',
  'Wenn der nächste Schritt noch offen ist,',
  'Wenn jemand sich über Gesellschaft freut,',
  'Wenn eine Aufgabe heute schwerer fällt,',
  'Wenn jemand einen Wunsch erst in Worte fassen muss,',
  'Wenn jemand nach einer Pause weitermachen möchte,',
  'Wenn eine neue Woche beginnt,',
];
const gestures = [
  'ein aufmerksames Gespräch',
  'eine kurze Rückfrage',
  'ein gemeinsam vereinbarter nächster Schritt',
  'eine Pause im eigenen Tempo',
  'ein freundlicher Blick',
  'eine ruhige Erklärung',
  'eine Absprache über den weiteren Ablauf',
  'ein Moment zum Nachdenken',
  'ein Angebot zum Mitmachen',
  'ein offenes Ohr für Wünsche',
  'eine Frage nach den Gewohnheiten',
  'ein kurzer Blick auf das, was schon gelungen ist,',
  'eine vertraute Begrüßung',
  'ein Gespräch über den heutigen Plan',
  'eine gut erklärte Wahlmöglichkeit',
  'ein Vorschlag, über den gemeinsam entschieden wird,',
  'eine Pause zum Ankommen',
  'ein aufrichtiges Interesse an der eigenen Sicht der Person',
  'eine Rückfrage zum passenden Tempo',
  'ein ruhiges Wort am Anfang',
  'ein Handgriff, den die Person selbst übernimmt,',
  'eine Einladung zum Erzählen',
  'ein Beispiel aus dem vertrauten Alltag',
  'eine Minute für eine eigene Antwort',
  'ein Blick auf das, was der Person heute wichtig ist,',
  'eine Frage nach einer vertrauten Lösung',
  'eine kleine Aufgabe, die gemeinsam begonnen wird,',
  'eine Abmachung, an die sich beide halten können,',
  'eine freundliche Erinnerung an eine frühere Absprache',
  'ein Gespräch über persönliche Vorlieben',
  'ein Angebot, eine Sache zusammen auszuprobieren,',
  'ein Moment, in dem niemand drängt,',
  'ein klares Ja zu einem geäußerten Wunsch',
  'eine kurze Zeit zum Durchatmen',
  'eine Entscheidung über die Reihenfolge der Aufgaben',
  'ein verständlicher Hinweis auf den nächsten Schritt',
  'eine Nachfrage nach dem, was die Person gern selbst macht,',
  'eine kleine Anpassung an den gewohnten Rhythmus',
  'eine Einladung, selbst einen Vorschlag zu machen,',
  'ein Rückblick auf einen guten gemeinsamen Moment',
  'ein warmer Ton im Gespräch',
  'eine Frage nach der angenehmsten Möglichkeit',
  'ein Zeichen dafür, dass ein Wunsch gehört wurde,',
  'ein gemeinsamer Blick auf die nächsten Möglichkeiten',
  'ein verständlicher Satz zur richtigen Zeit',
  'eine Absprache darüber, was heute Vorrang hat,',
  'ein kurzer Dank für einen eigenen Beitrag',
  'eine Frage danach, was den Tag leichter machen würde,',
];
const effects = [
  'einen nächsten Schritt leichter machen',
  'Vertrauen für den weiteren Besuch schaffen',
  'Raum für eine eigene Entscheidung lassen',
  'den Einstieg in ein Gespräch erleichtern',
  'Mut zum Mitmachen geben',
  'eine vertraute Gewohnheit wieder in den Alltag bringen',
  'den Tag ein wenig überschaubarer machen',
  'zeigen, dass persönliche Wünsche zählen',
  'jemandem Zeit geben, sich zu orientieren',
  'die Freude an einer vertrauten Aufgabe stärken',
  'dazu beitragen, dass ein Wunsch zur Sprache kommt',
  'Ruhe in einen unübersichtlichen Moment bringen',
  'dabei helfen, das passende Tempo zu finden',
  'die Selbstständigkeit bei einer kleinen Entscheidung stärken',
  'ein Gespräch ohne Eile möglich machen',
  'Zuversicht für eine bevorstehende Aufgabe geben',
  'helfen, einen eigenen Beitrag zu finden',
  'dem gemeinsamen Plan eine persönliche Richtung geben',
  'das Ankommen in der Situation erleichtern',
  'Platz für einen Gedanken lassen, der noch Zeit braucht',
  'eine Erinnerung an einen vertrauten Ablauf wecken',
  'zeigen, dass Unterstützung an den Wünschen der Person ansetzt',
  'den Mut stärken, etwas wieder selbst zu versuchen',
  'ein Gefühl von Verlässlichkeit geben',
  'den Überblick über die nächsten Aufgaben erleichtern',
  'dabei helfen, einen Plan gemeinsam anzupassen',
  'eine kleine Aufgabe wieder machbar erscheinen lassen',
  'jemandem Gelegenheit geben, selbst etwas vorzuschlagen',
  'eine vertraute Art der Begegnung ermöglichen',
  'den Besuch stärker an persönlichen Vorlieben ausrichten',
  'etwas Anspannung aus dem Moment nehmen',
  'die Freude an einem gemeinsamen Vorhaben wecken',
  'Platz für eine Pause im gewohnten Rhythmus schaffen',
  'dabei helfen, einen Wunsch genauer zu verstehen',
  'jemandem zeigen, dass sein Beitrag willkommen ist',
  'eine gute Grundlage für den nächsten Besuch schaffen',
  'die Entscheidung über den weiteren Ablauf erleichtern',
  'helfen, eine Aufgabe in kleinere Schritte zu teilen',
  'die Verbindung zu einem vertrauten Ort stärken',
  'jemandem den Einstieg ins eigene Tun erleichtern',
  'einen guten Moment für ein Gespräch schaffen',
  'den Blick auf das lenken, was heute gut möglich ist',
  'dazu beitragen, dass beide dieselbe Absprache im Kopf behalten',
  'das Zutrauen in die eigenen Fähigkeiten stärken',
  'eine freundliche Begegnung aus einer alltäglichen Aufgabe machen',
  'Raum für das lassen, was jemand selbst erzählen möchte',
  'eine Veränderung im Tagesablauf leichter annehmbar machen',
  'jemandem helfen, sein gewohntes Tempo beizubehalten',
];

export const employeePortalMotivationCount = messages.length + moments.length * gestures.length * effects.length;

export function employeePortalMotivationAt(index: number, owner = ''): string | null {
  if (!Number.isSafeInteger(index) || index < 0 || index >= employeePortalMotivationCount) return null;
  let offset = 0;
  for (const character of owner) offset = (Math.imul(offset, 31) + character.charCodeAt(0)) >>> 0;
  // An odd stride reaches each of the 32 individually written lines once.
  if (index < messages.length) return messages[(index * 17 + offset) % messages.length];

  const variant = (index - messages.length + offset) % (employeePortalMotivationCount - messages.length);
  const gesture = variant % gestures.length;
  // Rotate the other parts at each step while visiting each combination once.
  const effect = (Math.floor(variant / gestures.length) + gesture * 5) % effects.length;
  const moment = (Math.floor(variant / (gestures.length * effects.length)) + gesture * 7 + effect * 3) % moments.length;
  return `${moments[moment]} kann ${gestures[gesture]} ${effects[effect]}.`;
}

const localPositions = new Map<string, number>();
let queue = Promise.resolve<unknown>(undefined);

export function nextEmployeePortalMotivation(owner: string): Promise<string | null> {
  const key = `caresuite.employee-portal.motivation.v1.${encodeURIComponent(owner)}`;
  const takeNext = async () => {
    const saved = Number(await AsyncStorage.getItem(key).catch(() => null));
    const position = Math.max(localPositions.get(key) ?? 0, Number.isSafeInteger(saved) ? saved : 0);
    const message = employeePortalMotivationAt(position, owner);
    if (message) {
      localPositions.set(key, position + 1);
      await AsyncStorage.setItem(key, String(position + 1)).catch(() => {});
    }
    return message;
  };
  const next = queue.then(() => {
    // Serialize native requests in this runtime and browser requests across tabs.
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    return locks ? locks.request(key, takeNext).catch(takeNext) : takeNext();
  }).catch(() => null);
  queue = next;
  return next;
}
