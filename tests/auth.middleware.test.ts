// auth.middleware.test.ts — RNF04, RNF05 (autenticação e expiração de sessão)

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
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function signToken(
  payload: Record<string, unknown>,
  options: jwt.SignOptions = { expiresIn: '1h' },
  secret: string = env.jwtSecret,
): string {
  return jwt.sign(payload, secret, options);
}

describe('authMiddleware (via GET /users/me)', () => {
  const app = createApp();
  const owner = buildUser();

  beforeEach(() => {
    jest.clearAllMocks();
    prismaSession.findUnique.mockResolvedValue({ id: 'session-1' });
    prismaUser.findUnique.mockResolvedValue(owner);
    prismaTrip.count.mockResolvedValue(0);
  });

  it('retorna 401 quando o header Authorization está ausente', async () => {
    const response = await request(app).get('/users/me');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token de autenticação ausente' });
  });

  it('retorna 401 quando o header não usa o esquema Bearer', async () => {
    const response = await request(app)
      .get('/users/me')
      .set('Authorization', 'Token abc123');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token de autenticação ausente' });
  });

  it('retorna 401 quando o token está vazio após o prefixo Bearer', async () => {
    const response = await request(app).get('/users/me').set('Authorization', 'Bearer ');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token de autenticação ausente' });
  });

  it('retorna 401 com mensagem clara quando o token está expirado', async () => {
    const expired = signToken(
      { sub: owner.id, email: owner.email, sid: 'session-1' },
      { expiresIn: -10 },
    );

    const response = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${expired}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/expirado/i);
  });

  it('retorna 401 quando o token tem assinatura inválida', async () => {
    const wrongSecret = signToken(
      { sub: owner.id, email: owner.email, sid: 'session-1' },
      { expiresIn: '1h' },
      'secret-errado',
    );

    const response = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${wrongSecret}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token inválido' });
  });

  it('retorna 401 quando o token está malformado', async () => {
    const response = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer token.invalido');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token inválido' });
  });

  it('retorna 401 quando o token não contém sid/sub/email', async () => {
    const incomplete = signToken({ sub: owner.id, email: owner.email });

    const response = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${incomplete}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Token inválido' });
  });

  it('retorna 401 quando a sessão já foi encerrada (ex: logout ou reset de senha)', async () => {
    prismaSession.findUnique.mockResolvedValue(null);
    const token = signToken({ sub: owner.id, email: owner.email, sid: 'session-1' });

    const response = await request(app).get('/users/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Sessão encerrada. Faça login novamente.' });
  });

  it('retorna 401 quando o usuário do token não existe mais', async () => {
    prismaUser.findUnique.mockResolvedValue(null);
    const token = signToken({ sub: owner.id, email: owner.email, sid: 'session-1' });

    const response = await request(app).get('/users/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Usuário não encontrado' });
  });

  it('autoriza a requisição com um token válido e sessão ativa', async () => {
    const token = signToken({ sub: owner.id, email: owner.email, sid: 'session-1' });

    const response = await request(app).get('/users/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: owner.id, email: owner.email });
  });
});
