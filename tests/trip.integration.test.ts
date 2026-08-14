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
      create: jest.fn(),
    },
    trip: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prismaUser = prisma.user as unknown as {
  findUnique: jest.Mock;
};

const prismaTrip = prisma.trip as unknown as {
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function authHeader(user: Pick<User, 'id' | 'email'>): string {
  const token = jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, {
    expiresIn: '1h',
  });
  return `Bearer ${token}`;
}

const tripPayload = {
  name: 'Férias em Florença',
  destination: 'Florença, Itália',
  startDate: '2026-09-01',
  endDate: '2026-09-10',
  budget: 5000,
  numberOfPeople: 2,
};

describe('Trip endpoints (integração)', () => {
  const app = createApp();
  const owner = buildUser();
  const otherUser = buildUser({
    id: 'user-2',
    name: 'João Souza',
    email: 'joao@example.com',
  });

  beforeEach(() => {
    prismaUser.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === owner.id) return owner;
      if (where.id === otherUser.id) return otherUser;
      return null;
    });
  });

  describe('autenticação', () => {
    it('retorna 401 sem token', async () => {
      const response = await request(app).get('/trips');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token de autenticação ausente' });
    });
  });

  describe('POST /trips', () => {
    it('cria viagem e retorna 201', async () => {
      const created = buildTrip({ numberOfPeople: 2 });
      prismaTrip.create.mockResolvedValue(created);

      const response = await request(app)
        .post('/trips')
        .set('Authorization', authHeader(owner))
        .send(tripPayload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: created.id,
        userId: owner.id,
        name: tripPayload.name,
        destination: tripPayload.destination,
        numberOfPeople: 2,
      });
      expect(prismaTrip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: owner.id }),
        }),
      );
    });

    it('retorna 400 quando o payload é inválido', async () => {
      const response = await request(app)
        .post('/trips')
        .set('Authorization', authHeader(owner))
        .send({ ...tripPayload, name: '' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Nome é obrigatório' });
      expect(prismaTrip.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /trips', () => {
    it('lista apenas viagens do usuário autenticado', async () => {
      const trips = [buildTrip(), buildTrip({ id: 'trip-2', name: 'Roma' })];
      prismaTrip.findMany.mockResolvedValue(trips);

      const response = await request(app).get('/trips').set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(prismaTrip.findMany).toHaveBeenCalledWith({
        where: { userId: owner.id },
        orderBy: { startDate: 'asc' },
      });
    });
  });

  describe('GET /trips/:id', () => {
    it('retorna detalhe da viagem do usuário', async () => {
      const trip = buildTrip();
      prismaTrip.findFirst.mockResolvedValue(trip);

      const response = await request(app)
        .get(`/trips/${trip.id}`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(trip.id);
    });

    it('retorna 404 ao acessar viagem de outro usuário (sem vazar existência)', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/trips/trip-de-outro')
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
      expect(prismaTrip.findFirst).toHaveBeenCalledWith({
        where: { id: 'trip-de-outro', userId: otherUser.id },
      });
    });
  });

  describe('PUT /trips/:id', () => {
    it('edita viagem do usuário e retorna 200', async () => {
      const existing = buildTrip();
      const updated = buildTrip({ name: 'Toscana 2026', numberOfPeople: 3 });
      prismaTrip.findFirst.mockResolvedValue(existing);
      prismaTrip.update.mockResolvedValue(updated);

      const response = await request(app)
        .put(`/trips/${existing.id}`)
        .set('Authorization', authHeader(owner))
        .send({ ...tripPayload, name: 'Toscana 2026', numberOfPeople: 3 });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Toscana 2026');
      expect(response.body.numberOfPeople).toBe(3);
    });

    it('retorna 404 ao editar viagem de outro usuário', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .put('/trips/trip-de-outro')
        .set('Authorization', authHeader(otherUser))
        .send(tripPayload);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
      expect(prismaTrip.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /trips/:id', () => {
    it('exclui viagem do usuário e retorna 204', async () => {
      const trip = buildTrip();
      prismaTrip.findFirst.mockResolvedValue(trip);
      prismaTrip.delete.mockResolvedValue(trip);

      const response = await request(app)
        .delete(`/trips/${trip.id}`)
        .set('Authorization', authHeader(owner));

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
      expect(prismaTrip.delete).toHaveBeenCalledWith({ where: { id: trip.id } });
    });

    it('retorna 404 ao excluir viagem de outro usuário', async () => {
      prismaTrip.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .delete('/trips/trip-de-outro')
        .set('Authorization', authHeader(otherUser));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Viagem não encontrada' });
      expect(prismaTrip.delete).not.toHaveBeenCalled();
    });
  });
});
