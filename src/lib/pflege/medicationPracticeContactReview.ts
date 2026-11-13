import type { PracticeLocationOption } from './medicationMasterData';

const wellbrockReview = {
  // Exact OSM record (node 14178266801) in the imported snapshot. Never match on a person's name alone.
  id: '8ed2d099-239c-4d09-a9b4-5b9441fc1e04',
  sourceVersion: '2026-11-12',
  contactSourceUrl: 'https://www.praxis-wellbrock.de/index.php/kontakt.html',
  postalCode: '44623',
  street: 'Schaeferstraße 31',
  phone: '02323 51913',
} as const;

/** Supplements the reviewed snapshot row; the imported source and its timestamp are retained. */
export function addReviewedPracticeContact(practice: PracticeLocationOption): PracticeLocationOption {
  if (practice.source !== 'osm-de-praxis' || practice.sourceVersion !== wellbrockReview.sourceVersion ||
      practice.id !== wellbrockReview.id || practice.stateCode !== 'DE-NW' || practice.city !== 'Herne') return practice;

  const postalCode = practice.postalCode ?? wellbrockReview.postalCode;
  const street = practice.street ?? wellbrockReview.street;
  const phone = practice.phone ?? wellbrockReview.phone;
  if (postalCode === practice.postalCode && street === practice.street && phone === practice.phone) return practice;
  return { ...practice, postalCode, street, phone, contactSourceUrl: wellbrockReview.contactSourceUrl };
}
