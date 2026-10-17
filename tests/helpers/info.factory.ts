import { Info } from '@prisma/client';

export function buildInfo(overrides: Partial<Info> = {}): Info {
  return {
    id: 'info-1',
    tripId: 'trip-1',
    type: 'flight',
    title: 'Aegean Airlines',
    description: null,
    date: new Date('2026-03-15'),
    details: { origin: 'GRU', destination: 'JTR', time: '06:30', flightNumber: 'A3 1234' },
    ...overrides,
  };
}
