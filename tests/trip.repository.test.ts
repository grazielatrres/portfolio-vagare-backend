// trip.repository.test.ts — RF08, RN01, RN10

import { Trip } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { TripRepository } from '../src/repositories/trip.repository';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    trip: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prismaTrip = prisma.trip as unknown as {
  create: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  const now = new Date();
  return {
    id: 'trip-1',
    userId: 'user-1',
    name: 'Férias em Florença',
    destination: 'Florença, Itália',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-10'),
    budget: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('TripRepository', () => {
  const repository = new TripRepository();
  const userId = 'user-1';
  const otherUserId = 'user-2';

  describe('create', () => {
    it('cria viagem vinculando obrigatoriamente o userId', async () => {
      const data = {
        name: 'Férias em Florença',
        destination: 'Florença, Itália',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-09-10'),
        budget: 5000,
      };
      const created = buildTrip({ budget: data.budget as unknown as Trip['budget'] });
      prismaTrip.create.mockResolvedValue(created);

      const result = await repository.create(userId, data);

      expect(prismaTrip.create).toHaveBeenCalledWith({
        data: {
          userId,
          name: data.name,
          destination: data.destination,
          startDate: data.startDate,
          endDate: data.endDate,
          budget: data.budget,
        },
      });
      expect(result.userId).toBe(userId);
    });
  });

  describe('findAllByUser', () => {
    it('lista apenas viagens filtradas pelo userId', async () => {
      const trips = [buildTrip(), buildTrip({ id: 'trip-2' })];
      prismaTrip.findMany.mockResolvedValue(trips);

      const result = await repository.findAllByUser(userId);

      expect(prismaTrip.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { startDate: 'asc' },
      });
      expect(result).toEqual(trips);
    });
  });

  describe('findByIdAndUser', () => {
    it('busca viagem por id e userId juntos', async () => {
      const trip = buildTrip();
      prismaTrip.findFirst.mockResolvedValue(trip);

      const result = await repository.findByIdAndUser('trip-1', userId);

      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', userId },
      });
      expect(result).toEqual(trip);
    });

    it('retorna null quando a viagem não existe ou não pertence ao usuário', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdAndUser('trip-1', otherUserId);

      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', userId: otherUserId },
      });
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('atualiza somente se a viagem pertencer ao userId', async () => {
      const existing = buildTrip();
      const updated = buildTrip({ name: 'Toscana 2026' });
      prismaTrip.findFirst.mockResolvedValue(existing);
      prismaTrip.update.mockResolvedValue(updated);

      const result = await repository.update('trip-1', userId, { name: 'Toscana 2026' });

      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', userId },
      });
      expect(prismaTrip.update).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
        data: { name: 'Toscana 2026' },
      });
      expect(result).toEqual(updated);
    });

    it('não chama update e retorna null se a viagem não pertencer ao usuário', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const result = await repository.update('trip-1', otherUserId, { name: 'Hack' });

      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', userId: otherUserId },
      });
      expect(prismaTrip.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('exclui somente se a viagem pertencer ao userId', async () => {
      const existing = buildTrip();
      prismaTrip.findFirst.mockResolvedValue(existing);
      prismaTrip.delete.mockResolvedValue(existing);

      const result = await repository.delete('trip-1', userId);

      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', userId },
      });
      expect(prismaTrip.delete).toHaveBeenCalledWith({
        where: { id: 'trip-1' },
      });
      expect(result).toEqual(existing);
    });

    it('não chama delete e retorna null se a viagem não pertencer ao usuário', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const result = await repository.delete('trip-1', otherUserId);

      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-1', userId: otherUserId },
      });
      expect(prismaTrip.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
