import { AuthProvider, User } from '@prisma/client';
import { UserRepository } from '../repositories/auth/user.repository';
import { TripRepository } from '../repositories/trip.repository';
import { AppError, NotFoundError, ValidationError } from '../types/errors';

export interface ProfilePayload {
  name?: string;
  email?: string;
}

export interface ProfileResponse {
  id: string;
  name: string;
  email: string;
  provider: AuthProvider;
  createdAt: Date;
  stats: {
    totalTrips: number;
  };
}

export class ProfileService {
  constructor(
    private readonly userRepository: UserRepository = new UserRepository(),
    private readonly tripRepository: TripRepository = new TripRepository(),
  ) {}

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.userRepository.findById(userId);
    return this.buildResponse(this.ensureFound(user));
  }

  async updateProfile(userId: string, data: ProfilePayload): Promise<ProfileResponse> {
    this.validatePayload(data);

    if (data.email !== undefined) {
      const existing = await this.userRepository.findByEmail(data.email.toLowerCase().trim());
      if (existing && existing.id !== userId) {
        throw new AppError('E-mail já cadastrado', 409);
      }
    }

    const updated = await this.userRepository.update(userId, {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.email !== undefined && { email: data.email.toLowerCase().trim() }),
    });

    return this.buildResponse(updated);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    this.ensureFound(user);
    await this.userRepository.delete(userId);
  }

  private validatePayload(data: ProfilePayload): void {
    if (data.name !== undefined && !data.name.trim()) {
      throw new ValidationError('Nome não pode ser vazio');
    }
    if (data.email !== undefined && !data.email.trim()) {
      throw new ValidationError('E-mail não pode ser vazio');
    }
  }

  private ensureFound(user: User | null): User {
    if (!user) {
      throw new NotFoundError('Usuário não encontrado');
    }
    return user;
  }

  private async buildResponse(user: User): Promise<ProfileResponse> {
    const totalTrips = await this.tripRepository.countByUser(user.id);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      provider: user.provider,
      createdAt: user.createdAt,
      stats: { totalTrips },
    };
  }
}
