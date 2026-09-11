import { AuthProvider, User } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash?: string | null;
  provider?: AuthProvider;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
}

export class UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash ?? null,
        provider: data.provider ?? AuthProvider.local,
      },
    });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.email !== undefined && { email: data.email }),
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  async setResetToken(
    id: string,
    resetTokenHash: string,
    resetTokenExpiresAt: Date,
  ): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { resetTokenHash, resetTokenExpiresAt },
    });
  }

  async findByResetTokenHash(resetTokenHash: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { resetTokenHash } });
  }

  async resetPassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiresAt: null },
    });
  }
}
