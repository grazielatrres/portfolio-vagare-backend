import { prisma } from '../../config/prisma';

export class SessionRepository {
  async create(userId: string): Promise<{ id: string }> {
    return prisma.session.create({
      data: { userId },
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

  async deleteById(id: string): Promise<void> {
    await prisma.session.deleteMany({ where: { id } });
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  }
}
