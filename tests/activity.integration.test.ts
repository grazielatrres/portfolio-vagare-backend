// activity.integration.test.ts — RF12, RF13, RN01, RN07, RNF07

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { buildActivity } from './helpers/activity.factory';
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
    activity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prismaUser = prisma.user as unknown as { findUnique: jest.Mock };
const prismaSession = prisma.session as unknown as { findUnique: jest.Mock };
const prismaTrip = prisma.trip as unknown as { findFirst: jest.Mock };
const prismaActivity = prisma.activity as unknown as {
  create: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
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

describe('Activity endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();
  const otherUser = buildUser({ id: 'user-2', email: 'joao@example.com' });
  const trip = buildTrip({
    id: 'trip-1',
    userId: owner.id,
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-10'),
  });

  const activityPayload = {
    name: 'Red Beach',
    date: '2026-09-02',
    time: '14:30',
    location: 'Oia, Santorini',
    period: 'tarde',
    category: 'Praia',
    estimatedCost: 95,
    description: 'Almoço premiado e praia',
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
      const response = await request(app).get(`/trips/${trip.id}/activities`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /trips/:tripId/activities', () => {
    it('lista atividades da viagem do usuário autenticado', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const activities = [buildActivity(), buildActivity({ id: 'activity-2' })];
      prismaActivity.findMany.mockResolvedValue(activities);

      const response = await request(app)
        .get(`/trips/${trip.id}/activities`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('retorna 404 ao listar atividades de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/trips/${trip.id}/activities`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
    });
  });

  describe('POST /trips/:tripId/activities', () => {
    it('cria atividade e retorna 201', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaActivity.create.mockResolvedValue(buildActivity());

      const response = await request(app)
        .post(`/trips/${trip.id}/activities`)
        .set('Authorization', authHeader(owner))
        .send(activityPayload);

      expect(response.status).toBe(201);
      expect(prismaActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tripId: trip.id, name: activityPayload.name }),
        }),
      );
    });

    it('retorna 400 quando a data está fora do período da viagem (RN07)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);

      const response = await request(app)
        .post(`/trips/${trip.id}/activities`)
        .set('Authorization', authHeader(owner))
        .send({ ...activityPayload, date: '2026-12-25' });

      expect(response.status).toBe(400);
      expect(prismaActivity.create).not.toHaveBeenCalled();
    });

    it('retorna 404 ao tentar criar atividade em viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/trips/${trip.id}/activities`)
        .set('Authorization', authHeader(otherUser))
        .send(activityPayload);

      expect(response.status).toBe(404);
      expect(prismaActivity.create).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /trips/:tripId/activities/:id', () => {
    it('exclui atividade e retorna 204', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const activity = buildActivity();
      prismaActivity.findFirst.mockResolvedValue(activity);
      prismaActivity.delete.mockResolvedValue(activity);

      const response = await request(app)
        .delete(`/trips/${trip.id}/activities/${activity.id}`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(204);
    });

    it('retorna 404 ao excluir atividade de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/trips/${trip.id}/activities/activity-1`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(prismaActivity.delete).not.toHaveBeenCalled();
    });
  });
});
