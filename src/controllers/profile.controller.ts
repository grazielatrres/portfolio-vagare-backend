import { NextFunction, Request, Response } from 'express';
import { ProfilePayload, ProfileService } from '../services/profile.service';
import { AppError, NotFoundError, ValidationError } from '../types/errors';

export class ProfileController {
  constructor(private readonly profileService: ProfileService = new ProfileService()) {}

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await this.profileService.getProfile(this.getUserId(req));
      res.status(200).json(profile);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email } = req.body as ProfilePayload;
      const profile = await this.profileService.updateProfile(this.getUserId(req), { name, email });
      res.status(200).json(profile);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.profileService.deleteAccount(this.getUserId(req));
      res.status(204).send();
    } catch (error) {
      next(this.mapError(error));
    }
  }

  private getUserId(req: Request): string {
    if (!req.user?.id) {
      throw new AppError('Não autenticado', 401);
    }
    return req.user.id;
  }

  private mapError(error: unknown): unknown {
    if (error instanceof ValidationError) {
      return new AppError(error.message, 400);
    }
    if (error instanceof NotFoundError) {
      return new AppError(error.message, 404);
    }
    return error;
  }
}

export const profileController = new ProfileController();
