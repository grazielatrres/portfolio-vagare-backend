import { NextFunction, Request, Response } from 'express';
import { InfoPayload, InfoService } from '../services/info.service';
import { AppError, NotFoundError, ValidationError } from '../types/errors';

export class InfoController {
  constructor(private readonly infoService: InfoService = new InfoService()) {}

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const infos = await this.infoService.listInfos(req.params.tripId, this.getUserId(req));
      res.status(200).json(infos);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const info = await this.infoService.createInfo(
        req.params.tripId,
        this.getUserId(req),
        this.extractPayload(req),
      );
      res.status(201).json(info);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const info = await this.infoService.updateInfo(
        req.params.id,
        req.params.tripId,
        this.getUserId(req),
        this.extractPayload(req),
      );
      res.status(200).json(info);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.infoService.deleteInfo(req.params.id, req.params.tripId, this.getUserId(req));
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

  private extractPayload(req: Request): InfoPayload {
    const { type, title, description, date, details } = req.body as InfoPayload;
    return { type, title, description, date, details };
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

export const infoController = new InfoController();
