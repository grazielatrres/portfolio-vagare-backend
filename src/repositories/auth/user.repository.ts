import { AuthProvider, User } from '@prisma/client';
import { prisma } from '../../config/prisma';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash?: string | null;
  provider?: AuthProvider;
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
}
