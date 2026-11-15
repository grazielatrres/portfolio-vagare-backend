import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AuthProvider, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { UserRepository } from '../../repositories/auth/user.repository';
import { SessionRepository } from '../../repositories/auth/session.repository';
import { MailService } from '../mail/mail.service';
import { AppError } from '../../types/errors';
import { AuthenticatedUser, AuthResponse, JwtPayload } from '../../types/express';
import { getPasswordPolicyError } from './passwordPolicy';

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenTtlDays: number;
  googleClientId: string;
  resetPasswordUrl: string;
}

export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly sessionRepository: SessionRepository = new SessionRepository(),
    private readonly config: AuthServiceConfig = {
      jwtSecret: env.jwtSecret,
      jwtExpiresIn: env.jwtExpiresIn,
      refreshTokenTtlDays: env.refreshTokenTtlDays,
      googleClientId: env.googleClientId,
      resetPasswordUrl: env.resetPasswordUrl,
    },
    private readonly mailService: MailService = new MailService(),
  ) {
    this.googleClient = new OAuth2Client(this.config.googleClientId);
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    this.validateCredentialsInput(name, email, password);

    const existing = await this.userRepository.findByEmail(email.toLowerCase());
    if (existing) {
      throw new AppError('E-mail já cadastrado', 409);
    }

    const passwordHash = await this.hashPassword(password);
    const user = await this.userRepository.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      provider: AuthProvider.local,
    });

    return this.buildAuthResponse(user);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    if (!email?.trim() || !password) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
    if (!user || !user.passwordHash) {
      throw new AppError('Credenciais inválidas', 401);
    }

    const isValid = await this.comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Credenciais inválidas', 401);
    }

    return this.buildAuthResponse(user);
  }

  async googleLogin(idToken: string): Promise<AuthResponse> {
    if (!idToken?.trim()) {
      throw new AppError('Token do Google é obrigatório', 400);
    }

    if (!this.config.googleClientId) {
      throw new AppError('Login com Google não está configurado', 500);
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AppError('Token do Google inválido', 401);
    }

    if (!payload?.email || !payload.email_verified) {
      throw new AppError('Token do Google inválido', 401);
    }

    const email = payload.email.toLowerCase();
    const name = payload.name?.trim() || email.split('@')[0];

    let user = await this.userRepository.findByEmail(email);
    if (!user) {
      user = await this.userRepository.create({
        name,
        email,
        passwordHash: null,
        provider: AuthProvider.google,
      });
    }

    return this.buildAuthResponse(user);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(user: Pick<User, 'id' | 'email'>, sessionId: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      sid: sessionId,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
      }) as JwtPayload;
      if (!decoded.sub || !decoded.email || !decoded.sid) {
        throw new AppError('Token inválido', 401);
      }
      return decoded;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AppError('Token expirado', 401);
      }
      if (error instanceof JsonWebTokenError) {
        throw new AppError('Token inválido', 401);
      }
      throw error;
    }
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    if (!refreshToken?.trim()) {
      throw new AppError('Refresh token é obrigatório', 400);
    }

    const currentHash = this.hashOpaqueToken(refreshToken);
    const session = await this.sessionRepository.findByRefreshTokenHash(currentHash);
    if (!session) {
      throw new AppError('Sessão encerrada. Faça login novamente.', 401);
    }

    if (!session.expiresAt || session.expiresAt.getTime() <= Date.now()) {
      await this.sessionRepository.deleteById(session.id);
      throw new AppError('Sessão expirada. Faça login novamente.', 401);
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      throw new AppError('Usuário não encontrado', 401);
    }

    const nextRefreshToken = this.generateRefreshToken();
    const rotated = await this.sessionRepository.rotateRefreshToken(
      session.id,
      currentHash,
      this.hashOpaqueToken(nextRefreshToken),
      this.refreshTokenExpiresAt(),
    );
    if (!rotated) {
      throw new AppError('Sessão encerrada. Faça login novamente.', 401);
    }

    return {
      token: this.generateToken(user, session.id),
      refreshToken: nextRefreshToken,
      user: this.toPublicUser(user),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionRepository.deleteById(sessionId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!email?.trim()) {
      throw new AppError('E-mail é obrigatório', 400);
    }

    const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
    if (!user || !user.passwordHash) {
      return;
    }

    const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
    await this.userRepository.setResetToken(user.id, this.hashOpaqueToken(rawToken), expiresAt);

    const resetLink = `${this.config.resetPasswordUrl}?token=${rawToken}`;
    await this.mailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token?.trim()) {
      throw new AppError('Token é obrigatório', 400);
    }
    if (!newPassword) {
      throw new AppError('Senha é obrigatória', 400);
    }
    this.assertStrongPassword(newPassword);

    const user = await this.userRepository.findByResetTokenHash(this.hashOpaqueToken(token));
    if (!user) {
      throw new AppError('Token inválido ou expirado', 400);
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.userRepository.resetPassword(user.id, passwordHash);
    await this.sessionRepository.deleteAllByUserId(user.id);
  }

  private hashOpaqueToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken(): string {
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }

  private refreshTokenExpiresAt(): Date {
    return new Date(Date.now() + this.config.refreshTokenTtlDays * DAY_MS);
  }

  private toPublicUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      provider: user.provider,
    };
  }

  private validateCredentialsInput(name: string, email: string, password: string): void {
    if (!name?.trim()) {
      throw new AppError('Nome é obrigatório', 400);
    }
    if (!email?.trim()) {
      throw new AppError('E-mail é obrigatório', 400);
    }
    if (!password) {
      throw new AppError('Senha é obrigatória', 400);
    }
    this.assertStrongPassword(password);
  }

  private assertStrongPassword(password: string): void {
    const policyError = getPasswordPolicyError(password);
    if (policyError) {
      throw new AppError(policyError, 400);
    }
  }

  private async buildAuthResponse(user: User): Promise<AuthResponse> {
    // Sessões abandonadas (app desinstalado etc.) nunca passam pelo /refresh,
    // então aproveitamos cada novo login para limpar as expiradas do usuário.
    await this.sessionRepository.deleteExpiredByUserId(user.id);

    const refreshToken = this.generateRefreshToken();
    const session = await this.sessionRepository.create(
      user.id,
      this.hashOpaqueToken(refreshToken),
      this.refreshTokenExpiresAt(),
    );

    return {
      token: this.generateToken(user, session.id),
      refreshToken,
      user: this.toPublicUser(user),
    };
  }
}
