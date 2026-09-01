import { NextFunction, Request, Response } from 'express';
import { AuthProvider } from '@prisma/client';
import { AuthService } from '../services/auth/auth.service';
import { UserRepository } from '../repositories/auth/user.repository';
import { SessionRepository } from '../repositories/auth/session.repository';
import { AppError } from '../types/errors';

const authService = new AuthService();
const userRepository = new UserRepository();
const sessionRepository = new SessionRepository();

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Token de autenticação ausente', 401);
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new AppError('Token de autenticação ausente', 401);
    }

    const payload = authService.verifyToken(token);

    const sessionActive = await sessionRepository.existsById(payload.sid);
    if (!sessionActive) {
      throw new AppError('Sessão encerrada. Faça login novamente.', 401);
    }

    const user = await userRepository.findById(payload.sub);
    if (!user) {
      throw new AppError('Usuário não encontrado', 401);
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      provider: user.provider as AuthProvider,
    };
    req.sessionId = payload.sid;

    next();
  } catch (error) {
    next(error);
  }
}
