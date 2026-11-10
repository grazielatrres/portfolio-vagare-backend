import { NextFunction, Request, Response } from 'express';
import { WeatherService } from '../services/weather/weather.service';
import { AppError, NotFoundError } from '../types/errors';

export class WeatherController {
  constructor(private readonly weatherService: WeatherService = new WeatherService()) {}

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const forecast = await this.weatherService.getTripForecast(
        req.params.tripId,
        this.getUserId(req),
      );
      res.status(200).json(forecast);
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
    if (error instanceof NotFoundError) {
      return new AppError(error.message, 404);
    }
    return error;
  }
}

export const weatherController = new WeatherController();
