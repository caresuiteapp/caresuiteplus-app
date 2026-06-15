import type { WorkflowStatus } from '@/types';
import { getDemoResidentListItems } from './residents';
import { DEMO_TENANT_ID } from './tenant';

export type DailyStructureItem = {
  id: string;
  tenantId: string;
  timeSlot: string;
  activity: string;
  livingArea: string;
  participantCount: number;
  status: WorkflowStatus;
};

export type MealPlanItem = {
  id: string;
  tenantId: string;
  mealType: string;
  menu: string;
  dietaryNotes: string;
  servedAt: string;
  residentCount: number;
  status: WorkflowStatus;
};

export type ActivityPlanItem = {
  id: string;
  tenantId: string;
  title: string;
  facilitator: string;
  scheduledAt: string;
  location: string;
  participantCount: number;
  status: WorkflowStatus;
};

export type ResidentPlanningItem = {
  id: string;
  tenantId: string;
  residentName: string;
  roomNumber: string;
  careFocus: string;
  nextReviewAt: string;
  status: WorkflowStatus;
};

function buildDailyStructure(): DailyStructureItem[] {
  const slots = ['07:00', '09:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
  const activities = ['Morgenrunde', 'Frühstück', 'Mittagessen', 'Ruhephase', 'Therapie', 'Abendessen', 'Abendrunde'];
  return slots.map((timeSlot, i) => ({
    id: `ds-${i + 1}`,
    tenantId: DEMO_TENANT_ID,
    timeSlot,
    activity: activities[i]!,
    livingArea: ['Haus A', 'Haus B', 'Haus C'][i % 3]!,
    participantCount: 8 + i,
    status: 'aktiv',
  }));
}

function buildMeals(): MealPlanItem[] {
  const types = ['Frühstück', 'Mittagessen', 'Abendessen', 'Snack'];
  return Array.from({ length: 15 }, (_, i) => ({
    id: `meal-${String(i + 1).padStart(3, '0')}`,
    tenantId: DEMO_TENANT_ID,
    mealType: types[i % types.length]!,
    menu: ['Vollkornbrot & Käse', 'Kartoffelsuppe', 'Hähnchen & Gemüse', 'Obst & Joghurt'][i % 4]!,
    dietaryNotes: i % 3 === 0 ? 'Diabetiker-Variante verfügbar' : 'Standard',
    servedAt: new Date(Date.now() + i * 3600000).toISOString(),
    residentCount: 12 + (i % 8),
    status: 'aktiv',
  }));
}

function buildActivities(): ActivityPlanItem[] {
  const titles = ['Sitzgymnastik', 'Gedächtnistraining', 'Musikrunde', 'Basteln', 'Spaziergang', 'Kaffeerunde'];
  return titles.flatMap((title, ti) =>
    [0, 1].map((dup) => ({
      id: `act-${ti}-${dup}`,
      tenantId: DEMO_TENANT_ID,
      title,
      facilitator: 'Betreuungskraft Demo',
      scheduledAt: new Date(Date.now() + (ti * 2 + dup) * 86400000).toISOString(),
      location: ['Aula', 'Garten', 'Wohnzimmer'][ti % 3]!,
      participantCount: 4 + ti,
      status: 'aktiv',
    })),
  );
}

function buildPlanning(): ResidentPlanningItem[] {
  return getDemoResidentListItems().slice(0, 15).map((r, i) => ({
    id: `plan-${i + 1}`,
    tenantId: DEMO_TENANT_ID,
    residentName: `${r.firstName} ${r.lastName}`,
    roomNumber: r.roomName.replace(/[^0-9]/g, '') || `10${i + 1}`,
    careFocus: ['Mobilität', 'Ernährung', 'Kognition', 'Schmerz'][i % 4]!,
    nextReviewAt: new Date(Date.now() + (i + 7) * 86400000).toISOString(),
    status: r.status,
  }));
}

let dailyStore = buildDailyStructure();
let mealStore = buildMeals();
let activityStore = buildActivities();
let planningStore = buildPlanning();

export function getDemoDailyStructure(): DailyStructureItem[] {
  return dailyStore.map((d) => ({ ...d }));
}

export function getDemoMealPlans(): MealPlanItem[] {
  return mealStore.map((m) => ({ ...m }));
}

export function getDemoActivityPlans(): ActivityPlanItem[] {
  return activityStore.map((a) => ({ ...a }));
}

export function getDemoResidentPlanning(): ResidentPlanningItem[] {
  return planningStore.map((p) => ({ ...p }));
}
