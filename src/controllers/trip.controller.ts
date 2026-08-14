import { NextFunction, Request, Response } from 'express';
import { TripPayload, TripService } from '../services/trip.service';
import { AppError, NotFoundError, ValidationError } from '../types/errors';

export class TripController {
  constructor(private readonly tripService: TripService = new TripService()) {}

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await this.tripService.createTrip(this.getUserId(req), this.extractPayload(req));
      res.status(201).json(trip);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trips = await this.tripService.listTrips(this.getUserId(req));
      res.status(200).json(trips);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await this.tripService.getTrip(req.params.id, this.getUserId(req));
      res.status(200).json(trip);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const trip = await this.tripService.updateTrip(
        req.params.id,
        this.getUserId(req),
        this.extractPayload(req),
      );
      res.status(200).json(trip);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.tripService.deleteTrip(req.params.id, this.getUserId(req));
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

  private extractPayload(req: Request): TripPayload {
    const { name, destination, startDate, endDate, budget, numberOfPeople } = req.body as TripPayload;
    return { name, destination, startDate, endDate, budget, numberOfPeople };
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

export const tripController = new TripController();
