import { prisma } from '../../config/prisma';

export interface SessionRefreshInfo {
  id: string;
  userId: string;
  expiresAt: Date | null;
}

export class SessionRepository {
  async create(userId: string, refreshTokenHash: string, expiresAt: Date): Promise<{ id: string }> {
    return prisma.session.create({
      data: { userId, refreshTokenHash, expiresAt },
      select: { id: true },
    });
  }

  async existsById(id: string): Promise<boolean> {
    const session = await prisma.session.findUnique({
      where: { id },
      select: { id: true },
    });
    return session !== null;
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRefreshInfo | null> {
    return prisma.session.findUnique({
      where: { refreshTokenHash },
      select: { id: true, userId: true, expiresAt: true },
    });
  }

  async rotateRefreshToken(
    id: string,
    currentHash: string,
    nextHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await prisma.session.updateMany({
      where: { id, refreshTokenHash: currentHash },
      data: { refreshTokenHash: nextHash, expiresAt },
    });
    return result.count === 1;
  }

  async deleteById(id: string): Promise<void> {
    await prisma.session.deleteMany({ where: { id } });
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  }
}
