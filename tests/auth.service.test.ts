// auth.service.test.ts — RF01, RF02, RF03, RF04, RF05, RN01, RN02, RN03, RNF04, RNF05
//
// RF01 — Cadastro local com nome, e-mail e senha
// RF02 — Login local com e-mail e senha
// RF03 — Autenticação via Google (criação/recuperação de usuário)
// RF04 — Geração de JWT após autenticação bem-sucedida
// RF05 — Validação de JWT (token válido / inválido)
// RN01 — Senha com menos de 6 caracteres retorna erro 400
// RN02 — E-mail duplicado retorna erro 409
// RN03 — Credenciais inválidas no login retornam 401 sem indicar qual campo falhou
// RNF04 — JWT com expiração configurável; token expirado rejeitado
// RNF05 — Senha armazenada com hash bcrypt (nunca em texto puro)

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AuthService } from '../src/services/auth/auth.service';
import { UserRepository } from '../src/repositories/auth/user.repository';
import { AppError } from '../src/types/errors';

function buildUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: 'user-1',
    name: 'Maria Silva',
    email: 'maria@example.com',
    passwordHash: null,
    provider: AuthProvider.local,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AuthService', () => {
  const config = {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    googleClientId: 'google-client-id',
  };

  let userRepository: jest.Mocked<UserRepository>;
  let authService: AuthService;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    authService = new AuthService(userRepository, config);
  });

  describe('hashPassword / comparePassword (RNF05)', () => {
    it('gera hash bcrypt diferente da senha em texto puro', async () => {
      const password = 'senha123';
      const hash = await authService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2')).toBe(true);
    });

    it('valida corretamente a senha contra o hash', async () => {
      const password = 'senha123';
      const hash = await authService.hashPassword(password);

      await expect(authService.comparePassword(password, hash)).resolves.toBe(true);
      await expect(authService.comparePassword('outra', hash)).resolves.toBe(false);
    });
  });

  describe('generateToken / verifyToken (RF04, RF05, RNF04)', () => {
    it('gera e valida um JWT com sub e email', () => {
      const token = authService.generateToken({
        id: 'user-1',
        email: 'maria@example.com',
      });

      const payload = authService.verifyToken(token);

      expect(payload.sub).toBe('user-1');
      expect(payload.email).toBe('maria@example.com');
    });

    it('rejeita token inválido com 401', () => {
      expect(() => authService.verifyToken('token.invalido')).toThrow(AppError);

      try {
        authService.verifyToken('token.invalido');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Token inválido');
      }
    });

    it('rejeita token expirado com 401 e mensagem clara', () => {
      const shortLived = new AuthService(userRepository, {
        ...config,
        jwtExpiresIn: '1ms',
      });

      const token = shortLived.generateToken({
        id: 'user-1',
        email: 'maria@example.com',
      });

      // força expiração imediata
      const expired = jwt.sign({ sub: 'user-1', email: 'maria@example.com' }, config.jwtSecret, {
        expiresIn: -10,
      });

      expect(() => shortLived.verifyToken(expired)).toThrow(AppError);

      try {
        shortLived.verifyToken(expired);
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toMatch(/expirado/i);
      }

      // garante que o token curto também é um JWT válido estruturalmente
      expect(typeof token).toBe('string');
    });
  });

  describe('register (RF01, RN01, RN02, RNF05)', () => {
    it('cria usuário com senha hasheada e retorna JWT', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockImplementation(async (data) =>
        buildUser({
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash ?? null,
          provider: data.provider ?? AuthProvider.local,
        }),
      );

      const result = await authService.register('Maria Silva', 'maria@example.com', 'senha123');

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Maria Silva',
          email: 'maria@example.com',
          provider: AuthProvider.local,
        }),
      );

      const createArg = userRepository.create.mock.calls[0][0];
      expect(createArg.passwordHash).toBeDefined();
      expect(createArg.passwordHash).not.toBe('senha123');
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe('maria@example.com');
    });

    it('retorna 400 quando a senha tem menos de 6 caracteres', async () => {
      await expect(
        authService.register('Maria', 'maria@example.com', '12345'),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'A senha deve ter no mínimo 6 caracteres',
      });

      expect(userRepository.create).not.toHaveBeenCalled();
    });

    it('retorna 409 quando o e-mail já está cadastrado', async () => {
      userRepository.findByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.register('Outra', 'maria@example.com', 'senha123'),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'E-mail já cadastrado',
      });
    });
  });

  describe('login (RF02, RN03)', () => {
    it('autentica com credenciais válidas e retorna JWT', async () => {
      const passwordHash = await authService.hashPassword('senha123');
      userRepository.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      const result = await authService.login('maria@example.com', 'senha123');

      expect(result.token).toBeDefined();
      expect(result.user.id).toBe('user-1');
    });

    it('retorna 401 genérico para e-mail inexistente', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login('naoexiste@example.com', 'senha123')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciais inválidas',
      });
    });

    it('retorna 401 genérico para senha incorreta', async () => {
      const passwordHash = await authService.hashPassword('senha123');
      userRepository.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await expect(authService.login('maria@example.com', 'errada')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Credenciais inválidas',
      });
    });
  });

  describe('googleLogin (RF03)', () => {
    it('cria usuário google quando ainda não existe e retorna JWT', async () => {
      const verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'google@example.com',
          email_verified: true,
          name: 'Google User',
        }),
      });

      (
        authService as unknown as { googleClient: { verifyIdToken: typeof verifyIdToken } }
      ).googleClient = { verifyIdToken };

      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(
        buildUser({
          id: 'google-user',
          name: 'Google User',
          email: 'google@example.com',
          passwordHash: null,
          provider: AuthProvider.google,
        }),
      );

      const result = await authService.googleLogin('valid-google-token');

      expect(userRepository.create).toHaveBeenCalledWith({
        name: 'Google User',
        email: 'google@example.com',
        passwordHash: null,
        provider: AuthProvider.google,
      });
      expect(result.user.provider).toBe(AuthProvider.google);
      expect(result.token).toBeDefined();
    });

    it('recupera usuário existente sem criar duplicata', async () => {
      const verifyIdToken = jest.fn().mockResolvedValue({
        getPayload: () => ({
          email: 'google@example.com',
          email_verified: true,
          name: 'Google User',
        }),
      });

      (
        authService as unknown as { googleClient: { verifyIdToken: typeof verifyIdToken } }
      ).googleClient = { verifyIdToken };

      userRepository.findByEmail.mockResolvedValue(
        buildUser({
          email: 'google@example.com',
          provider: AuthProvider.google,
          passwordHash: null,
        }),
      );

      const result = await authService.googleLogin('valid-google-token');

      expect(userRepository.create).not.toHaveBeenCalled();
      expect(result.user.email).toBe('google@example.com');
    });

    it('retorna 401 para token do Google inválido', async () => {
      const verifyIdToken = jest.fn().mockRejectedValue(new Error('invalid'));

      (
        authService as unknown as { googleClient: { verifyIdToken: typeof verifyIdToken } }
      ).googleClient = { verifyIdToken };

      await expect(authService.googleLogin('bad-token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Token do Google inválido',
      });
    });
  });
});
