// profile.integration.test.ts — LGPD 6.4.3 (acesso, correção e exclusão de dados do usuário)

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    trip: {
      count: jest.fn(),
    },
  },
}));

const prismaUser = prisma.user as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

const prismaSession = prisma.session as unknown as {
  findUnique: jest.Mock;
};

const prismaTrip = prisma.trip as unknown as {
  count: jest.Mock;
};

function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: 'hash',
    provider: AuthProvider.local,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function authHeader(user: Pick<User, 'id' | 'email'>): string {
  const token = jwt.sign({ sub: user.id, email: user.email, sid: 'session-1' }, env.jwtSecret, {
    expiresIn: '1h',
  });
  return `Bearer ${token}`;
}

describe('Profile endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();

  beforeEach(() => {
    prismaSession.findUnique.mockResolvedValue({ id: 'session-1' });
    prismaUser.findUnique.mockResolvedValue(owner);
    prismaTrip.count.mockResolvedValue(2);
  });

  describe('GET /users/me', () => {
    it('retorna os dados do usuário autenticado com estatísticas', async () => {
      const response = await request(app).get('/users/me').set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        stats: { totalTrips: 2 },
      });
    });

    it('retorna 401 sem token', async () => {
      const response = await request(app).get('/users/me');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /users/me', () => {
    it('edita nome e e-mail e retorna 200', async () => {
      prismaUser.update.mockResolvedValue(buildUser({ name: 'Maria Souza' }));

      const response = await request(app)
        .put('/users/me')
        .set('Authorization', authHeader(owner))
        .send({ name: 'Maria Souza', email: 'maria@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Maria Souza');
    });

    it('retorna 400 quando o nome enviado é vazio', async () => {
      const response = await request(app)
        .put('/users/me')
        .set('Authorization', authHeader(owner))
        .send({ name: '   ' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Nome não pode ser vazio' });
      expect(prismaUser.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /users/me', () => {
    it('exclui a conta e retorna 204', async () => {
      prismaUser.delete.mockResolvedValue(owner);

      const response = await request(app)
        .delete('/users/me')
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(204);
      expect(prismaUser.delete).toHaveBeenCalledWith({ where: { id: owner.id } });
    });
  });
});
