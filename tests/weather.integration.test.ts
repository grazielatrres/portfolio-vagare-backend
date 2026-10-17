// weather.integration.test.ts — RF16, RN01, RN08, RNF07

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
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
  },
}));

const prismaUser = prisma.user as unknown as { findUnique: jest.Mock };
const prismaSession = prisma.session as unknown as { findUnique: jest.Mock };
const prismaTrip = prisma.trip as unknown as { findFirst: jest.Mock };

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

describe('Weather endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();
  const otherUser = buildUser({ id: 'user-2', email: 'joao@example.com' });
  const trip = buildTrip({
    id: 'trip-1',
    userId: owner.id,
    destination: 'Santorini, Grécia',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-10'),
  });

  beforeEach(() => {
    prismaUser.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === owner.id) return owner;
      if (where.id === otherUser.id) return otherUser;
      return null;
    });
    prismaSession.findUnique.mockResolvedValue({ id: 'session-active' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('autenticação', () => {
    it('retorna 401 sem token', async () => {
      const response = await request(app).get(`/trips/${trip.id}/weather`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /trips/:tripId/weather', () => {
    it('retorna 404 ao consultar clima de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/trips/${trip.id}/weather`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
    });

    it('retorna a previsão por dia quando a API externa responde com sucesso (RF16)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          list: [
            {
              dt_txt: '2026-09-02 12:00:00',
              main: { temp: 24.3 },
              weather: [{ description: 'céu limpo', icon: '01d' }],
            },
          ],
        }),
      } as Response);

      const response = await request(app)
        .get(`/trips/${trip.id}/weather`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { date: '2026-09-02', temperature: 24, condition: 'céu limpo', icon: '01d' },
      ]);
    });

    it('retorna 503 com mensagem padronizada quando a API externa está indisponível (RN08)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

      const response = await request(app)
        .get(`/trips/${trip.id}/weather`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Previsão do tempo indisponível no momento' });
    });
  });
});
