import { NextFunction, Request, Response } from 'express';
import { BudgetService } from '../services/budget.service';
import { AppError, NotFoundError } from '../types/errors';

export class BudgetController {
  constructor(private readonly budgetService: BudgetService = new BudgetService()) {}

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await this.budgetService.getSummary(req.params.tripId, this.getUserId(req));
      res.status(200).json(summary);
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

export const budgetController = new BudgetController();
