import bcrypt from 'bcrypt';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { AuthProvider, User } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { UserRepository } from '../../repositories/auth/user.repository';
import { AppError } from '../../types/errors';
import { AuthenticatedUser, AuthResponse, JwtPayload } from '../../types/express';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

export interface AuthServiceConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  googleClientId: string;
}

export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly config: AuthServiceConfig = {
      jwtSecret: env.jwtSecret,
      jwtExpiresIn: env.jwtExpiresIn,
      googleClientId: env.googleClientId,
    },
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

  generateToken(user: Pick<User, 'id' | 'email'>): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as JwtPayload;
      if (!decoded.sub || !decoded.email) {
        throw new AppError('Token inválido', 401);
      }
      return decoded;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new AppError('Token expirado. Faça login novamente.', 401);
      }
      if (error instanceof JsonWebTokenError) {
        throw new AppError('Token inválido', 401);
      }
      throw error;
    }
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
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError('A senha deve ter no mínimo 6 caracteres', 400);
    }
  }

  private buildAuthResponse(user: User): AuthResponse {
    const publicUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      provider: user.provider,
    };

    return {
      token: this.generateToken(user),
      user: publicUser,
    };
  }
}
