// expense.integration.test.ts — RF18, RN01, RNF07

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
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
const prismaExpense = prisma.expense as unknown as {
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

describe('Expense endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();
  const otherUser = buildUser({ id: 'user-2', email: 'joao@example.com' });
  const trip = buildTrip({ id: 'trip-1', userId: owner.id });

  const expensePayload = {
    description: 'Hospedagem',
    amount: 500,
    currency: 'BRL',
    category: 'Hospedagem',
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
      const response = await request(app).get(`/trips/${trip.id}/expenses`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /trips/:tripId/expenses', () => {
    it('lista gastos da viagem do usuário autenticado', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const expenses = [buildExpense(), buildExpense({ id: 'expense-2' })];
      prismaExpense.findMany.mockResolvedValue(expenses);

      const response = await request(app)
        .get(`/trips/${trip.id}/expenses`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it('retorna 404 ao listar gastos de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/trips/${trip.id}/expenses`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
    });
  });

  describe('POST /trips/:tripId/expenses', () => {
    it('cria gasto e retorna 201', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaExpense.create.mockResolvedValue(buildExpense());

      const response = await request(app)
        .post(`/trips/${trip.id}/expenses`)
        .set('Authorization', authHeader(owner))
        .send(expensePayload);

      expect(response.status).toBe(201);
      expect(prismaExpense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tripId: trip.id,
            description: expensePayload.description,
          }),
        }),
      );
    });

    it('retorna 400 quando o valor é inválido (fluxo de exceção RF18)', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);

      const response = await request(app)
        .post(`/trips/${trip.id}/expenses`)
        .set('Authorization', authHeader(owner))
        .send({ ...expensePayload, amount: -5 });

      expect(response.status).toBe(400);
      expect(prismaExpense.create).not.toHaveBeenCalled();
    });

    it('retorna 404 ao tentar criar gasto em viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .post(`/trips/${trip.id}/expenses`)
        .set('Authorization', authHeader(otherUser))
        .send(expensePayload);

      expect(response.status).toBe(404);
      expect(prismaExpense.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /trips/:tripId/expenses/:id', () => {
    it('atualiza gasto e retorna 200', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const expense = buildExpense();
      prismaExpense.findFirst.mockResolvedValue(expense);
      prismaExpense.update.mockResolvedValue({ ...expense, description: 'Hospedagem editada' });

      const response = await request(app)
        .put(`/trips/${trip.id}/expenses/${expense.id}`)
        .set('Authorization', authHeader(owner))
        .send({ ...expensePayload, description: 'Hospedagem editada' });

      expect(response.status).toBe(200);
      expect(response.body.description).toBe('Hospedagem editada');
    });

    it('retorna 404 ao atualizar gasto que não existe na viagem', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaExpense.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put(`/trips/${trip.id}/expenses/expense-inexistente`)
        .set('Authorization', authHeader(owner))
        .send(expensePayload);

      expect(response.status).toBe(404);
      expect(prismaExpense.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /trips/:tripId/expenses/:id', () => {
    it('exclui gasto e retorna 204', async () => {
      prismaTrip.findFirst.mockResolvedValue(trip);
      const expense = buildExpense();
      prismaExpense.findFirst.mockResolvedValue(expense);
      prismaExpense.delete.mockResolvedValue(expense);

      const response = await request(app)
        .delete(`/trips/${trip.id}/expenses/${expense.id}`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(204);
    });

    it('retorna 404 ao excluir gasto de viagem de outro usuário (RN01)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/trips/${trip.id}/expenses/expense-1`)
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(prismaExpense.delete).not.toHaveBeenCalled();
    });
  });
});
