import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface StoredIdempotencyKey {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  responseBody: Prisma.JsonValue | null;
}

export class IdempotencyKeyRepository {
  async find(userId: string, key: string): Promise<StoredIdempotencyKey | null> {
    return prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
      select: { id: true, method: true, path: true, statusCode: true, responseBody: true },
    });
  }

  // Lança P2002 se a chave já foi reservada por outra requisição.
  async reserve(
    userId: string,
    key: string,
    method: string,
    path: string,
  ): Promise<{ id: string }> {
    return prisma.idempotencyKey.create({
      data: { userId, key, method, path },
      select: { id: true },
    });
  }

  async complete(id: string, statusCode: number, responseBody: unknown): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { id },
      data: {
        statusCode,
        responseBody: (responseBody ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  async release(id: string): Promise<void> {
    await prisma.idempotencyKey.deleteMany({ where: { id } });
  }
}
