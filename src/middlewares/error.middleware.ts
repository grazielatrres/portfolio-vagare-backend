import { NextFunction, Request, Response } from 'express';
import { AppError } from '../types/errors';
import { captureError } from '../config/observability';

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
    });
    return;
  }

  // Erro inesperado: vai para o log estruturado e, se configurado, para o Sentry.
  captureError(error, { method: req.method, path: req.originalUrl.split('?')[0] });

  res.status(500).json({
    error: 'Erro interno do servidor',
  });
}
