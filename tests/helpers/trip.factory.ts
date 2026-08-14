import { Trip } from '@prisma/client';

type TripFactoryOverrides = Partial<Trip> & {
  numberOfPeople?: number | null;
};

export function buildTrip(overrides: TripFactoryOverrides = {}): Trip {
  const now = new Date();
  return {
    id: 'trip-1',
    userId: 'user-1',
    name: 'Férias em Florença',
    destination: 'Florença, Itália',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-10'),
    budget: null,
    numberOfPeople: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
