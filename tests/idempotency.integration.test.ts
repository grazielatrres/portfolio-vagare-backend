// idempotency.integration.test.ts — reenvio seguro de criações (Idempotency-Key)

import { AuthProvider, Prisma, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { buildTrip } from './helpers/trip.factory';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    session: { findUnique: jest.fn() },
    trip: { create: jest.fn(), findFirst: jest.fn() },
    activity: { create: jest.fn() },
    idempotencyKey: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

interface StoredRow {
  id: string;
  userId: string;
  key: string;
  method: string;
  path: string;
  statusCode: number | null;
  responseBody: unknown;
}

const prismaUser = prisma.user as unknown as { findUnique: jest.Mock };
const prismaSession = prisma.session as unknown as { findUnique: jest.Mock };
const prismaTrip = prisma.trip as unknown as { create: jest.Mock; findFirst: jest.Mock };
const prismaKey = prisma.idempotencyKey as unknown as {
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  deleteMany: jest.Mock;
};

const owner: User = {
  id: 'user-1',
  name: 'Maria Silva',
  email: 'maria@example.com',
  passwordHash: 'hash',
  provider: AuthProvider.local,
  resetTokenHash: null,
  resetTokenExpiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function authHeader(): string {
  const token = jwt.sign(
    { sub: owner.id, email: owner.email, sid: `session-${owner.id}` },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
  return `Bearer ${token}`;
}

const tripPayload = {
  name: 'Férias em Florença',
  destination: 'Florença, Itália',
  startDate: '2026-09-01',
  endDate: '2026-09-10',
};

// Simula a tabela idempotency_keys em memória, com a unicidade (userId, key).
function useInMemoryKeyStore(): StoredRow[] {
  const rows: StoredRow[] = [];
  let nextId = 1;

  prismaKey.findUnique.mockImplementation(
    async ({ where }: { where: { userId_key: { userId: string; key: string } } }) =>
      rows.find(
        (row) => row.userId === where.userId_key.userId && row.key === where.userId_key.key,
      ) ?? null,
  );
  prismaKey.create.mockImplementation(async ({ data }: { data: Omit<StoredRow, 'id'> }) => {
    if (rows.some((row) => row.userId === data.userId && row.key === data.key)) {
      throw new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      });
    }
    const row = { ...data, id: `key-${nextId++}`, statusCode: null, responseBody: null };
    rows.push(row);
    return { id: row.id };
  });
  prismaKey.update.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { statusCode: number; responseBody: unknown };
    }) => {
      const row = rows.find((r) => r.id === where.id)!;
      Object.assign(row, data);
      return row;
    },
  );
  prismaKey.deleteMany.mockImplementation(async ({ where }: { where: { id: string } }) => {
    const index = rows.findIndex((r) => r.id === where.id);
    if (index >= 0) rows.splice(index, 1);
    return { count: index >= 0 ? 1 : 0 };
  });

  return rows;
}

describe('Idempotency-Key nas criações (integração)', () => {
  const app = createApp();
  let rows: StoredRow[];

  beforeEach(() => {
    prismaUser.findUnique.mockResolvedValue(owner);
    prismaSession.findUnique.mockResolvedValue({ id: 'session-active' });
    rows = useInMemoryKeyStore();
  });

  it('sem o cabeçalho, cria normalmente sem tocar na tabela de chaves', async () => {
    prismaTrip.create.mockResolvedValue(buildTrip());

    const response = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .send(tripPayload);

    expect(response.status).toBe(201);
    expect(prismaKey.findUnique).not.toHaveBeenCalled();
  });

  it('reenvio com a mesma chave devolve a resposta original sem criar de novo', async () => {
    const created = buildTrip({ id: 'trip-42' });
    prismaTrip.create.mockResolvedValue(created);

    const first = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send(tripPayload);
    const retry = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send(tripPayload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);
    expect(retry.body.id).toBe('trip-42');
    expect(prismaTrip.create).toHaveBeenCalledTimes(1);
  });

  it('libera a chave quando a criação falha, permitindo nova tentativa', async () => {
    const invalid = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send({ ...tripPayload, name: '' });

    expect(invalid.status).toBe(400);
    expect(rows).toHaveLength(0);

    prismaTrip.create.mockResolvedValue(buildTrip());
    const retry = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send(tripPayload);

    expect(retry.status).toBe(201);
    expect(prismaTrip.create).toHaveBeenCalledTimes(1);
  });

  it('responde 409 enquanto a requisição original ainda está em processamento', async () => {
    rows.push({
      id: 'key-x',
      userId: owner.id,
      key: 'local-abc',
      method: 'POST',
      path: '/trips',
      statusCode: null,
      responseBody: null,
    });

    const response = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send(tripPayload);

    expect(response.status).toBe(409);
    expect(prismaTrip.create).not.toHaveBeenCalled();
  });

  it('responde 409 se outra requisição reservar a mesma chave ao mesmo tempo', async () => {
    prismaKey.findUnique.mockResolvedValueOnce(null);
    prismaKey.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }),
    );

    const response = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send(tripPayload);

    expect(response.status).toBe(409);
    expect(prismaTrip.create).not.toHaveBeenCalled();
  });

  it('recusa com 422 a mesma chave usada em outra rota', async () => {
    rows.push({
      id: 'key-x',
      userId: owner.id,
      key: 'local-abc',
      method: 'POST',
      path: '/trips/trip-1/activities',
      statusCode: 201,
      responseBody: { id: 'activity-1' },
    });

    const response = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'local-abc')
      .send(tripPayload);

    expect(response.status).toBe(422);
  });

  it('recusa com 400 uma chave longa demais', async () => {
    const response = await request(app)
      .post('/trips')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', 'x'.repeat(256))
      .send(tripPayload);

    expect(response.status).toBe(400);
    expect(prismaKey.findUnique).not.toHaveBeenCalled();
  });
});
