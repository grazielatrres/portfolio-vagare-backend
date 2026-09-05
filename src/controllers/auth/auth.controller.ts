import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../../services/auth/auth.service';
import { AppError } from '../../types/errors';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body as {
        name?: string;
        email?: string;
        password?: string;
      };

      if (!name || !email || !password) {
        throw new AppError('Nome, e-mail e senha são obrigatórios', 400);
      }

      const result = await authService.register(name, email, password);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as {
        email?: string;
        password?: string;
      };

      if (!email || !password) {
        throw new AppError('E-mail e senha são obrigatórios', 400);
      }

      const result = await authService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async google(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body as { token?: string };

      if (!token) {
        throw new AppError('Token do Google é obrigatório', 400);
      }

      const result = await authService.googleLogin(token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.sessionId) {
        throw new AppError('Não autenticado', 401);
      }

      await authService.logout(req.sessionId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
