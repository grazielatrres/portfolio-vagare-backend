// info.integration.test.ts — RF21, RF22, RF23, RF24, RN01, RNF07

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { buildInfo } from './helpers/info.factory';
import { buildTrip } from './helpers/trip.factory';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
    },
    trip: {
      findFirst: jest.fn(),
    },
    info: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prismaUser = prisma.user as unknown as { findUnique: jest.Mock };
const prismaSession = prisma.session as unknown as { findUnique: jest.Mock };
const prismaTrip = prisma.trip as unknown as { findFirst: jest.Mock };
const prismaInfo = prisma.info as unknown as {
  create: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: 'hash',
    provider: AuthProvider.local,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function authHeader(user: Pick<User, 'id' | 'email'>): string {
  const token = jwt.sign(
    { sub: user.id, email: user.email, sid: `session-${user.id}` },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
  return `Bearer ${token}`;
}

describe('Info endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();
  const otherUser = buildUser({ id: 'user-2', email: 'joao@example.com' });
  const trip = buildTrip({ id: 'trip-1', userId: owner.id });

  const flightPayload = {
    type: 'flight',
    title: 'Aegean Airlines',
    date: '2026-03-15',
    details: { origin: 'GRU', destination: 'JTR', time: '06:30', flightNumber: 'A3 1234' },
  };

  beforeEach(() => {
    prismaUser.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === owner.id) return owner;
      if (where.id === otherUser.id) return otherUser;
      return null;
    });
    prismaSession.findUnique.mockResolvedValue({ id: 'session-active' });
  });

  describe('autenticação', () => {
    it('retorna 401 sem token', async () => {
      const response = await request(app).get(`/trips/${trip.id}/infos`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /trips/:tripId/infos', () => {
    it('lista informações da viagem do usuário autenticado (RF24)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const infos = [buildInfo(), buildInfo({ id: 'info-2', type: 'lodging' })];
      prismaInfo.findMany.mockResolvedValue(infos);

      const response = await request(app)
        .get(`/trips/${trip.id}/infos`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('retorna 404 ao listar informações de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/trips/${trip.id}/infos`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
    });
  });

  describe('POST /trips/:tripId/infos', () => {
    it('cria informação de voo e retorna 201 (RF21)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaInfo.create.mockResolvedValue(buildInfo());

      const response = await request(app)
        .post(`/trips/${trip.id}/infos`)
        .set('Authorization', authHeader(owner))
        .send(flightPayload);

      expect(response.status).toBe(201);
      expect(prismaInfo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId: trip.id,
            type: 'flight',
            title: 'Aegean Airlines',
          }),
        }),
      );
    });

    it('retorna 400 quando nenhum campo é preenchido (fluxo de exceção UC05)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);

      const response = await request(app)
        .post(`/trips/${trip.id}/infos`)
        .set('Authorization', authHeader(owner))
        .send({ type: 'flight', title: '' });

      expect(response.status).toBe(400);
      expect(prismaInfo.create).not.toHaveBeenCalled();
    });

    it('retorna 404 ao tentar criar informação em viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/trips/${trip.id}/infos`)
        .set('Authorization', authHeader(otherUser))
        .send(flightPayload);

      expect(response.status).toBe(404);
      expect(prismaInfo.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /trips/:tripId/infos/:id', () => {
    it('atualiza informação e retorna 200 (cadastro incremental)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const info = buildInfo();
      prismaInfo.findFirst.mockResolvedValue(info);
      prismaInfo.update.mockResolvedValue({ ...info, title: 'LATAM' });

      const response = await request(app)
        .put(`/trips/${trip.id}/infos/${info.id}`)
        .set('Authorization', authHeader(owner))
        .send({ ...flightPayload, title: 'LATAM' });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('LATAM');
    });

    it('retorna 404 ao atualizar informação que não existe na viagem', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaInfo.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put(`/trips/${trip.id}/infos/info-inexistente`)
        .set('Authorization', authHeader(owner))
        .send(flightPayload);

      expect(response.status).toBe(404);
      expect(prismaInfo.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /trips/:tripId/infos/:id', () => {
    it('exclui informação e retorna 204', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const info = buildInfo();
      prismaInfo.findFirst.mockResolvedValue(info);
      prismaInfo.delete.mockResolvedValue(info);

      const response = await request(app)
        .delete(`/trips/${trip.id}/infos/${info.id}`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(204);
    });

    it('retorna 404 ao excluir informação de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/trips/${trip.id}/infos/info-1`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(prismaInfo.delete).not.toHaveBeenCalled();
    });
  });
});
