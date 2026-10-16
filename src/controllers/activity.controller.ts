import { NextFunction, Request, Response } from 'express';
import { ActivityPayload, ActivityService } from '../services/activity.service';
import { AppError, NotFoundError, ValidationError } from '../types/errors';

export class ActivityController {
  constructor(private readonly activityService: ActivityService = new ActivityService()) {}

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activities = await this.activityService.listActivities(
        req.params.tripId,
        this.getUserId(req),
      );
      res.status(200).json(activities);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const activity = await this.activityService.createActivity(
        req.params.tripId,
        this.getUserId(req),
        this.extractPayload(req),
      );
      res.status(201).json(activity);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.activityService.deleteActivity(
        req.params.id,
        req.params.tripId,
        this.getUserId(req),
      );
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

  private extractPayload(req: Request): ActivityPayload {
    const { name, date, time, location, period, category, estimatedCost, description } =
      req.body as ActivityPayload;
    return { name, date, time, location, period, category, estimatedCost, description };
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

export const activityController = new ActivityController();
