// session.repository.test.ts — RNF04 (sessão criada no login, destruída no logout)

import { prisma } from '../src/config/prisma';
import { SessionRepository } from '../src/repositories/auth/session.repository';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const prismaSession = prisma.session as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  updateMany: jest.Mock;
  deleteMany: jest.Mock;
};

describe('SessionRepository', () => {
  const repository = new SessionRepository();

  describe('create', () => {
    it('cria sessão vinculada ao userId com hash do refresh token e expiração', async () => {
      prismaSession.create.mockResolvedValue({ id: 'session-1' });
      const expiresAt = new Date('2027-01-01T00:00:00Z');

      const result = await repository.create('user-1', 'hash-1', expiresAt);

      expect(prismaSession.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', refreshTokenHash: 'hash-1', expiresAt },
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

  describe('findByRefreshTokenHash', () => {
    it('busca a sessão pelo hash do refresh token', async () => {
      const session = { id: 'session-1', userId: 'user-1', expiresAt: new Date() };
      prismaSession.findUnique.mockResolvedValue(session);

      await expect(repository.findByRefreshTokenHash('hash-1')).resolves.toEqual(session);
      expect(prismaSession.findUnique).toHaveBeenCalledWith({
        where: { refreshTokenHash: 'hash-1' },
        select: { id: true, userId: true, expiresAt: true },
      });
    });
  });

  describe('rotateRefreshToken', () => {
    it('troca o hash apenas se o atual ainda for o informado', async () => {
      prismaSession.updateMany.mockResolvedValue({ count: 1 });
      const expiresAt = new Date('2027-01-01T00:00:00Z');

      await expect(
        repository.rotateRefreshToken('session-1', 'hash-antigo', 'hash-novo', expiresAt),
      ).resolves.toBe(true);
      expect(prismaSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'session-1', refreshTokenHash: 'hash-antigo' },
        data: { refreshTokenHash: 'hash-novo', expiresAt },
      });
    });

    it('retorna false quando o refresh token já foi trocado por outra requisição', async () => {
      prismaSession.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        repository.rotateRefreshToken('session-1', 'hash-antigo', 'hash-novo', new Date()),
      ).resolves.toBe(false);
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
