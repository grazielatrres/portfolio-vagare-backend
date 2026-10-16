import { Activity } from '@prisma/client';

export function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-1',
    tripId: 'trip-1',
    name: 'Fira – Centro Histórico',
    date: new Date('2026-09-02'),
    time: null,
    location: null,
    period: 'manha',
    category: 'Passeio guiado',
    estimatedCost: null,
    description: null,
    ...overrides,
  };
}
