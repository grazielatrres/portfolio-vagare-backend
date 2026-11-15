import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { IdempotencyKeyRepository } from '../repositories/idempotencyKey.repository';
import { AppError } from '../types/errors';
import { env } from '../config/env';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const MAX_KEY_LENGTH = 255;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function logStorageError(error: unknown): void {
  if (env.nodeEnv !== 'production') {
    console.error('idempotency', error);
  }
}

// Deve vir depois do authMiddleware: a chave é escopada por usuário.
export function idempotency(
  repository: IdempotencyKeyRepository = new IdempotencyKeyRepository(),
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const key = req.header(IDEMPOTENCY_HEADER)?.trim();
      const userId = req.user?.id;
      if (!key || !userId) {
        next();
        return;
      }
      if (key.length > MAX_KEY_LENGTH) {
        throw new AppError(`${IDEMPOTENCY_HEADER} inválida`, 400);
      }

      const path = req.originalUrl.split('?')[0];
      const existing = await repository.find(userId, key);
      if (existing) {
        if (existing.method !== req.method || existing.path !== path) {
          throw new AppError(`${IDEMPOTENCY_HEADER} já usada em outra requisição`, 422);
        }
        if (existing.statusCode === null) {
          throw new AppError('Requisição original ainda em processamento', 409);
        }
        res.status(existing.statusCode).json(existing.responseBody);
        return;
      }

      let reservedId: string;
      try {
        ({ id: reservedId } = await repository.reserve(userId, key, req.method, path));
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError('Requisição original ainda em processamento', 409);
        }
        throw error;
      }

      // Em erro libera a chave, para que um reenvio possa tentar de novo.
      const sendJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const statusCode = res.statusCode;
        const persist =
          statusCode >= 200 && statusCode < 300
            ? repository.complete(reservedId, statusCode, body)
            : repository.release(reservedId);
        persist.catch(logStorageError).finally(() => sendJson(body));
        return res;
      }) as Response['json'];

      next();
    } catch (error) {
      next(error);
    }
  };
}
