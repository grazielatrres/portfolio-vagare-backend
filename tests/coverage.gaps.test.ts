import { assertServerEnv } from '../src/config/env';
import { AppError } from '../src/types/errors';
import { UserRepository } from '../src/repositories/auth/user.repository';
import { prisma } from '../src/config/prisma';
import { AuthProvider } from '@prisma/client';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const prismaUser = prisma.user as unknown as {
  create: jest.Mock;
};

describe('cobertura complementar', () => {
  describe('assertServerEnv', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    it('não lança quando DATABASE_URL e JWT_SECRET existem', () => {
      process.env = {
        ...originalEnv,
        DATABASE_URL: 'postgresql://localhost:5432/vagare',
        JWT_SECRET: 'secret',
      };

      expect(() => assertServerEnv()).not.toThrow();
    });

    it('lança quando faltam variáveis obrigatórias', () => {
      process.env = { ...originalEnv };
      delete process.env.DATABASE_URL;
      delete process.env.JWT_SECRET;

      expect(() => assertServerEnv()).toThrow(/Variáveis de ambiente obrigatórias ausentes/);
    });

    it.each(['abc', '0', '-5', '1.5'])('lança quando REFRESH_TOKEN_TTL_DAYS é "%s"', (value) => {
      process.env = {
        ...originalEnv,
        DATABASE_URL: 'postgresql://localhost:5432/vagare',
        JWT_SECRET: 'secret',
        REFRESH_TOKEN_TTL_DAYS: value,
      };

      expect(() => assertServerEnv()).toThrow(/REFRESH_TOKEN_TTL_DAYS inválido/);
    });

    it.each([undefined, ''])('aceita REFRESH_TOKEN_TTL_DAYS ausente ou vazio (%p)', (value) => {
      process.env = {
        ...originalEnv,
        DATABASE_URL: 'postgresql://localhost:5432/vagare',
        JWT_SECRET: 'secret',
      };
      if (value === undefined) {
        delete process.env.REFRESH_TOKEN_TTL_DAYS;
      } else {
        process.env.REFRESH_TOKEN_TTL_DAYS = value;
      }

      expect(() => assertServerEnv()).not.toThrow();
    });

    it('aceita REFRESH_TOKEN_TTL_DAYS inteiro positivo', () => {
      process.env = {
        ...originalEnv,
        DATABASE_URL: 'postgresql://localhost:5432/vagare',
        JWT_SECRET: 'secret',
        REFRESH_TOKEN_TTL_DAYS: '30',
      };

      expect(() => assertServerEnv()).not.toThrow();
    });
  });

  describe('AppError', () => {
    it('usa status 400 por padrão', () => {
      const error = new AppError('mensagem');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('UserRepository.create', () => {
    it('aplica defaults de passwordHash e provider', async () => {
      const repository = new UserRepository();
      prismaUser.create.mockResolvedValue({
        id: 'user-1',
        name: 'Maria',
        email: 'maria@example.com',
        passwordHash: null,
        provider: AuthProvider.local,
      });

      await repository.create({
        name: 'Maria',
        email: 'maria@example.com',
      });

      expect(prismaUser.create).toHaveBeenCalledWith({
        data: {
          name: 'Maria',
          email: 'maria@example.com',
          passwordHash: null,
          provider: AuthProvider.local,
        },
      });
    });
  });
});
