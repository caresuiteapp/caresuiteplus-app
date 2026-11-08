const dailyNotes = [
  ...[
    'Fangen Sie mit dem an, was heute am meisten hilft. Der Rest darf kurz warten.',
    'Ein freundlicher Satz kann jemanden noch lange nach dem Einsatz begleiten.',
    'Wer gut zuhört, merkt oft früher, was gerade gebraucht wird.',
    'Auch ein ruhiger Tag hat Aufgaben, die für jemanden einen großen Unterschied machen.',
    'Eine klare Rückfrage spart oft mehr Zeit als eine schnelle Vermutung.',
    'Die Pause gehört zum Arbeitstag. Nehmen Sie sich die Minuten, wenn es passt.',
    'Eine gute Übergabe beginnt mit dem, was die nächste Person wissen muss.',
    'Ein klarer erster Schritt reicht, um auch in einen vollen Tag zu starten.',
    'Ein kurzes Danke kommt bei Kolleg:innen oft genau im richtigen Moment an.',
    'Wer früh um Unterstützung bittet, lässt dem Team Zeit zu helfen.',
    'Zwei Minuten zum Sortieren können den ganzen Vormittag erleichtern.',
    'Sich an eine kleine Vorliebe zu erinnern, ist manchmal die beste Aufmerksamkeit.',
    'Am Ende des Tages zählt auch, was Sie jemandem leichter gemacht haben.',
    'Schreiben Sie einen guten Moment des Tages auf. Den Rest hält der Kalender fest.',
    'Eine Frage zur richtigen Zeit ist oft hilfreicher als drei gut gemeinte Ratschläge.',
    'Beginnen Sie bei der nächsten Aufgabe. Die ganze Liste muss heute Morgen noch nicht fertig sein.',
    'Eine freundliche Begrüßung ist ein kleiner Aufwand mit langer Wirkung.',
    'Ein Glas Wasser und einmal tief durchatmen sind ein brauchbarer Neustart.',
    'Gute Arbeit wird oft an Dingen sichtbar, die für andere plötzlich einfacher sind.',
    'Wenn alles gleichzeitig ruft, hilft eine Reihenfolge.',
    'Feierabend beginnt leichter, wenn der erste Schritt für morgen schon feststeht.',
    'Planen Sie bei einem vollen Tag auch einen Moment ohne Plan ein.',
    'Ein wenig Ruhe im Gespräch gibt der anderen Person Zeit, ihren Gedanken zu Ende zu bringen.',
    'Wer sich einen Handgriff zeigen lässt, kann ihn beim nächsten Mal selbst übernehmen.',
  ].map(text => ({ kind: 'impulse' as const, text })),
  ...[
    'Was macht ein Kalender nach Feierabend? Er klappt zu.',
    'Warum ist der Bleistift so gelassen? Er hat einen Radiergummi.',
    'Was sagt die Uhr zur Kaffeetasse? Für dich habe ich immer Zeit.',
    'Was sagt ein Stift, wenn ihm etwas gefällt? Das zeichnet sich ab.',
    'Wie nennt man einen Keks unter einem Baum? Ein schattiges Plätzchen.',
    'Was macht ein Pinguin im Büro? Er hält die Akten kühl.',
    'Was sagt der Fahrstuhl zur Treppe? Ich bin gleich oben.',
    'Warum mag der Frosch das WLAN? Weil er gern im Netz quakt.',
    'Was sagt das Komma zum Punkt? Warte, ich bin noch nicht fertig.',
    'Warum schaut der Pilz so ernst? Er hat einen vollen Hut.',
    'Was macht ein Buch im Urlaub? Es schlägt ein neues Kapitel auf.',
    'Was sagt der Ordner zum losen Blatt? Bei mir hast du einen festen Platz.',
    'Warum sitzt der Keks am Schreibtisch? Er krümelt sich vor Arbeit.',
    'Was hat der Baum im Kalender stehen? Einen Termin zum Ausschlagen.',
    'Was sagt der Schlüssel zum Schloss? Wir sollten öfter zusammen abschließen.',
    'Warum geht der Teebeutel so früh ins Büro? Er möchte in Ruhe ziehen.',
  ].map(text => ({ kind: 'joke' as const, text })),
];

function shuffledNotes(cycle: number) {
  const notes = [...dailyNotes];
  let seed = cycle;
  for (let index = notes.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    const other = Math.floor((seed / 2 ** 32) * (index + 1));
    [notes[index], notes[other]] = [notes[other], notes[index]];
  }
  return notes;
}

/** Shuffle once per cycle by calendar day so refresh and module changes preserve today's note. */
export function employeePortalDailyNote(now: Date) {
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  const cycle = Math.floor(day / dailyNotes.length);
  const position = day - cycle * dailyNotes.length;
  const notes = shuffledNotes(cycle);
  // The previous cycle's last note is unaffected by swapping the first two notes.
  const repeatsYesterday = position < 2 && notes[0] === shuffledNotes(cycle - 1)[notes.length - 1];
  return notes[repeatsYesterday ? 1 - position : position];
}
