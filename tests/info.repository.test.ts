// info.repository.test.ts — RF21, RF22, RF23

import { Prisma } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { InfoRepository } from '../src/repositories/info.repository';
import { buildInfo } from './helpers/info.factory';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    info: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prismaInfo = prisma.info as unknown as {
  create: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

describe('InfoRepository', () => {
  const repository = new InfoRepository();
  const tripId = 'trip-1';
  const otherTripId = 'trip-2';

  describe('create', () => {
    it('cria informação vinculando obrigatoriamente o tripId', async () => {
      const data = { type: 'flight' as const, title: 'Aegean Airlines' };
      prismaInfo.create.mockResolvedValue(buildInfo());

      const result = await repository.create(tripId, data);

      expect(prismaInfo.create).toHaveBeenCalledWith({
        data: {
          tripId,
          type: 'flight',
          title: 'Aegean Airlines',
          description: null,
          date: null,
          details: Prisma.DbNull,
        },
      });
      expect(result.tripId).toBe(tripId);
    });

    it('persiste details quando informado', async () => {
      const details = { origin: 'GRU', destination: 'JTR' };
      prismaInfo.create.mockResolvedValue(buildInfo({ details }));

      await repository.create(tripId, { type: 'flight', title: 'Aegean Airlines', details });

      expect(prismaInfo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ details }),
      });
    });
  });

  describe('findAllByTrip', () => {
    it('lista informações filtradas pelo tripId, ordenadas por tipo e data', async () => {
      const infos = [buildInfo(), buildInfo({ id: 'info-2', type: 'lodging' })];
      prismaInfo.findMany.mockResolvedValue(infos);

      const result = await repository.findAllByTrip(tripId);

      expect(prismaInfo.findMany).toHaveBeenCalledWith({
        where: { tripId },
        orderBy: [{ type: 'asc' }, { date: 'asc' }],
      });
      expect(result).toEqual(infos);
    });
  });

  describe('findByIdAndTrip', () => {
    it('busca informação por id e tripId juntos', async () => {
      const info = buildInfo();
      prismaInfo.findFirst.mockResolvedValue(info);

      const result = await repository.findByIdAndTrip('info-1', tripId);

      expect(prismaInfo.findFirst).toHaveBeenCalledWith({ where: { id: 'info-1', tripId } });
      expect(result).toEqual(info);
    });

    it('retorna null quando a informação não existe ou não pertence à viagem', async () => {
      prismaInfo.findFirst.mockResolvedValue(null);

      const result = await repository.findByIdAndTrip('info-1', otherTripId);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('atualiza somente se a informação pertencer à viagem', async () => {
      const existing = buildInfo();
      const updated = buildInfo({ title: 'LATAM' });
      prismaInfo.findFirst.mockResolvedValue(existing);
      prismaInfo.update.mockResolvedValue(updated);

      const result = await repository.update('info-1', tripId, {
        type: 'flight',
        title: 'LATAM',
      });

      expect(prismaInfo.update).toHaveBeenCalledWith({
        where: { id: 'info-1' },
        data: {
          type: 'flight',
          title: 'LATAM',
          description: null,
          date: null,
          details: Prisma.DbNull,
        },
      });
      expect(result).toEqual(updated);
    });

    it('não chama update e retorna null se a informação não pertencer à viagem', async () => {
      prismaInfo.findFirst.mockResolvedValue(null);

      const result = await repository.update('info-1', otherTripId, {
        type: 'flight',
        title: 'LATAM',
      });

      expect(prismaInfo.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('exclui somente se a informação pertencer à viagem', async () => {
      const existing = buildInfo();
      prismaInfo.findFirst.mockResolvedValue(existing);
      prismaInfo.delete.mockResolvedValue(existing);

      const result = await repository.delete('info-1', tripId);

      expect(prismaInfo.delete).toHaveBeenCalledWith({ where: { id: 'info-1' } });
      expect(result).toEqual(existing);
    });

    it('não chama delete e retorna null se a informação não pertencer à viagem', async () => {
      prismaInfo.findFirst.mockResolvedValue(null);

      const result = await repository.delete('info-1', otherTripId);

      expect(prismaInfo.delete).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
