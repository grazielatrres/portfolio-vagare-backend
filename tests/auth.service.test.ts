// auth.service.test.ts — RF01, RF02, RF03, RF04, RF05, RN01, RN02, RN03, RNF04, RNF05

import { AuthProvider, User } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { AuthService } from '../src/services/auth/auth.service';
import { UserRepository } from '../src/repositories/auth/user.repository';
import { SessionRepository } from '../src/repositories/auth/session.repository';
import { MailService } from '../src/services/mail/mail.service';
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

function mockGoogleVerify(authService: AuthService, verifyIdToken: jest.Mock): void {
  (
    authService as unknown as { googleClient: { verifyIdToken: typeof verifyIdToken } }
  ).googleClient = { verifyIdToken };
}

describe('AuthService', () => {
  const config = {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    googleClientId: 'google-client-id',
    resetPasswordUrl: 'vagareapp://reset-password',
  };

  let userRepository: jest.Mocked<UserRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let mailService: jest.Mocked<MailService>;
  let authService: AuthService;

  beforeEach(() => {
    userRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      setResetToken: jest.fn(),
      findByResetTokenHash: jest.fn(),
      resetPassword: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    sessionRepository = {
      create: jest.fn().mockResolvedValue({ id: 'session-1' }),
      existsById: jest.fn(),
      deleteById: jest.fn(),
      deleteAllByUserId: jest.fn(),
    } as unknown as jest.Mocked<SessionRepository>;

    mailService = {
      sendPasswordResetEmail: jest.fn(),
    } as unknown as jest.Mocked<MailService>;

    authService = new AuthService(userRepository, sessionRepository, config, mailService);
  });

  describe('hashPassword / comparePassword', () => {
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

  describe('generateToken / verifyToken', () => {
    it('gera e valida um JWT com sub, email e sid', () => {
      const token = authService.generateToken(
        {
          id: 'user-1',
          email: 'maria@example.com',
        },
        'session-1',
      );

      const payload = authService.verifyToken(token);

      expect(payload.sub).toBe('user-1');
      expect(payload.email).toBe('maria@example.com');
      expect(payload.sid).toBe('session-1');
    });

    it('rejeita token sem sid com 401', () => {
      const token = jwt.sign({ sub: 'user-1', email: 'maria@example.com' }, config.jwtSecret, {
        expiresIn: '1h',
      });

      try {
        authService.verifyToken(token);
        throw new Error('deveria ter lançado');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Token inválido');
      }
    });

    it('rejeita token inválido com 401', () => {
      try {
        authService.verifyToken('token.invalido');
        throw new Error('deveria ter lançado');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe('Token inválido');
      }
    });

    it('rejeita token expirado com 401 e mensagem clara', () => {
      const expired = jwt.sign({ sub: 'user-1', email: 'maria@example.com' }, config.jwtSecret, {
        expiresIn: -10,
      });

      try {
        authService.verifyToken(expired);
        throw new Error('deveria ter lançado');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toMatch(/expirado/i);
      }
    });
  });

  describe('register', () => {
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

  describe('login', () => {
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

  describe('googleLogin', () => {
    it('cria usuário google quando ainda não existe e retorna JWT', async () => {
      mockGoogleVerify(
        authService,
        jest.fn().mockResolvedValue({
          getPayload: () => ({
            email: 'google@example.com',
            email_verified: true,
            name: 'Google User',
          }),
        }),
      );

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
      mockGoogleVerify(
        authService,
        jest.fn().mockResolvedValue({
          getPayload: () => ({
            email: 'google@example.com',
            email_verified: true,
            name: 'Google User',
          }),
        }),
      );

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
      mockGoogleVerify(authService, jest.fn().mockRejectedValue(new Error('invalid')));

      await expect(authService.googleLogin('bad-token')).rejects.toMatchObject({
        statusCode: 401,
        message: 'Token do Google inválido',
      });
    });
  });

  describe('logout', () => {
    it('destrói a sessão correspondente ao sid do token', async () => {
      await authService.logout('session-1');

      expect(sessionRepository.deleteById).toHaveBeenCalledWith('session-1');
    });
  });

  describe('requestPasswordReset', () => {
    it('gera e salva token hasheado com expiração e dispara o e-mail', async () => {
      userRepository.findByEmail.mockResolvedValue(buildUser({ passwordHash: 'hashed' }));

      await authService.requestPasswordReset('maria@example.com');

      expect(userRepository.setResetToken).toHaveBeenCalledTimes(1);
      const [userId, resetTokenHash, expiresAt] = userRepository.setResetToken.mock.calls[0];
      expect(userId).toBe('user-1');
      expect(resetTokenHash).toEqual(expect.any(String));
      expect(resetTokenHash).toHaveLength(64);
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const emailArg = mailService.sendPasswordResetEmail.mock.calls[0][0];
      expect(emailArg.to).toBe('maria@example.com');
      expect(emailArg.resetLink).toContain(config.resetPasswordUrl);
    });

    it('retorna silenciosamente sem lançar erro quando o e-mail não existe', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.requestPasswordReset('naoexiste@example.com'),
      ).resolves.toBeUndefined();

      expect(userRepository.setResetToken).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('retorna silenciosamente sem lançar erro quando o usuário não tem passwordHash', async () => {
      userRepository.findByEmail.mockResolvedValue(buildUser({ passwordHash: null }));

      await expect(authService.requestPasswordReset('maria@example.com')).resolves.toBeUndefined();

      expect(userRepository.setResetToken).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('atualiza a senha com token válido e encerra todas as sessões do usuário', async () => {
      userRepository.findByResetTokenHash.mockResolvedValue(buildUser());

      await authService.resetPassword('token-valido', 'novaSenha123');

      expect(userRepository.resetPassword).toHaveBeenCalledWith('user-1', expect.any(String));
      const newPasswordHash = userRepository.resetPassword.mock.calls[0][1];
      expect(newPasswordHash).not.toBe('novaSenha123');
      expect(sessionRepository.deleteAllByUserId).toHaveBeenCalledWith('user-1');
    });

    it('retorna 400 quando o token é inválido ou expirado', async () => {
      userRepository.findByResetTokenHash.mockResolvedValue(null);

      await expect(
        authService.resetPassword('token-invalido', 'novaSenha123'),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Token inválido ou expirado',
      });

      expect(userRepository.resetPassword).not.toHaveBeenCalled();
      expect(sessionRepository.deleteAllByUserId).not.toHaveBeenCalled();
    });

    it('retorna 400 quando a nova senha tem menos de 6 caracteres', async () => {
      await expect(authService.resetPassword('token-valido', '123')).rejects.toMatchObject({
        statusCode: 400,
        message: 'A senha deve ter no mínimo 6 caracteres',
      });

      expect(userRepository.findByResetTokenHash).not.toHaveBeenCalled();
      expect(userRepository.resetPassword).not.toHaveBeenCalled();
    });
  });
});
