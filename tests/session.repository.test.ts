// session.repository.test.ts — RNF04 (sessão criada no login, destruída no logout)

import { prisma } from '../src/config/prisma';
import { SessionRepository } from '../src/repositories/auth/session.repository';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const prismaSession = prisma.session as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  deleteMany: jest.Mock;
};

describe('SessionRepository', () => {
  const repository = new SessionRepository();

  describe('create', () => {
    it('cria sessão vinculada ao userId', async () => {
      prismaSession.create.mockResolvedValue({ id: 'session-1' });

      const result = await repository.create('user-1');

      expect(prismaSession.create).toHaveBeenCalledWith({
        data: { userId: 'user-1' },
        select: { id: true },
      });
      expect(result).toEqual({ id: 'session-1' });
    });
  });

  describe('existsById', () => {
    it('retorna true quando a sessão existe', async () => {
      prismaSession.findUnique.mockResolvedValue({ id: 'session-1' });

      await expect(repository.existsById('session-1')).resolves.toBe(true);
    });

    it('retorna false quando a sessão não existe (encerrada ou inválida)', async () => {
      prismaSession.findUnique.mockResolvedValue(null);

      await expect(repository.existsById('session-1')).resolves.toBe(false);
    });
  });

  describe('deleteById', () => {
    it('remove a sessão pelo id', async () => {
      prismaSession.deleteMany.mockResolvedValue({ count: 1 });

      await repository.deleteById('session-1');

      expect(prismaSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });
  });
});
