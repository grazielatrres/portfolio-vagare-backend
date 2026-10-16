// activity.repository.test.ts — RF12, RF13

import { prisma } from '../src/config/prisma';
import { ActivityRepository } from '../src/repositories/activity.repository';
import { buildActivity } from './helpers/activity.factory';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    activity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prismaActivity = prisma.activity as unknown as {
  create: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  delete: jest.Mock;
};

describe('ActivityRepository', () => {
  const repository = new ActivityRepository();
  const tripId = 'trip-1';
  const otherTripId = 'trip-2';

  describe('create', () => {
    it('cria atividade vinculando obrigatoriamente o tripId', async () => {
      const data = {
        name: 'Red Beach',
        date: new Date('2026-09-02'),
      };
      prismaActivity.create.mockResolvedValue(buildActivity());

      const result = await repository.create(tripId, data);

      expect(prismaActivity.create).toHaveBeenCalledWith({
        data: {
          tripId,
          name: data.name,
          date: data.date,
          time: null,
          location: null,
          period: null,
          category: null,
          estimatedCost: null,
          description: null,
        },
      });
      expect(result.tripId).toBe(tripId);
    });
  });

  describe('findAllByTrip', () => {
    it('lista atividades filtradas pelo tripId, ordenadas por data e horário', async () => {
      const activities = [buildActivity(), buildActivity({ id: 'activity-2' })];
      prismaActivity.findMany.mockResolvedValue(activities);

      const result = await repository.findAllByTrip(tripId);

      expect(prismaActivity.findMany).toHaveBeenCalledWith({
        where: { tripId },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      });
      expect(result).toEqual(activities);
    });
  });

  describe('findByIdAndTrip', () => {
    it('busca atividade por id e tripId juntos', async () => {
      const activity = buildActivity();
      prismaActivity.findFirst.mockResolvedValue(activity);

      const result = await repository.findByIdAndTrip('activity-1', tripId);

      expect(prismaActivity.findFirst).toHaveBeenCalledWith({
        where: { id: 'activity-1', tripId },
      });
      expect(result).toEqual(activity);
    });

    it('retorna null quando a atividade não existe ou não pertence à viagem', async () => {
      prismaActivity.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdAndTrip('activity-1', otherTripId);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('exclui somente se a atividade pertencer à viagem', async () => {
      const existing = buildActivity();
      prismaActivity.findFirst.mockResolvedValue(existing);
      prismaActivity.delete.mockResolvedValue(existing);

      const result = await repository.delete('activity-1', tripId);

      expect(prismaActivity.delete).toHaveBeenCalledWith({ where: { id: 'activity-1' } });
      expect(result).toEqual(existing);
    });

    it('não chama delete e retorna null se a atividade não pertencer à viagem', async () => {
      prismaActivity.findFirst.mockResolvedValue(null);

      const result = await repository.delete('activity-1', otherTripId);

      expect(prismaActivity.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
