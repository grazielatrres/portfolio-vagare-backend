import { NextFunction, Request, Response } from 'express';
import { AppError } from '../types/errors';
import { env } from '../config/env';

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
    });
    return;
  }

  if (env.nodeEnv !== 'production') {
    console.error(error);
  }

  res.status(500).json({
    error: 'Erro interno do servidor',
  });
}
