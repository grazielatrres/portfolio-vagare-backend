import { NextFunction, Request, Response } from 'express';
import { ExpensePayload, ExpenseService } from '../services/expense.service';
import { AppError, NotFoundError, ValidationError } from '../types/errors';

export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService = new ExpenseService()) {}

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const expenses = await this.expenseService.listExpenses(
        req.params.tripId,
        this.getUserId(req),
      );
      res.status(200).json(expenses);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const expense = await this.expenseService.createExpense(
        req.params.tripId,
        this.getUserId(req),
        this.extractPayload(req),
      );
      res.status(201).json(expense);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const expense = await this.expenseService.updateExpense(
        req.params.id,
        req.params.tripId,
        this.getUserId(req),
        this.extractPayload(req),
      );
      res.status(200).json(expense);
    } catch (error) {
      next(this.mapError(error));
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.expenseService.deleteExpense(
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

  private extractPayload(req: Request): ExpensePayload {
    const { description, amount, currency, category } = req.body as ExpensePayload;
    return { description, amount, currency, category };
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

export const expenseController = new ExpenseController();
