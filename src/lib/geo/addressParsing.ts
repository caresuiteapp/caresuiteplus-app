/** Parsed German address fields for client intake and similar forms. */
export type GermanAddressFields = {
  street: string;
  houseNumber: string;
  zip: string;
  city: string;
};

export type AddressSuggestion = GermanAddressFields & {
  id: string;
  label: string;
};

type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  osm_key?: string;
  osm_value?: string;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  locality?: string;
  district?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  type?: string;
};

type PhotonFeature = {
  type: 'Feature';
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
};

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

const HOUSE_NUMBER_SUFFIX = /^(\d[\d/a-zA-Z\-]*?)$/;

/** Splits a combined street line like "Musterstraße 12a" into street + house number. */
export function splitStreetAndHouseNumber(line: string): Pick<GermanAddressFields, 'street' | 'houseNumber'> {
  const trimmed = line.trim();
  if (!trimmed) return { street: '', houseNumber: '' };

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1] ?? '';
    if (HOUSE_NUMBER_SUFFIX.test(last)) {
      return {
        street: parts.slice(0, -1).join(' '),
        houseNumber: last,
      };
    }
  }

  return { street: trimmed, houseNumber: '' };
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function buildLabel(fields: GermanAddressFields): string {
  const streetLine = [fields.street, fields.houseNumber].filter(Boolean).join(' ').trim();
  const locality = [fields.zip, fields.city].filter(Boolean).join(' ').trim();
  if (streetLine && locality) return `${streetLine}, ${locality}`;
  return streetLine || locality;
}

function resolvePhotonStreet(props: PhotonProperties): string {
  const street = props.street?.trim();
  if (street) return street;

  const name = props.name?.trim() ?? '';
  if (!name) return '';

  const cityLike = firstNonEmpty(props.city, props.locality, props.district);
  if (name === cityLike || props.type === 'city' || props.type === 'locality') return '';

  if (props.housenumber && name.includes(props.housenumber)) {
    return splitStreetAndHouseNumber(name).street;
  }

  return name;
}

function resolvePhotonCity(props: PhotonProperties): string {
  return firstNonEmpty(props.city, props.locality, props.district);
}

/** Maps a Photon (Komoot/OSM) feature to German address form fields. */
export function parsePhotonFeature(feature: PhotonFeature, index = 0): AddressSuggestion | null {
  const props = feature.properties;
  if (!props) return null;
  if (props.countrycode && props.countrycode.toUpperCase() !== 'DE') return null;

  let street = resolvePhotonStreet(props);
  let houseNumber = props.housenumber?.trim() ?? '';

  if (!street && props.name?.trim()) {
    const split = splitStreetAndHouseNumber(props.name);
    street = split.street;
    houseNumber = houseNumber || split.houseNumber;
  }

  if (!houseNumber && street) {
    const split = splitStreetAndHouseNumber(street);
    if (split.houseNumber) {
      street = split.street;
      houseNumber = split.houseNumber;
    }
  }

  const zip = props.postcode?.trim() ?? '';
  const city = resolvePhotonCity(props);

  if (!street && !zip && !city) return null;

  const fields: GermanAddressFields = { street, houseNumber, zip, city };
  const osmId = props.osm_id ?? index;

  return {
    ...fields,
    id: `photon-${props.osm_type ?? 'node'}-${osmId}-${index}`,
    label: buildLabel(fields),
  };
}

/** Maps Google Places address_components to German address form fields. */
export function parseGoogleAddressComponents(components: GoogleAddressComponent[]): GermanAddressFields {
  const byType = (type: string) =>
    components.find((component) => component.types.includes(type))?.long_name?.trim() ?? '';

  const route = byType('route');
  const streetNumber = byType('street_number');
  const premise = byType('premise');
  const subpremise = byType('subpremise');

  let street = route;
  let houseNumber = [streetNumber, subpremise].filter(Boolean).join(' ').trim();

  if (!street && premise) {
    const split = splitStreetAndHouseNumber(premise);
    street = split.street;
    houseNumber = houseNumber || split.houseNumber;
  }

  const zip = byType('postal_code');
  const city = firstNonEmpty(
    byType('locality'),
    byType('postal_town'),
    byType('administrative_area_level_3'),
    byType('administrative_area_level_2'),
  );

  return { street, houseNumber, zip, city };
}

export function formatAddressSuggestionLabel(fields: GermanAddressFields): string {
  return buildLabel(fields);
}

export function dedupeAddressSuggestions(suggestions: AddressSuggestion[]): AddressSuggestion[] {
  const seen = new Set<string>();
  const unique: AddressSuggestion[] = [];

  for (const suggestion of suggestions) {
    const key = [
      suggestion.street.toLowerCase(),
      suggestion.houseNumber.toLowerCase(),
      suggestion.zip,
      suggestion.city.toLowerCase(),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(suggestion);
  }

  return unique;
}

export type { PhotonFeature };
