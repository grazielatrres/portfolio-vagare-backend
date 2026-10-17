// budget.integration.test.ts — RF17, RF19, RF20, RN01, RN05, RN06, RNF07

import { AuthProvider, Prisma, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { buildActivity } from './helpers/activity.factory';
import { buildExpense } from './helpers/expense.factory';
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
    expense: {
      findMany: jest.fn(),
    },
    activity: {
      findMany: jest.fn(),
    },
  },
}));

const prismaUser = prisma.user as unknown as { findUnique: jest.Mock };
const prismaSession = prisma.session as unknown as { findUnique: jest.Mock };
const prismaTrip = prisma.trip as unknown as { findFirst: jest.Mock };
const prismaExpense = prisma.expense as unknown as { findMany: jest.Mock };
const prismaActivity = prisma.activity as unknown as { findMany: jest.Mock };

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

describe('Budget endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();
  const otherUser = buildUser({ id: 'user-2', email: 'joao@example.com' });
  const trip = buildTrip({ id: 'trip-1', userId: owner.id, budget: new Prisma.Decimal(2000) });

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
      const response = await request(app).get(`/trips/${trip.id}/budget`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /trips/:tripId/budget', () => {
    it('retorna 404 ao consultar orçamento de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/trips/${trip.id}/budget`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
    });

    it('retorna o resumo financeiro com total gasto e saldo (RF19, RF20)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaExpense.findMany.mockResolvedValue([
        buildExpense({ amount: new Prisma.Decimal(500), category: 'Hospedagem' }),
      ]);
      prismaActivity.findMany.mockResolvedValue([
        buildActivity({ estimatedCost: new Prisma.Decimal(95), category: 'Praia' }),
      ]);

      const response = await request(app)
        .get(`/trips/${trip.id}/budget`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body.budget).toBe(2000);
      expect(response.body.expenses.total).toBe(500);
      expect(response.body.activitiesCost.total).toBe(95);
      expect(response.body.totalSpent).toBe(595);
      expect(response.body.remainingBalance).toBe(1405);
      expect(response.body.byCategory).toEqual(
        expect.arrayContaining([
          { category: 'Hospedagem', total: 500 },
          { category: 'Praia', total: 95 },
        ]),
      );
    });
  });
});
