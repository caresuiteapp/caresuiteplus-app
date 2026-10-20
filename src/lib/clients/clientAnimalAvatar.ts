export const CLIENT_ANIMAL_AVATAR_VARIANT_COUNT = 2_000;

export const CLIENT_ANIMAL_SPECIES = [
  'Rotfuchs', 'Polarfuchs', 'Fennek', 'Wolf', 'Kojote', 'Dingo', 'Haushund', 'Goldschakal', 'Mähnenwolf', 'Löffelhund',
  'Hauskatze', 'Löwe', 'Tiger', 'Leopard', 'Jaguar', 'Gepard', 'Schneeleopard', 'Luchs', 'Puma', 'Karakal',
  'Braunbär', 'Eisbär', 'Panda', 'Brillenbär', 'Schwarzbär', 'Waschbär', 'Nasenbär', 'Otter', 'Dachs', 'Honigdachs',
  'Vielfraß', 'Marder', 'Frettchen', 'Hermelin', 'Stinktier', 'Manguste', 'Erdmännchen', 'Zobel', 'Nerz', 'Wickelbär',
  'Gorilla', 'Schimpanse', 'Orang-Utan', 'Bonobo', 'Mandrill', 'Pavian', 'Katta', 'Kapuzineraffe', 'Totenkopfaffe', 'Gibbon',
  'Japanmakak', 'Goldstumpfnase', 'Brüllaffe', 'Tamarin', 'Seidenäffchen', 'Nasenaffe', 'Plumplori', 'Koboldmaki', 'Gelada', 'Colobusaffe',
  'Elefant', 'Nashorn', 'Nilpferd', 'Giraffe', 'Zebra', 'Okapi', 'Kamel', 'Dromedar', 'Alpaka', 'Lama',
  'Pferd', 'Esel', 'Tapir', 'Elch', 'Rentier', 'Rothirsch', 'Reh', 'Gazelle', 'Antilope', 'Steinbock',
  'Hase', 'Kaninchen', 'Maus', 'Ratte', 'Hamster', 'Meerschweinchen', 'Chinchilla', 'Eichhörnchen', 'Murmeltier', 'Biber',
  'Stachelschwein', 'Capybara', 'Koala', 'Wombat', 'Känguru', 'Wallaby', 'Opossum', 'Quokka', 'Gürteltier', 'Faultier',
  'Adler', 'Falke', 'Habicht', 'Eule', 'Uhu', 'Rabe', 'Krähe', 'Elster', 'Papagei', 'Kakadu',
  'Tukan', 'Flamingo', 'Pfau', 'Pinguin', 'Schwan', 'Ente', 'Gans', 'Huhn', 'Küken', 'Strauß',
  'Kolibri', 'Eisvogel', 'Rotkehlchen', 'Spatz', 'Amsel', 'Specht', 'Pelikan', 'Albatros', 'Kranich', 'Storch',
  'Möwe', 'Papageitaucher', 'Kiwi', 'Emu', 'Kasuar', 'Fasan', 'Wachtel', 'Taube', 'Kanarienvogel', 'Blaumeise',
  'Delfin', 'Orca', 'Blauwal', 'Buckelwal', 'Narwal', 'Beluga', 'Seehund', 'Seelöwe', 'Walross', 'Seekuh',
  'Hai', 'Hammerhai', 'Walhai', 'Rochen', 'Mantarochen', 'Clownfisch', 'Kugelfisch', 'Seepferdchen', 'Oktopus', 'Kalmar',
  'Meeresschildkröte', 'Landschildkröte', 'Krokodil', 'Alligator', 'Komodowaran', 'Leguan', 'Chamäleon', 'Gecko', 'Schlange', 'Kobra',
  'Python', 'Axolotl', 'Salamander', 'Molch', 'Laubfrosch', 'Pfeilgiftfrosch', 'Kröte', 'Kaiman', 'Tuatara', 'Basilisk',
  'Schmetterling', 'Hummel', 'Honigbiene', 'Marienkäfer', 'Libelle', 'Gottesanbeterin', 'Heuschrecke', 'Hirschkäfer', 'Nashornkäfer', 'Schnecke',
  'Schwein', 'Kuh', 'Ziege', 'Schaf', 'Büffel', 'Yak', 'Igel', 'Maulwurf', 'Ameisenbär', 'Schnabeltier',
] as const;

export const CLIENT_ANIMAL_PALETTES = [
  { colors: ['#0B78F0', '#45D6FF'] as const, label: 'Ozeanblau' },
  { colors: ['#6D3AF2', '#CE7CFF'] as const, label: 'Violett' },
  { colors: ['#008B72', '#55E6BC'] as const, label: 'Minze' },
  { colors: ['#E26716', '#FFC857'] as const, label: 'Sonnengold' },
  { colors: ['#D6336C', '#FF8DB5'] as const, label: 'Himbeere' },
  { colors: ['#2558C7', '#91B7FF'] as const, label: 'Königsblau' },
  { colors: ['#7C4A2D', '#D99A62'] as const, label: 'Karamell' },
  { colors: ['#087F8C', '#7DE2D1'] as const, label: 'Lagune' },
  { colors: ['#B54708', '#FFB86B'] as const, label: 'Mandarine' },
  { colors: ['#334155', '#94A3B8'] as const, label: 'Nachtgrau' },
] as const;

export type ClientAnimalAvatarProfile = {
  variantIndex: number;
  speciesIndex: number;
  animal: (typeof CLIENT_ANIMAL_SPECIES)[number];
  palette: (typeof CLIENT_ANIMAL_PALETTES)[number];
  signature: string;
};

function stableClientHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getClientAnimalAvatarByIndex(index: number): ClientAnimalAvatarProfile {
  const variantIndex = ((Math.trunc(index) % CLIENT_ANIMAL_AVATAR_VARIANT_COUNT)
    + CLIENT_ANIMAL_AVATAR_VARIANT_COUNT) % CLIENT_ANIMAL_AVATAR_VARIANT_COUNT;
  const speciesIndex = variantIndex % CLIENT_ANIMAL_SPECIES.length;
  const paletteIndex = Math.floor(variantIndex / CLIENT_ANIMAL_SPECIES.length)
    % CLIENT_ANIMAL_PALETTES.length;
  const animal = CLIENT_ANIMAL_SPECIES[speciesIndex];
  const palette = CLIENT_ANIMAL_PALETTES[paletteIndex];

  return {
    variantIndex,
    speciesIndex,
    animal,
    palette,
    signature: `${animal}:${palette.label}`,
  };
}

/** Stable, offline and tenant-safe fallback avatar; no personal data leaves the app. */
export function resolveClientAnimalAvatar(clientId: string): ClientAnimalAvatarProfile {
  return getClientAnimalAvatarByIndex(stableClientHash(clientId.trim() || 'client'));
}
