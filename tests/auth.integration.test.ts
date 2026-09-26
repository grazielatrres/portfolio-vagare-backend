// auth.integration.test.ts — RF01, RF02, RF03, RF04, RNF04

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import { AuthService } from '../src/services/auth/auth.service';

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
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
  create: jest.Mock;
  update: jest.Mock;
};

const prismaSession = prisma.session as unknown as {
  create: jest.Mock;
  findUnique: jest.Mock;
  deleteMany: jest.Mock;
};

function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
    provider: AuthProvider.local,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Auth endpoints (integração)', () => {
  const app = createApp();
  const authService = new AuthService();

  beforeEach(() => {
    prismaSession.create.mockResolvedValue({ id: 'session-1' });
  });

  describe('POST /auth/register', () => {
    it('registra usuário e retorna 201 com token', async () => {
      const created = buildUser({ passwordHash: 'hashed' });
      prismaUser.findUnique.mockResolvedValue(null);
      prismaUser.create.mockResolvedValue(created);

      const response = await request(app).post('/auth/register').send({
        name: 'Maria Silva',
        email: 'maria@example.com',
        password: 'senha123',
      });

      expect(response.status).toBe(201);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({
        id: created.id,
        email: created.email,
        name: created.name,
      });
    });

    it('retorna 400 quando faltam campos', async () => {
      const response = await request(app).post('/auth/register').send({
        email: 'maria@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Nome, e-mail e senha são obrigatórios' });
    });

    it('retorna 409 quando e-mail já existe', async () => {
      prismaUser.findUnique.mockResolvedValue(buildUser());

      const response = await request(app).post('/auth/register').send({
        name: 'Maria Silva',
        email: 'maria@example.com',
        password: 'senha123',
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'E-mail já cadastrado' });
    });
  });

  describe('POST /auth/login', () => {
    it('autentica com credenciais válidas e retorna 200', async () => {
      const passwordHash = await authService.hashPassword('senha123');
      prismaUser.findUnique.mockResolvedValue(buildUser({ passwordHash }));

      const response = await request(app).post('/auth/login').send({
        email: 'maria@example.com',
        password: 'senha123',
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.user.email).toBe('maria@example.com');
    });

    it('retorna 400 quando faltam campos', async () => {
      const response = await request(app).post('/auth/login').send({
        email: 'maria@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'E-mail e senha são obrigatórios' });
    });

    it('retorna 401 com credenciais inválidas', async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      const response = await request(app).post('/auth/login').send({
        email: 'maria@example.com',
        password: 'senha-errada',
      });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Credenciais inválidas' });
    });
  });

  describe('POST /auth/google', () => {
    it('retorna 400 quando token está ausente', async () => {
      const response = await request(app).post('/auth/google').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token do Google é obrigatório' });
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('retorna 400 quando falta o e-mail', async () => {
      const response = await request(app).post('/auth/forgot-password').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'E-mail é obrigatório' });
    });

    it('retorna 200 com mensagem genérica quando o e-mail está cadastrado', async () => {
      prismaUser.findUnique.mockResolvedValue(buildUser());
      prismaUser.update.mockResolvedValue(buildUser());

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'maria@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message:
          'Se o e-mail informado estiver cadastrado, você receberá um link de redefinição de senha.',
      });
      expect(prismaUser.update).toHaveBeenCalledTimes(1);
    });

    it('retorna 200 com a mesma mensagem genérica quando o e-mail não está cadastrado', async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'naoexiste@example.com' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message:
          'Se o e-mail informado estiver cadastrado, você receberá um link de redefinição de senha.',
      });
      expect(prismaUser.update).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('retorna 400 quando faltam campos', async () => {
      const response = await request(app).post('/auth/reset-password').send({ token: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token e nova senha são obrigatórios' });
    });

    it('redefine a senha com sucesso e retorna 200', async () => {
      prismaUser.findUnique.mockResolvedValue(
        buildUser({ resetTokenHash: 'hash', resetTokenExpiresAt: new Date(Date.now() + 60_000) }),
      );
      prismaUser.update.mockResolvedValue(buildUser());
      prismaSession.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'token-valido', password: 'novaSenha123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(prismaSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    });

    it('retorna 400 quando o token é inválido ou expirado', async () => {
      prismaUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: 'token-invalido', password: 'novaSenha123' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Token inválido ou expirado' });
    });
  });

  describe('GET /health', () => {
    it('retorna status ok', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('authMiddleware', () => {
    it('retorna 401 com Bearer vazio', async () => {
      const response = await request(app).get('/trips').set('Authorization', 'Bearer ');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token de autenticação ausente' });
    });

    it('retorna 401 quando o usuário do token não existe', async () => {
      const token = jwt.sign(
        { sub: 'missing-user', email: 'ghost@example.com', sid: 'session-1' },
        env.jwtSecret,
        { expiresIn: '1h' },
      );
      prismaSession.findUnique.mockResolvedValue({ id: 'session-1' });
      prismaUser.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/trips').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Usuário não encontrado' });
    });

    it('retorna 401 sem sid no token', async () => {
      const token = jwt.sign({ sub: 'user-1', email: 'maria@example.com' }, env.jwtSecret, {
        expiresIn: '1h',
      });

      const response = await request(app).get('/trips').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token inválido' });
    });

    it('retorna 401 quando a sessão já foi encerrada', async () => {
      const token = jwt.sign(
        { sub: 'user-1', email: 'maria@example.com', sid: 'session-encerrada' },
        env.jwtSecret,
        { expiresIn: '1h' },
      );
      prismaSession.findUnique.mockResolvedValue(null);

      const response = await request(app).get('/trips').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Sessão encerrada. Faça login novamente.' });
    });
  });

  describe('POST /auth/logout', () => {
    it('encerra a sessão atual e retorna 204', async () => {
      const token = jwt.sign(
        { sub: 'user-1', email: 'maria@example.com', sid: 'session-1' },
        env.jwtSecret,
        { expiresIn: '1h' },
      );
      prismaSession.findUnique.mockResolvedValue({ id: 'session-1' });
      prismaUser.findUnique.mockResolvedValue(buildUser());
      prismaSession.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      expect(prismaSession.deleteMany).toHaveBeenCalledWith({ where: { id: 'session-1' } });
    });

    it('retorna 401 sem token', async () => {
      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token de autenticação ausente' });
    });
  });

  describe('errorMiddleware', () => {
    it('retorna 500 para erro inesperado', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      prismaUser.findUnique.mockImplementation(() => {
        throw new Error('falha inesperada');
      });

      const response = await request(app).post('/auth/login').send({
        email: 'maria@example.com',
        password: 'senha123',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Erro interno do servidor' });
      consoleSpy.mockRestore();
    });
  });
});
